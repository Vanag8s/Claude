// Twilio "A call comes in" webhook. Point your Twilio number's Voice URL here (HTTP POST).
import { business } from "../_lib/receptionist.js";
import { VoiceResponse, verify, saveState } from "../_lib/twilio.js";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!verify(req, res)) return;

  const greeting = `Thanks for calling ${business.company}. This is Harbor, the virtual assistant. This call may be recorded for quality. How can I help you today?`;
  const state = { sid: req.body.CallSid, history: [{ role: "user", content: "(call connected)" }, { role: "assistant", content: greeting }], silences: 0, booked: false, spoke: false };
  saveState(res, state);

  const vr = new VoiceResponse();
  const g = vr.gather({ input: "speech", action: "/api/voice/turn", method: "POST", speechTimeout: "auto", speechModel: "phone_call", enhanced: true, language: "en-US", actionOnEmptyResult: true });
  g.say({ voice: business.voice }, greeting);
  vr.redirect({ method: "POST" }, "/api/voice/turn");
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(vr.toString());
}
