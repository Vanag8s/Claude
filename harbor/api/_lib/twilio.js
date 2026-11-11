// Twilio helpers: request signature check, call-state cookie, SMS, booking webhook.
import twilio from "twilio";

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, OWNER_PHONE, BOOKING_WEBHOOK_URL, LEAD_WEBHOOK_URL, PUBLIC_BASE_URL } = process.env;
export const VoiceResponse = twilio.twiml.VoiceResponse;

const sms = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

export function publicUrl(req) {
  const base = PUBLIC_BASE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  return base.replace(/\/$/, "") + req.url;
}

/** Rejects requests that were not signed by Twilio. VOICE_SKIP_SIGNATURE=1 is for local tests only. */
export function verify(req, res) {
  if (process.env.VOICE_SKIP_SIGNATURE === "1") return true;
  const sig = req.headers["x-twilio-signature"];
  if (!TWILIO_AUTH_TOKEN || !sig || !twilio.validateRequest(TWILIO_AUTH_TOKEN, sig, publicUrl(req), req.body || {})) {
    res.status(403).send("Forbidden");
    return false;
  }
  return true;
}

// Call state lives in a cookie (Twilio keeps cookies for the length of one call) with an in-memory cache.
const mem = new Map();
const COOKIE = "harbor_call";
export function loadState(req) {
  const sid = req.body?.CallSid;
  if (sid && mem.has(sid)) return mem.get(sid);
  const raw = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith(COOKIE + "="));
  if (raw) {
    try {
      const s = JSON.parse(Buffer.from(raw.slice(COOKIE.length + 1), "base64url").toString());
      if (s.sid === sid) return s;
    } catch {}
  }
  return { sid, history: [], silences: 0, booked: false, spoke: false };
}
export function saveState(res, state) {
  // Keep the cookie under ~3.5 KB: last 10 turns, each capped.
  state.history = state.history.slice(-10).map(m => ({ role: m.role, content: m.content.slice(0, 280) }));
  while (state.history.length && state.history[0].role !== "user") state.history.shift();
  if (state.sid) {
    mem.set(state.sid, state);
    if (mem.size > 500) mem.delete(mem.keys().next().value);
  }
  const v = Buffer.from(JSON.stringify(state)).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE}=${v}; Path=/api/voice; HttpOnly; Secure; SameSite=None; Max-Age=3600`);
}

export async function sendSms(from, to, body) {
  if (!to) return;
  if (!sms) { console.log(`[sms:dry-run] ${from} -> ${to}: ${body}`); return; }
  await sms.messages.create({ from, to, body });
}

export async function postWebhook(payload) {
  const url = BOOKING_WEBHOOK_URL || LEAD_WEBHOOK_URL;
  if (!url) { console.log("[webhook:dry-run]", JSON.stringify(payload)); return; }
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error("webhook " + r.status);
}

export const ownerPhone = OWNER_PHONE;
