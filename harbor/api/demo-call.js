// "Harbor calls you in 10 seconds": the website demo places a real outbound call to the visitor,
// connected to the live voice server in demo mode.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, DEMO_FROM_NUMBER (a Twilio number), LIVE_VOICE_URL (https://your-voice-server),
//      DEMO_ALLOWED_PREFIXES (comma list, default "+1").
import twilio from "twilio";
import { relayTwiml } from "./_lib/relay-twiml.js";
import { limited, clientIp } from "./_lib/ratelimit.js";

export function normalizePhone(raw) {
  const s = String(raw || "").trim();
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;          // US/CA local format
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return digits ? "+" + digits : "";
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  if (!(b.consent === true || b.consent === "on")) return res.status(422).json({ error: "Please confirm we may call you." });

  const to = normalizePhone(b.phone);
  const prefixes = (process.env.DEMO_ALLOWED_PREFIXES || "+1").split(",").map(p => p.trim()).filter(Boolean);
  if (!/^\+\d{8,15}$/.test(to) || !prefixes.some(p => to.startsWith(p))) {
    return res.status(422).json({ error: `Enter a valid mobile number (${prefixes.join(", ")}).` });
  }
  const ip = clientIp(req);
  if (limited("ip:" + ip, 3, 3600_000) || limited("to:" + to, 2, 86_400_000)) {
    return res.status(429).json({ error: "You've already had a demo call recently. Try the chat demo, or book an audit!" });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, DEMO_FROM_NUMBER, LIVE_VOICE_URL } = process.env;
  const client = deps.twilioClient || (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null);
  if (!client || !DEMO_FROM_NUMBER || !LIVE_VOICE_URL) return res.status(503).json({ error: "Phone demo isn't switched on yet. Try the chat demo above!" });

  const base = LIVE_VOICE_URL.replace(/\/$/, "");
  try {
    const call = await client.calls.create({
      to,
      from: DEMO_FROM_NUMBER,
      twiml: relayTwiml(base.replace(/^http/, "ws") + "/relay", base + "/handoff", { demo: true }),
      timeLimit: 180,                 // demo calls end after 3 minutes
      machineDetection: "Enable",     // don't waste a demo on voicemail
    });
    return res.status(200).json({ ok: true, sid: call.sid });
  } catch (err) {
    console.error("demo call failed", err?.message);
    return res.status(502).json({ error: "Couldn't place the call. Double-check the number and try again." });
  }
}
