// Drives the live voice server over a real WebSocket, the way Twilio ConversationRelay does,
// with a scripted streaming stand-in for Claude. Checks streaming, barge-in, booking, hang-up and text-back.
process.env.OWNER_PHONE = "+15550111";
process.env.TWILIO_AUTH_TOKEN = "test-token";
import { createRequire } from "node:module";
const { WebSocket } = createRequire(import.meta.url)("ws");
const { createServer, handoffTwiml } = await import("../voice-server/server.js");

const results = []; const ok = (n, c) => { results.push(!!c); process.stdout.write(`${c ? "✓" : "✗"} ${n}\n`); };
const logs = []; console.log = (...a) => logs.push(a.join(" "));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Scripted streaming model ----
let script = []; const seen = [];
function fakeStream(params, { signal }) {
  seen.push(params);
  const step = script.shift() || { text: "Okay.", stop: "end_turn" };
  const words = (step.text || "").split(/(?<= )/);
  const content = [];
  if (step.text) content.push({ type: "text", text: step.text });
  if (step.tool) content.push({ type: "tool_use", id: "tu_" + seen.length, name: step.tool, input: step.input });
  return {
    async *[Symbol.asyncIterator]() {
      for (const w of words) {
        await sleep(step.delay ?? 5);
        if (signal.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
        yield { type: "content_block_delta", delta: { type: "text_delta", text: w } };
      }
    },
    finalMessage: async () => ({ stop_reason: step.stop, content }),
  };
}
const client = { beta: { messages: { stream: fakeStream } } };

const summaries = []; const summarize = async (h, meta) => { summaries.push({ h, meta }); };
const server = createServer({ client, summarize, log: (...a) => logs.push(a.join(" ")), skipSignature: true }).listen(0);
const port = server.address().port;
const open = () => new Promise(res => {
  const ws = new WebSocket(`ws://localhost:${port}/relay`); const got = [];
  ws.on("message", d => got.push(JSON.parse(d)));
  ws.on("open", () => { ws.send(JSON.stringify({ type: "setup", callSid: "CA" + Math.random(), from: "+15550100", to: "+15550199" })); res({ ws, got }); });
});
const say = (ws, t) => ws.send(JSON.stringify({ type: "prompt", voicePrompt: t, last: true }));
const spoken = got => got.filter(m => m.type === "text").map(m => m.token).join("");

try {
  // 1) TwiML
  const tw = await fetch(`http://localhost:${port}/twiml`, { method: "POST", headers: { host: "voice.example.com" } }).then(r => r.text());
  ok("TwiML connects ConversationRelay with barge-in + ElevenLabs", /<ConversationRelay[^>]*interruptible="any"/.test(tw) && tw.includes('ttsProvider="ElevenLabs"') && tw.includes('ignorebackchannel="true"') && tw.includes('turnDetection="true"'));
  ok("TwiML hands off to /handoff after the session", /action="https:\/\/[^"]+\/handoff"/.test(tw));

  // 2) Streaming reply
  let { ws, got } = await open();
  script = [{ text: "Oh no, okay. Is the water still running right now?", stop: "end_turn" }];
  const t0 = Date.now(); say(ws, "My water heater is leaking"); 
  while (!got.some(m => m.type === "text")) await sleep(2);
  const firstTokenMs = Date.now() - t0;
  await sleep(200);
  const textMsgs = got.filter(m => m.type === "text");
  ok(`Streams the reply in chunks (${textMsgs.length - 1} chunks, first after ${firstTokenMs}ms)`, textMsgs.length > 4 && textMsgs.at(-1).last === true);
  ok("Speaks exactly what Claude wrote", spoken(got).trim() === "Oh no, okay. Is the water still running right now?");
  ok("Uses Opus 5.5, streaming, live-voice style prompt", seen[0].model === "claude-opus-5-5" && seen[0].system[0].text.includes("Live-call style"));

  // 3) Barge-in
  got.length = 0;
  script = [{ text: "So what I'd recommend is turning off the cold water supply valve on top of the tank and then also switching off the power or gas to the unit so it doesn't overheat while we get someone out to you.", stop: "end_turn", delay: 25 },
            { text: "Got it, it's already off. What's your name?", stop: "end_turn" }];
  say(ws, "Yeah it's still going");
  await sleep(150);
  const heard = spoken(got);
  ws.send(JSON.stringify({ type: "interrupt", utteranceUntilInterrupt: heard, durationUntilInterruptMs: 900 }));
  await sleep(150);
  const afterInterrupt = got.length;
  await sleep(300);
  ok("Stops talking the instant the caller interrupts", got.length === afterInterrupt && !spoken(got).includes("overheat"));
  say(ws, "I already turned it off");
  await sleep(250);
  const lastReq = seen.at(-1).messages;
  ok("Remembers only what the caller heard before interrupting", lastReq.at(-2).role === "assistant" && lastReq.at(-2).content.startsWith(heard.trim()) && !lastReq.at(-2).content.includes("overheat"));
  ok("Tells Claude it was interrupted", lastReq.at(-1).content.includes("You were interrupted") && lastReq.at(-1).content.endsWith("I already turned it off"));
  ok("History alternates user/assistant correctly", lastReq.every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant")));

  // 4) Booking with tool use
  got.length = 0; logs.length = 0;
  const booking = { name: "Jane Doe", address: "12 Elm Street, Oakwood", problem: "Leaking water heater", day: "tomorrow", window: "8 AM to 10 AM", urgent: false, callback_number: "" };
  script = [{ text: "Okay, let me lock that in. ", stop: "tool_use", tool: "book_job", input: booking },
            { text: "You're all set for tomorrow between eight and ten. I just texted you a confirmation.", stop: "end_turn" }];
  say(ws, "Jane Doe, twelve Elm Street in Oakwood, tomorrow morning");
  await sleep(400);
  ok("Fills the gap while booking, then confirms", spoken(got).startsWith("Okay, let me lock that in.") && spoken(got).includes("You're all set"));
  ok("Booking texts caller + owner and posts webhook", logs.filter(l => l.includes("[sms:dry-run]")).length === 2 && logs.some(l => l.includes("[webhook:dry-run]")));
  ok("Sends tool_result back to Claude", seen.at(-1).messages.at(-1).content[0].type === "tool_result");

  // 5) Invalid tool input is rejected, not executed
  logs.length = 0;
  script = [{ text: "Let me book that. ", stop: "tool_use", tool: "book_job", input: { name: "Bob" } }, { text: "Sorry, what's the address?", stop: "end_turn" }];
  say(ws, "book me in"); await sleep(300);
  ok("Rejects incomplete tool input safely", !logs.some(l => l.includes("[webhook:dry-run]")) && seen.at(-1).messages.at(-1).content[0].is_error === true);

  // 6) Goodbye -> end session with handoff data
  got.length = 0;
  script = [{ text: "Thanks Jane, have a good one!", stop: "tool_use", tool: "end_call", input: {} }, { text: "", stop: "end_turn" }];
  say(ws, "That's all, thanks");
  await sleep(3200);
  const end = got.find(m => m.type === "end");
  ok("Says goodbye, then ends the session", spoken(got).includes("have a good one") && end && JSON.parse(end.handoffData).handoff === "hangup" && JSON.parse(end.handoffData).booked === true);
  ws.close(); await sleep(100);
  ok("No 'missed you' text after a booked call", !logs.some(l => l.includes("didn't get you booked")));

  // 7) Hang up without booking -> text-back
  ({ ws, got } = await open()); logs.length = 0;
  script = [{ text: "Sure, what area are you in?", stop: "end_turn" }];
  say(ws, "How much is a drain cleaning"); await sleep(200);
  ws.close(); await sleep(150);
  ok("Missed-call text-back when caller hangs up unbooked", logs.filter(l => l.includes("[sms:dry-run]") && l.includes("didn't get you booked")).length === 1);
  ok("After-call summary runs with the transcript", summaries.at(-1)?.meta.booked === false && summaries.at(-1).h.some(x => x.content.includes("drain cleaning")));

  // 8) Model failure -> graceful line
  ({ ws, got } = await open());
  const orig = client.beta.messages.stream;
  client.beta.messages.stream = () => ({ async *[Symbol.asyncIterator]() { throw new Error("overloaded"); }, finalMessage: async () => ({}) });
  say(ws, "hello?"); await sleep(150);
  ok("Graceful fallback line if the AI fails", spoken(got).includes("trouble on my end") && got.at(-1).last === true);
  client.beta.messages.stream = orig; ws.close();

  // 8b) Caller language is passed to Claude
  ({ ws, got } = await open());
  script = [{ text: "¡Claro! ¿En qué zona está?", stop: "end_turn" }];
  ws.send(JSON.stringify({ type: "prompt", voicePrompt: "Hola, necesito un plomero", lang: "es", last: true })); await sleep(150);
  ok("Passes the caller's detected language to Claude", seen.at(-1).messages.at(-1).content.startsWith("(caller language: es)") && seen.at(-1).system[0].text.includes("Reply in the language"));
  ws.close();

  // 8c) Website demo call: simulated booking, lead captured, no client texts
  logs.length = 0;
  const dws = new WebSocket(`ws://localhost:${port}/relay`); const dgot = [];
  dws.on("message", d => dgot.push(JSON.parse(d)));
  await new Promise(r => dws.on("open", r));
  dws.send(JSON.stringify({ type: "setup", callSid: "CADEMO", from: "+15550199", to: "+15550177", customParameters: { mode: "demo" } }));
  script = [{ text: "Okay, booking that. ", stop: "tool_use", tool: "book_job", input: booking }, { text: "Done!", stop: "end_turn" }];
  say(dws, "book me for tomorrow"); await sleep(300);
  ok("Demo call uses the demo prompt", seen.at(-1).system[0].text.includes("DEMO requested from Harbor's website"));
  ok("Demo booking texts the visitor a sample confirmation", logs.some(l => l.includes("-> +15550177") && l.includes("[Harbor demo]")) && !logs.some(l => l.includes("[webhook:dry-run]") && l.includes('"type":"booking"')));
  dws.close(); await sleep(150);
  ok("Demo caller is captured as a Harbor lead", logs.some(l => l.includes('"type":"demo_lead"') && l.includes("+15550177")));

  // 8d) Call to a member business's number answers as that business
  const { EXAMPLE_WATERPARK } = await import("../api/_lib/profile.js");
  const memberSrv = createServer({ client, summarize, lookup: async n => (String(n).endsWith("0123") ? { id: "biz1", profile: { ...EXAMPLE_WATERPARK, owner_phone: "+15550999" } } : null), log() {}, skipSignature: true }).listen(0);
  const mport = memberSrv.address().port;
  const mtw = await fetch(`http://localhost:${mport}/twiml`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "To=%2B15550123&From=%2B15550100" }).then(r => r.text());
  ok("Member number gets its own greeting", mtw.includes("thanks for calling Lagoon Bay Waterpark"));
  const mws = new WebSocket(`ws://localhost:${mport}/relay`); const mgot = [];
  mws.on("message", d => mgot.push(JSON.parse(d)));
  await new Promise(r => mws.on("open", r));
  mws.send(JSON.stringify({ type: "setup", callSid: "CAM", from: "+15550100", to: "+15550123" }));
  logs.length = 0;
  script = [{ text: "Kids aged 14 and 15 can come without an adult with a student ID. ", stop: "tool_use", tool: "capture_sale", input: { name: "Ona", product: "Day ticket, child", quantity: "1", contact: "+15550100", notes: "" } }, { text: "All set!", stop: "end_turn" }];
  say(mws, "Can my 14 year old come alone? And I want a ticket for him");
  await sleep(400);
  ok("Live call uses the member's facts and sales tools", seen.at(-1).system[0].text.includes("Lagoon Bay Waterpark") && seen.at(-1).tools.some(t => t.name === "capture_sale"));
  ok("Sale alert goes to the member's own phone", logs.some(l => l.includes("-> +15550999") && l.includes("NEW SALE")));
  mws.close(); memberSrv.close();

  // 9) Handoff TwiML
  ok("Transfer handoff dials the owner", handoffTwiml({ HandoffData: JSON.stringify({ handoff: "transfer", reason: "flooding" }), To: "+15550199", From: "+15550100" }).includes("<Number>+15550111</Number>"));
  ok("Hang-up handoff hangs up", handoffTwiml({ HandoffData: JSON.stringify({ handoff: "hangup" }) }).includes("<Hangup/>"));

  ok("Demo transfer doesn't ring the client", !handoffTwiml({ HandoffData: JSON.stringify({ handoff: "transfer", demo: true }) }).includes("<Dial"));
  const { relayTwiml } = await import("../voice-server/server.js");
  ok("Demo TwiML marks the session as demo", relayTwiml("wss://x/relay", "https://x/handoff", { demo: true }).includes('<Parameter name="mode" value="demo"/>'));

  // 10) Unsigned WebSocket rejected when signatures are on
  const secure = createServer({ client, log() {}, skipSignature: false }).listen(0);
  const rejected = await new Promise(r => { const w = new WebSocket(`ws://localhost:${secure.address().port}/relay`); w.on("open", () => r(false)); w.on("error", () => r(true)); w.on("unexpected-response", () => r(true)); });
  ok("Rejects WebSocket connections not signed by Twilio", rejected);
  secure.close();
} finally { server.close(); }

const failed = results.filter(x => !x).length;
process.stdout.write(failed ? `\n${failed} live-voice check(s) failed\n` : `\n✓ All ${results.length} live-voice checks passed\n`);
process.exit(failed ? 1 : 0);
