// Makes your phone ring and Harbor speaks to you in its real phone voices (one-way demo; no server needed).
//
//   TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... node scripts/ring-me.mjs --to +370... --from +1...
//
//   --to     your own phone (on a Twilio trial it must be a verified number)
//   --from   your Twilio phone number
//   --voice  woman | man | both (default both)
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };
const to = arg("to"), from = arg("from"), which = arg("voice") || "both";
const fail = m => { console.error("✗ " + m); process.exit(1); };
if (!/^\+\d{8,15}$/.test(to || "") || !/^\+\d{8,15}$/.test(from || "")) fail("Use --to +<your phone> --from +<your Twilio number>, in +countrycode format.");

const user = process.env.TWILIO_ACCOUNT_SID || "AC_from_proxy", pass = process.env.TWILIO_AUTH_TOKEN || "token_from_proxy";
const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const api = (path, init = {}) => fetch(`https://api.twilio.com/2010-04-01${path}`, { ...init, headers: { Authorization: auth, ...(init.headers || {}) } });

let sid = process.env.TWILIO_ACCOUNT_SID;
if (!sid) {
  const r = await api("/Accounts.json?PageSize=1");
  if (!r.ok) fail(`Twilio refused the credentials (${r.status}). Check the Account SID and Auth Token.`);
  sid = (await r.json()).accounts?.[0]?.sid;
}
const esc = t => t.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const woman = "Google.en-US-Chirp3-HD-Aoede", man = "Google.en-US-Chirp3-HD-Charon";
const lines = [
  [woman, "Hi! This is Harbor, your AI receptionist. This is the voice your customers will hear when they call."],
  [woman, "For example: Thanks for calling Lagoon Bay Waterpark! We're open Saturdays from nine in the morning until ten at night. Kids who are fourteen or fifteen can come without an adult, they just need a student ID. And for a family of four, the family ticket is seventy nine dollars. Shall I save one for you?"],
  [man, "And this is my other voice. Thanks for calling Lagoon Bay Waterpark, this is Harbor, the virtual assistant. How can I help you today?"],
  [woman, "On a real call, you can talk back and interrupt me, just like a person. Thanks for listening, and talk soon!"],
].filter(([v]) => which === "both" || (which === "man" ? v === man : v === woman));
const twiml = `<Response><Pause length="1"/>${lines.map(([v, t]) => `<Say voice="${v}">${esc(t)}</Say><Pause length="1"/>`).join("")}</Response>`;

const body = new URLSearchParams({ To: to, From: from, Twiml: twiml, Timeout: "30" });
const r = await api(`/Accounts/${sid}/Calls.json`, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
const j = await r.json().catch(() => ({}));
if (!r.ok) fail(`Twilio said: ${j.message || r.status}${j.code === 21219 ? " (on a trial, verify your phone first: Twilio Console → Phone Numbers → Verified Caller IDs)" : ""}`);
console.log(`✓ Calling ${to} now (call ${j.sid}). Pick up! On a trial account, press any key when Twilio's trial message plays.`);
