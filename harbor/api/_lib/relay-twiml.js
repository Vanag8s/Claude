// TwiML for live (ConversationRelay) calls, shared by the voice server and the website's "call me" demo.
import twilio from "twilio";
import { business } from "./receptionist.js";
import { sendSms, ownerPhone } from "./twilio.js";

const lv = business.live_voice || {};

export const greetingFor = ({ demo = false } = {}) => demo
  ? `Hi! This is Harbor, the AI receptionist you asked to hear on our website. For this demo, pretend you're a customer calling ${business.company}. Ask me anything, interrupt me, or try booking a job. Go ahead!`
  : `Hi, thanks for calling ${business.company}! This is Harbor, the virtual assistant. How can I help?`;

/**
 * @param {string} wsUrl  wss:// URL of the voice server's /relay
 * @param {string} [actionUrl]  where Twilio posts after the session ends (/handoff)
 * @param {{demo?: boolean, from?: string}} [opts]
 */
/** Which TTS provider + voice to use for a woman's or man's voice. */
export function phoneVoice(gender) {
  if (lv.voice) return { ttsProvider: lv.tts_provider || "ElevenLabs", voice: lv.voice };
  const g = gender === "male" ? "male" : gender === "female" ? "female" : (lv.voice_gender || "female");
  const v = lv.voices?.[g];
  return v ? { ttsProvider: v.tts_provider, voice: v.voice } : { ttsProvider: lv.tts_provider || "ElevenLabs" };
}

export function relayTwiml(wsUrl, actionUrl, { demo = false, greeting = null, voiceGender = null } = {}) {
  const vr = new twilio.twiml.VoiceResponse();
  const connect = vr.connect(actionUrl ? { action: actionUrl, method: "POST" } : {});
  const multi = !!lv.multilingual;
  const relay = connect.conversationRelay({
    url: wsUrl,
    welcomeGreeting: greeting || greetingFor({ demo }),
    welcomeGreetingInterruptible: "any",
    interruptible: "any",              // caller can talk over Harbor at any time
    interruptSensitivity: "medium",
    ignorebackchannel: "true",          // "yeah", "uh-huh" don't cut Harbor off
    turnDetection: true,                // smarter "are they done talking?" than plain silence
    echoPromptFiltering: true,          // don't transcribe Harbor's own voice
    preemptible: true,
    // Auto language detection ("multi") requires Deepgram STT + ElevenLabs TTS.
    ...(multi ? { ttsProvider: "ElevenLabs", ...(lv.voice ? { voice: lv.voice } : {}) } : phoneVoice(voiceGender)),
    elevenlabsTextNormalization: "on",
    transcriptionProvider: multi ? "Deepgram" : (lv.stt_provider || "Deepgram"),
    speechModel: lv.speech_model || "nova-3-general",
    asrSmartFormat: true,
    backgroundnoisereduction: "true",
    hints: [business.company, ...business.service_area, ...Object.keys(business.prices)].join(","),
    language: multi ? "multi" : (lv.language || "en-US"),
    dtmfDetection: true,
  });
  relay.parameter({ name: "mode", value: demo ? "demo" : "live" });
  return vr.toString();
}

/** Numbers that should never reach the AI (family, suppliers, VIPs): ring the owner directly. */
export function vipTwiml(to, owner = ownerPhone) {
  const vr = new twilio.twiml.VoiceResponse();
  const dial = vr.dial({ callerId: to, timeout: 30 });
  dial.number(owner);
  return vr.toString();
}
export const isVip = from => (business.vip_numbers || []).some(n => n.replace(/\D/g, "") === String(from || "").replace(/\D/g, "")) && !!ownerPhone;

/** <Connect action> target: runs after the live session ends (transfer to a human, or hang up). */
export function handoffTwiml(params) {
  const vr = new twilio.twiml.VoiceResponse();
  let data = {};
  try { data = JSON.parse(params.HandoffData || "{}"); } catch {}
  const owner = (typeof data.owner === "string" && /^\+?\d{7,15}$/.test(data.owner)) ? data.owner : ownerPhone;
  if (data.handoff === "transfer" && owner && !data.demo) {
    const dial = vr.dial({ callerId: params.To, timeout: 25 });
    dial.number(owner);
    vr.say({ voice: business.voice }, "Sorry, nobody picked up. The technician will call you back within ten minutes.");
    sendSms(params.To, owner, `Missed transfer from ${params.From}: ${data.reason || "caller asked for a person"}. Call back ASAP.`).catch(() => {});
  } else if (data.handoff === "transfer") {
    vr.say({ voice: business.voice }, data.demo
      ? "In a real call, I'd connect you to the on-call technician right now. Thanks for trying Harbor!"
      : "I'll have the technician call you right back. Thanks for calling!");
  }
  vr.hangup();
  return vr.toString();
}
