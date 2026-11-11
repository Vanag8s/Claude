// Harbor Live Voice: real-time, interruptible phone receptionist.
//
// Twilio ConversationRelay handles the audio (speech-to-text, ElevenLabs text-to-speech, barge-in,
// turn detection, language detection) and talks to this server over a WebSocket in plain text.
// We stream Claude's reply back token by token, so the caller hears it start almost immediately,
// and we stop instantly when the caller talks over it.
//
// Runs as a normal always-on Node service (Fly.io / Render / Railway). Vercel can't hold WebSockets.

import http from "node:http";
import { WebSocketServer } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { business, SYSTEM, LIVE_VOICE_STYLE, TOOLS } from "../api/_lib/receptionist.js";
import { makeBooker } from "../api/_lib/booking.js";
import { sendSms, postWebhook, ownerPhone } from "../api/_lib/twilio.js";
import { relayTwiml, handoffTwiml, greetingFor, vipTwiml, isVip } from "../api/_lib/relay-twiml.js";
import { summarizeCall } from "../api/_lib/summary.js";
import { buildSystem, toolsFor } from "../api/_lib/profile.js";
import { businessForNumber } from "../api/_lib/store.js";

const memberGreeting = p => `Hi, thanks for calling ${p.company}! This is Harbor, the virtual assistant. How can I help?`;

export { relayTwiml, handoffTwiml, greetingFor };

const PORT = Number(process.env.PORT || 8080);
const LIVE_SYSTEM = SYSTEM + "\n" + LIVE_VOICE_STYLE + `
- Reply in the language the caller is speaking. Each caller message may start with a (caller language: xx) tag; use it.`;
const DEMO_NOTE = `
This call is a DEMO requested from Harbor's website by a business owner trying the product. Play the receptionist for ${business.company} convincingly. Bookings are simulated (the tool still works). If they ask about Harbor itself, say it's an AI front desk for home-service businesses, live in seven days, and they can book a free audit on the website.`;
// Eager input streaming on each client tool (streamed tool inputs); we validate inputs ourselves below.
const LIVE_TOOLS = TOOLS.map(t => ({ ...t, eager_input_streaming: true }));

// ---------- Tool input validation (inputs stream unvalidated with eager_input_streaming) ----------
function validInput(tool, input, tools = TOOLS) {
  const def = tools.find(t => t.name === tool);
  if (!def || typeof input !== "object" || input === null) return false;
  const props = def.input_schema.properties;
  return def.input_schema.required.every(k => k in input && typeof input[k] === props[k].type);
}

// ---------- One live call ----------
export class CallSession {
  constructor(ws, { client = new Anthropic(), log = () => {}, summarize = summarizeCall, lookup = businessForNumber } = {}) {
    this.lookup = lookup;
    this.member = null;         // { id, profile } when the dialed number belongs to a member business
    this.ws = ws;
    this.client = client;
    this.log = log;
    this.summarize = summarize;
    this.history = [];          // text-only turns, append-only (keeps the prompt cache warm)
    this.current = null;        // { ctrl, spoken } for the reply being streamed
    this.interruptedNote = null;
    this.booked = false;
    this.transferred = false;
    this.ended = false;
    this.demo = false;
    this.lang = null;
    this.call = {};
    this.ready = Promise.resolve();
  }

  send(msg) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  speak(token, last) { this.send({ type: "text", token, last }); }

  async onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.type) {
      case "setup":
        this.call = { sid: m.callSid, from: m.from, to: m.to };
        this.demo = m.customParameters?.mode === "demo";
        // For an outbound demo call, the visitor is the "to" number.
        if (this.demo) this.call = { sid: m.callSid, from: m.to, to: m.from };
        this.ready = (async () => {
          if (this.demo) return;
          try { const rec = await this.lookup(m.to); if (rec) this.member = { id: rec.id, profile: rec.profile }; } catch (e) { this.log("lookup failed", e?.message); }
        })();
        await this.ready;
        this.history.push({ role: "user", content: "(call connected)" }, { role: "assistant", content: this.member ? memberGreeting(this.member.profile) : greetingFor({ demo: this.demo }) });
        this.log("call started", m.callSid, this.demo ? "(demo)" : "");
        break;
      case "prompt": {
        await this.ready;
        const text = (m.voicePrompt ?? m.prompt ?? "").trim();
        if (m.last === false || !text) break; // partial transcript
        if (m.lang) this.lang = m.lang;
        await this.reply(text);
        break;
      }
      case "interrupt":
        this.onInterrupt(m.utteranceUntilInterrupt ?? "");
        break;
      case "dtmf":
        if (m.digit === "0") await this.reply("(caller pressed 0 to reach a person)");
        break;
      case "error":
        this.log("relay error", m.description);
        break;
    }
  }

  onInterrupt(heardText) {
    const cur = this.current;
    if (!cur) return;
    cur.ctrl.abort();
    this.current = null;
    const heard = (heardText || cur.spoken).trim();
    // Record only what the caller actually heard (append-only; the next user turn carries the note).
    this.history.push({ role: "assistant", content: heard ? heard + " …" : "…" });
    this.interruptedNote = heard;
    this.log("interrupted after:", JSON.stringify(heard));
  }

  async reply(userText) {
    // If the caller talked while Harbor was still generating, the old reply is stale.
    if (this.current) this.onInterrupt(this.current.spoken);

    const note = this.interruptedNote !== null
      ? `(You were interrupted. The caller only heard: "${this.interruptedNote}")\n` : "";
    const langTag = this.lang ? `(caller language: ${this.lang}) ` : "";
    this.interruptedNote = null;
    this.history.push({ role: "user", content: note + langTag + userText });

    const ctrl = new AbortController();
    const cur = (this.current = { ctrl, spoken: "" });
    const messages = this.history.map(h => ({ ...h }));
    let action = null;
    let buffer = "";
    const flush = (force) => {
      // Send at word boundaries so the TTS gets natural chunks.
      const i = force ? buffer.length : buffer.lastIndexOf(" ") + 1;
      if (i > 0) { const chunk = buffer.slice(0, i); buffer = buffer.slice(i); cur.spoken += chunk; this.speak(chunk, false); }
    };

    try {
      for (let round = 0; round < 4; round++) {
        const stream = this.client.beta.messages.stream(
          {
            model: "claude-opus-5-5",
            max_tokens: 2048,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low" },
            system: [{ type: "text", text: this.member
              ? buildSystem(this.member.profile, { channel: "voice" }) + "\n" + LIVE_VOICE_STYLE + "\n- Each caller message may start with a (caller language: xx) tag; reply in that language."
              : LIVE_SYSTEM + (this.demo ? DEMO_NOTE : ""), cache_control: { type: "ephemeral" } }],
            tools: this.member ? this.memberTools() : LIVE_TOOLS,
            messages,
          },
          { signal: ctrl.signal }
        );
        for await (const ev of stream) {
          if (ctrl.signal.aborted) return;
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            buffer += ev.delta.text.replace(/[*_#`]/g, "");
            flush(false);
          }
        }
        const msg = await stream.finalMessage();
        if (ctrl.signal.aborted) return;
        flush(true);

        if (msg.stop_reason === "refusal") { this.speak("Sorry, I can only help with plumbing stuff. What can I help you fix?", false); break; }
        if (msg.stop_reason === "max_tokens") break;
        const calls = msg.content.filter(b => b.type === "tool_use");
        if (msg.stop_reason !== "tool_use" || !calls.length) break;

        if (!cur.spoken.trim()) { this.speak("One sec. ", false); cur.spoken += "One sec. "; }
        messages.push({ role: "assistant", content: msg.content });
        const results = [];
        for (const c of calls) {
          if (!validInput(c.name, c.input, this.member ? this.memberTools() : TOOLS)) {
            results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "INVALID_INPUT: arguments incomplete or wrong type; ask the caller for any missing detail and try again." });
            continue;
          }
          let content = "ok";
          if (this.member && ["book", "take_message", "capture_sale"].includes(c.name)) {
            try { content = await this.memberAction(c.name, c.input); if (c.name !== "take_message") this.booked = true; }
            catch { content = "Couldn't save that right now. Tell the caller the team will follow up by text."; }
          } else if (c.name === "book_job") {
            try {
              content = this.demo ? await this.demoBooking(c.input) : await makeBooker({ from: this.call.from, to: this.call.to, callSid: this.call.sid })(c.input);
              this.booked = true;
            } catch { content = "Booking system unavailable. Tell the caller the office will text to confirm the time."; }
          } else if (c.name === "transfer_to_human") {
            action = { handoff: "transfer", reason: c.input.reason }; this.transferred = true;
            content = this.demo ? "Demo call: say that on a real call you'd connect them to the technician now." : "Transfer starts right after you finish speaking. Say you're connecting them now.";
          } else if (c.name === "end_call") {
            action = { handoff: "hangup" }; content = "Call ends after your goodbye.";
          }
          results.push({ type: "tool_result", tool_use_id: c.id, content });
        }
        messages.push({ role: "user", content: results });
      }
    } catch (err) {
      if (ctrl.signal.aborted || err?.name === "AbortError" || err instanceof Anthropic.APIUserAbortError) return;
      this.log("generation failed", err?.message);
      const sorry = "Sorry, I'm having a little trouble on my end. I'll have the office text you right away.";
      this.speak(sorry, false); cur.spoken += sorry;
    }

    if (this.current !== cur) return; // interrupted while finishing
    this.speak("", true);
    this.current = null;
    this.history.push({ role: "assistant", content: cur.spoken.trim() || "…" });

    if (action) {
      // Let the last sentence finish playing before handing off (~65 ms per character of speech).
      const wait = Math.min(8000, 900 + cur.spoken.length * 65);
      setTimeout(() => this.end(action), wait);
    }
  }

  memberTools() {
    return (this._memberTools ??= toolsFor(this.member.profile).map(t => ({ ...t, eager_input_streaming: true })));
  }

  /** A member's booking / message / sale: webhook to their tools, text the caller, alert the owner. */
  async memberAction(kind, x) {
    const p = this.member.profile, owner = p.owner_phone || ownerPhone;
    const callback = x.callback_number || x.contact || this.call.from;
    await postWebhook({ type: kind, business_id: this.member.id, company: p.company, call_sid: this.call.sid, caller: this.call.from, ...x, at: new Date().toISOString() });
    const jobs = [];
    if (kind === "book") {
      jobs.push(sendSms(this.call.to, callback, `${p.company}: you're booked for ${x.what} on ${x.when}. Reply here if anything changes.`));
      jobs.push(sendSms(this.call.to, owner, `NEW BOOKING: ${x.name}, ${x.what}, ${x.when}, ${callback}`));
    } else if (kind === "capture_sale") {
      jobs.push(sendSms(this.call.to, owner, `NEW SALE/LEAD: ${x.name} wants ${x.quantity} × ${x.product}. Contact: ${x.contact || callback}. ${x.notes || ""}`.trim()));
    } else {
      jobs.push(sendSms(this.call.to, owner, `${x.urgent ? "🚨 URGENT " : ""}MESSAGE from ${x.name} (${callback}): ${x.message}`));
    }
    await Promise.allSettled(jobs);
    return kind === "book" ? `Booked: ${x.what}, ${x.when}. Confirmation text sent.` : kind === "capture_sale" ? "Sale recorded. The team will confirm with the customer." : "Message passed to the team.";
  }

  /** Demo bookings don't touch a client's calendar: the visitor gets the confirmation text their customers would get. */
  async demoBooking(b) {
    await sendSms(this.call.to, this.call.from, `[Harbor demo] This is the text your customers get: "${business.company}: you're booked for ${b.problem} on ${b.day}, ${b.window}." Want this for your business? Reply YES.`);
    return `Demo booking confirmed for ${b.day}, ${b.window}. A sample confirmation text was sent.`;
  }

  end(action) {
    if (this.ended) return;
    this.ended = true;
    this.send({ type: "end", handoffData: JSON.stringify({ ...action, booked: this.booked, demo: this.demo, ...(this.member?.profile.owner_phone ? { owner: this.member.profile.owner_phone } : {}) }) });
  }

  async onClose() {
    this.current?.ctrl.abort();
    if (!this.call.from) return;
    const meta = { from: this.call.from, to: this.call.to, callSid: this.call.sid, booked: this.booked, demo: this.demo,
      ...(this.member ? { company: this.member.profile.company, owner: this.member.profile.owner_phone || ownerPhone, businessId: this.member.id } : {}) };
    const jobs = [this.summarize(this.history, meta).catch(e => this.log("summary failed", e?.message))];
    if (this.demo) {
      // Someone who tried the demo is a hot lead for Harbor itself.
      jobs.push(postWebhook({ type: "demo_lead", phone: this.call.from, booked_in_demo: this.booked, at: new Date().toISOString() }).catch(() => {}));
    } else if (!this.booked && !this.transferred) {
      // Missed-call text-back for live calls that ended without a booking.
      jobs.push(sendSms(this.call.to, this.call.from, `Hi, it's ${this.member?.profile.company || business.company}! Sorry we didn't get you booked on the call. Reply here with what you need and a good time, and we'll lock it in.`).catch(() => {}));
    }
    await Promise.allSettled(jobs);
  }
}

// ---------- HTTP + WebSocket server ----------
export function createServer({ client, summarize, lookup, log = console.log, skipSignature = process.env.VOICE_SKIP_SIGNATURE === "1" } = {}) {
  const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const token = process.env.TWILIO_AUTH_TOKEN;

  const server = http.createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200); return res.end("ok"); }
    if (req.method === "POST" && (req.url.startsWith("/twiml") || req.url.startsWith("/handoff"))) {
      let body = "";
      req.on("data", c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on("end", async () => {
        const params = Object.fromEntries(new URLSearchParams(body));
        const host = base() || `https://${req.headers.host}`;
        if (!skipSignature && !(token && twilio.validateRequest(token, req.headers["x-twilio-signature"] || "", host + req.url, params))) {
          res.writeHead(403); return res.end("Forbidden");
        }
        res.writeHead(200, { "Content-Type": "text/xml" });
        if (req.url.startsWith("/handoff")) return res.end(handoffTwiml(params));
        let rec = null;
        try { rec = await (lookup || businessForNumber)(params.To); } catch (e) { log("lookup failed", e?.message); }
        const p = rec?.profile;
        const owner = p?.owner_phone || ownerPhone;
        const vip = p ? (p.vip_numbers || []).some(n => n.replace(/\D/g, "") === String(params.From || "").replace(/\D/g, "")) && owner : isVip(params.From);
        if (vip) return res.end(vipTwiml(params.To, owner));
        res.end(relayTwiml(host.replace(/^http/, "ws") + "/relay", host + "/handoff", p ? { greeting: memberGreeting(p) } : {}));
      });
      return;
    }
    res.writeHead(404); res.end();
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!req.url.startsWith("/relay")) return socket.destroy();
    if (!skipSignature) {
      const url = (base() || `https://${req.headers.host}`).replace(/^http/, "ws") + req.url;
      const sig = req.headers["x-twilio-signature"];
      if (!token || !sig || !twilio.validateRequest(token, sig, url, {})) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n"); return socket.destroy();
      }
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const session = new CallSession(ws, { client, log, ...(summarize ? { summarize } : {}), ...(lookup ? { lookup } : {}) });
      ws.on("message", d => session.onMessage(d.toString()).catch(e => log("message error", e?.message)));
      ws.on("close", () => session.onClose().catch(() => {}));
    });
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, () => console.log(`Harbor live voice listening on :${PORT}`));
}
