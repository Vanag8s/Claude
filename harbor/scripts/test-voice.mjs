// Simulates a full phone call against the voice webhooks with a scripted stand-in for Claude.
process.env.VOICE_SKIP_SIGNATURE = "1";
process.env.OWNER_PHONE = "+15550111";
const { default: incoming } = await import("../api/voice/incoming.js");
const { default: turn } = await import("../api/voice/turn.js");
const { default: status } = await import("../api/voice/status.js");

const results = []; const ok = (n, c) => { results.push(!!c); process.stdout.write(`${c ? "✓" : "✗"} ${n}\n`); };
const logs = []; const origLog = console.log; console.log = (...a) => { logs.push(a.join(" ")); };

let cookie = "";
const call = async (h, body, deps) => {
  const res = { headers: {}, code: 0, body: "", status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k] = v; }, send(b) { this.body = b; }, end() {} };
  await h({ method: "POST", url: "/api/voice/x", headers: { cookie, host: "test" }, body: { CallSid: "CA1", From: "+15550100", To: "+15550199", ...body } }, res, deps);
  if (res.headers["Set-Cookie"]) cookie = res.headers["Set-Cookie"].split(";")[0];
  return res;
};

// Scripted model: reply, then call book_job, then confirm, then end_call.
const script = [
  { stop_reason: "end_turn", content: [{ type: "text", text: "Oh no, sorry to hear that. Can I get your name?" }] },
  { stop_reason: "tool_use", content: [{ type: "text", text: "Perfect, booking that now." }, { type: "tool_use", id: "t1", name: "book_job", input: { name: "Jane Doe", address: "12 Elm St, Oakwood", problem: "Leaking water heater", day: "tomorrow", window: "8 AM to 10 AM", urgent: false, callback_number: "" } }] },
  { stop_reason: "end_turn", content: [{ type: "text", text: "You're all set for tomorrow between 8 and 10. A text is on its way." }] },
  { stop_reason: "tool_use", content: [{ type: "text", text: "Thanks Jane, goodbye!" }, { type: "tool_use", id: "t2", name: "end_call", input: {} }] },
];
const seen = [];
const client = { beta: { messages: { create: async p => { seen.push(p); return script.shift(); } } } };

const r0 = await call(incoming, {});
ok("Answers with greeting + AI disclosure", r0.body.includes("<Gather") && r0.body.includes("virtual assistant"));
const r1 = await call(turn, { SpeechResult: "My water heater is leaking" }, { client });
ok("Speaks Claude's reply and listens again", r1.body.includes("Can I get your name") && r1.body.includes("<Gather"));
ok("Sends conversation history to Claude", seen[0].messages.at(-1).content === "My water heater is leaking");
ok("Uses Opus 5.5 with tools", seen[0].model === "claude-opus-5-5" && seen[0].tools.length === 3);
const r2 = await call(turn, { SpeechResult: "Jane Doe, 12 Elm Street Oakwood, tomorrow morning" }, { client });
ok("Books the job via tool and confirms", r2.body.includes("You're all set"));
ok("Returns tool_result to Claude", seen[2].messages.at(-1).content[0].type === "tool_result");
ok("Texts caller + owner + posts booking webhook", logs.some(l => l.includes("[sms:dry-run]") && l.includes("you're booked")) && logs.some(l => l.includes("[webhook:dry-run]")));
const r3 = await call(turn, { SpeechResult: "No that's all, thanks" }, { client });
ok("Says goodbye and hangs up", r3.body.includes("goodbye") && r3.body.includes("<Hangup"));
logs.length = 0;
await call(status, { CallStatus: "completed" });
ok("No 'missed you' text after a booked call", !logs.some(l => l.includes("didn't get you booked")));

// Second call: caller hangs up without booking -> text-back
cookie = "";
await call(incoming, { CallSid: "CA2" });
const failing = { beta: { messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "What's the address?" }] }) } } };
await call(turn, { CallSid: "CA2", SpeechResult: "How much for a drain" }, { client: failing });
logs.length = 0;
await call(status, { CallSid: "CA2", CallStatus: "completed" });
ok("Missed-call text-back sent to caller + owner alert", logs.filter(l => l.includes("[sms:dry-run]")).length === 2);

// Silence handling + API failure fallback
cookie = "";
await call(incoming, { CallSid: "CA3" });
const s1 = await call(turn, { CallSid: "CA3", SpeechResult: "" });
const s2 = await call(turn, { CallSid: "CA3", SpeechResult: "" });
ok("Re-prompts once on silence, then ends politely", s1.body.includes("didn't catch") && s2.body.includes("<Hangup"));
cookie = "";
await call(incoming, { CallSid: "CA4" });
const boom = { beta: { messages: { create: async () => { throw new Error("down"); } } } };
const f = await call(turn, { CallSid: "CA4", SpeechResult: "hello" }, { client: boom });
ok("Graceful fallback if AI is down", f.code === 200 && f.body.includes("trouble on my end"));

console.log = origLog;
const failed = results.filter(x => !x).length;
console.log(failed ? `\n${failed} voice check(s) failed` : `\n✓ All ${results.length} voice checks passed`);
process.exit(failed ? 1 : 0);
