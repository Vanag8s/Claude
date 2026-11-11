// Harbor Live Voice: real-time, interruptible phone receptionist.
//
// Twilio ConversationRelay handles the audio (speech-to-text, ElevenLabs text-to-speech, barge-in,
// turn detection) and talks to this server over a WebSocket in plain text. We stream Claude's reply
// back token by token, so the caller hears it start almost immediately, and we stop instantly when
// the caller talks over it.
//
// Runs as a normal always-on Node service (Fly.io / Render / Railway). Vercel can't hold WebSockets.

import http from "node:http";
import { WebSocketServer } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";
import { business, SYSTEM, LIVE_VOICE_STYLE, TOOLS } from "../api/_lib/receptionist.js";
import { makeBooker } from "../api/_lib/booking.js";
import { sendSms, ownerPhone } from "../api/_lib/twilio.js";

const PORT = Number(process.env.PORT || 8080);
const LIVE_SYSTEM = SYSTEM + "\n" + LIVE_VOICE_STYLE;
// Eager input streaming on each client tool (streamed tool inputs); we validate inputs ourselves below.
const LIVE_TOOLS = TOOLS.map(t => ({ ...t, eager_input_streaming: true }));

export const greetingFor = () =>
  `Hi, thanks for calling ${business.company}! This is Harbor, the virtual assistant. How can I help?`;

/** TwiML that connects a call to this server. Served at POST /twiml, or by api/voice/incoming.js when VOICE_RELAY_URL is set. */
export function relayTwiml(wsUrl, actionUrl) {
  const vr = new twilio.twiml.VoiceResponse();
  const connect = vr.connect(actionUrl ? { action: actionUrl, method: "POST" } : {});
  connect.conversationRelay({
    url: wsUrl,
    welcomeGreeting: greetingFor(),
    welcomeGreetingInterruptible: "any",
    interruptible: "any",              // caller can talk over Harbor at any time
    interruptSensitivity: "medium",
    ignorebackchannel: "true",          // "yeah", "uh-huh" don't cut Harbor off
    turnDetection: true,                // smarter "are they done talking?" than plain silence
    echoPromptFiltering: true,          // don't transcribe Harbor's own voice
    preemptible: true,
    ttsProvider: business.live_voice?.tts_provider || "ElevenLabs",
    ...(business.live_voice?.voice ? { voice: business.live_voice.voice } : {}),
    elevenlabsTextNormalization: "on",
    transcriptionProvider: business.live_voice?.stt_provider || "Deepgram",
    speechModel: business.live_voice?.speech_model || "nova-3-general",
    asrSmartFormat: true,
    backgroundnoisereduction: "true",
    hints: [business.company, ...business.service_area, ...Object.keys(business.prices)].join(","),
    language: "en-US",
    dtmfDetection: true,
  });
  return vr.toString();
}

/** <Connect action> target: runs after the live session ends (transfer to a human, or hang up). */
export function handoffTwiml(params) {
  const vr = new twilio.twiml.VoiceResponse();
  let data = {};
  try { data = JSON.parse(params.HandoffData || "{}"); } catch {}
  if (data.handoff === "transfer" && ownerPhone) {
    const dial = vr.dial({ callerId: params.To, timeout: 25 });
    dial.number(ownerPhone);
    vr.say({ voice: business.voice }, "Sorry, nobody picked up. The technician will call you back within ten minutes.");
    sendSms(params.To, ownerPhone, `Missed transfer from ${params.From}: ${data.reason || "caller asked for a person"}. Call back ASAP.`).catch(() => {});
  } else if (data.handoff === "transfer") {
    vr.say({ voice: business.voice }, "I'll have the technician call you right back. Thanks for calling!");
  }
  vr.hangup();
  return vr.toString();
}

// ---------- Tool input validation (inputs stream unvalidated with eager_input_streaming) ----------
function validInput(tool, input) {
  const def = TOOLS.find(t => t.name === tool);
  if (!def || typeof input !== "object" || input === null) return false;
  const props = def.input_schema.properties;
  return def.input_schema.required.every(k => k in input && typeof input[k] === props[k].type);
}

// ---------- One live call ----------
export class CallSession {
  constructor(ws, { client = new Anthropic(), log = () => {} } = {}) {
    this.ws = ws;
    this.client = client;
    this.log = log;
    this.history = [];          // text-only turns, append-only (keeps the prompt cache warm)
    this.current = null;        // { ctrl, spoken } for the reply being streamed
    this.interruptedNote = null;
    this.booked = false;
    this.ended = false;
    this.call = {};
  }

  send(msg) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  speak(token, last) { this.send({ type: "text", token, last }); }

  async onMessage(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.type) {
      case "setup":
        this.call = { sid: m.callSid, from: m.from, to: m.to };
        this.history.push({ role: "user", content: "(call connected)" }, { role: "assistant", content: greetingFor() });
        this.log("call started", m.callSid);
        break;
      case "prompt": {
        const text = (m.voicePrompt ?? m.prompt ?? "").trim();
        if (m.last === false || !text) break; // partial transcript
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
    this.interruptedNote = null;
    this.history.push({ role: "user", content: note + userText });

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
            system: [{ type: "text", text: LIVE_SYSTEM, cache_control: { type: "ephemeral" } }],
            tools: LIVE_TOOLS,
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
          if (!validInput(c.name, c.input)) {
            results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "INVALID_INPUT: arguments incomplete or wrong type; ask the caller for any missing detail and try again." });
            continue;
          }
          let content = "ok";
          if (c.name === "book_job") {
            try { content = await makeBooker({ from: this.call.from, to: this.call.to, callSid: this.call.sid })(c.input); this.booked = true; }
            catch { content = "Booking system unavailable. Tell the caller the office will text to confirm the time."; }
          } else if (c.name === "transfer_to_human") {
            action = { handoff: "transfer", reason: c.input.reason }; content = "Transfer starts right after you finish speaking. Say you're connecting them now.";
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

  end(action) {
    if (this.ended) return;
    this.ended = true;
    this.send({ type: "end", handoffData: JSON.stringify({ ...action, booked: this.booked }) });
  }

  async onClose() {
    this.current?.ctrl.abort();
    if (this.booked || !this.call.from) return;
    // Missed-call text-back for live calls that ended without a booking.
    const said = this.history.filter(h => h.role === "user" && !h.content.startsWith("(")).map(h => h.content.replace(/^\(You were interrupted[^\n]*\n/, "")).join(" / ").slice(0, 300);
    await Promise.allSettled([
      sendSms(this.call.to, this.call.from, `Hi, it's ${business.company}! Sorry we didn't get you booked on the call. Reply here with what you need and a good time, and we'll lock it in.`),
      sendSms(this.call.to, ownerPhone, `Unbooked call from ${this.call.from}${said ? `: "${said}"` : " (hung up early)"}. Harbor texted them back.`),
    ]);
  }
}

// ---------- HTTP + WebSocket server ----------
export function createServer({ client, log = console.log, skipSignature = process.env.VOICE_SKIP_SIGNATURE === "1" } = {}) {
  const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const token = process.env.TWILIO_AUTH_TOKEN;

  const server = http.createServer((req, res) => {
    if (req.url === "/health") { res.writeHead(200); return res.end("ok"); }
    if (req.method === "POST" && (req.url.startsWith("/twiml") || req.url.startsWith("/handoff"))) {
      let body = "";
      req.on("data", c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on("end", () => {
        const params = Object.fromEntries(new URLSearchParams(body));
        const host = base() || `https://${req.headers.host}`;
        if (!skipSignature && !(token && twilio.validateRequest(token, req.headers["x-twilio-signature"] || "", host + req.url, params))) {
          res.writeHead(403); return res.end("Forbidden");
        }
        res.writeHead(200, { "Content-Type": "text/xml" });
        if (req.url.startsWith("/twiml")) return res.end(relayTwiml(host.replace(/^http/, "ws") + "/relay", host + "/handoff"));
        res.end(handoffTwiml(params));
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
      const session = new CallSession(ws, { client, log });
      ws.on("message", d => session.onMessage(d.toString()).catch(e => log("message error", e?.message)));
      ws.on("close", () => session.onClose().catch(() => {}));
    });
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, () => console.log(`Harbor live voice listening on :${PORT}`));
}
