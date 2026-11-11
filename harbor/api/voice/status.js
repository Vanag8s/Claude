// Twilio call status callback (set "Call status changes" URL on the number to this endpoint).
// When a call ends without a booking, Harbor texts the caller back and alerts the owner: the missed-call text-back.
import { business } from "../_lib/receptionist.js";
import { verify, loadState, sendSms, ownerPhone } from "../_lib/twilio.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!verify(req, res)) return;
  const { CallStatus, From, To } = req.body;
  if (["completed", "no-answer", "busy", "failed", "canceled"].includes(CallStatus)) {
    const state = loadState(req);
    const known = state.history.length > 0;
    if (!known && From) {
      // State lost (e.g. cold start): send a neutral follow-up rather than guess.
      await sendSms(To, From, `Thanks for calling ${business.company}! If you still need anything, just reply to this text.`).catch(() => {});
    } else if (!state.booked && From) {
      const said = state.history.filter(m => m.role === "user" && !m.content.startsWith("(")).map(m => m.content).join(" / ").slice(0, 300);
      await Promise.allSettled([
        sendSms(To, From, `Hi, it's ${business.company}! Sorry we didn't get you booked on the call. Reply here with what you need and a good time, and we'll lock it in.`),
        sendSms(To, ownerPhone, `Unbooked call from ${From}${said ? `: "${said}"` : " (hung up early)"}. Harbor texted them back.`),
      ]);
    }
  }
  res.status(204).end();
}
