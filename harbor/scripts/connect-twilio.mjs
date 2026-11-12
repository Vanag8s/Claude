// Connects a Twilio phone number to Harbor in one command.
//
//   TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... node scripts/connect-twilio.mjs \
//     --number +15550100 --voice https://harbor-live-voice.fly.dev --site https://yourdomain.com
//
// Sets: "A call comes in" → live voice server /twiml, "Primary handler fails" → classic line on the
// website (/api/voice/incoming), and clears the status callback (the live server sends text-backs itself).
// Add --dry-run to see what would change without changing anything.
import { createRequire } from "node:module";
const twilio = createRequire(import.meta.url)("twilio");

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const number = arg("number"), voice = arg("voice")?.replace(/\/$/, ""), site = arg("site")?.replace(/\/$/, "");
const dry = process.argv.includes("--dry-run");
const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = process.env;

const fail = m => { console.error("✗ " + m); process.exit(1); };
if (!sid || !token) fail("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (Twilio Console → Account → API keys & tokens).");
if (!number || !voice) fail("Usage: --number +15550100 --voice https://your-voice-server [--site https://your-site] [--dry-run]");
if (!/^https:\/\//.test(voice) || (site && !/^https:\/\//.test(site))) fail("Server addresses must start with https://");

const client = twilio(sid, token);
const [num] = await client.incomingPhoneNumbers.list({ phoneNumber: number, limit: 1 });
if (!num) fail(`${number} isn't a number on this Twilio account. Buy one in Twilio Console → Phone Numbers.`);

const update = {
  voiceUrl: `${voice}/twiml`, voiceMethod: "POST",
  voiceFallbackUrl: site ? `${site}/api/voice/incoming` : "", voiceFallbackMethod: "POST",
  statusCallback: "",
};
console.log(`Number:        ${num.phoneNumber} (${num.friendlyName})`);
console.log(`Calls go to:   ${update.voiceUrl}`);
console.log(`Backup line:   ${update.voiceFallbackUrl || "(none)"}`);
if (dry) { console.log("\nDry run: nothing changed."); process.exit(0); }
await client.incomingPhoneNumbers(num.sid).update(update);

// Quick health check of the voice server
try {
  const r = await fetch(`${voice}/health`);
  console.log(r.ok ? "✓ Voice server is up." : `! Voice server answered ${r.status}. Check it's deployed.`);
} catch { console.log("! Couldn't reach the voice server. Check it's deployed and the address is right."); }
console.log(`\n✓ Done. Call ${num.phoneNumber} to talk to Harbor.`);
console.log("Tip: save this number as \"Your Harbor phone number\" on /setup.html so calls answer as that business.");
