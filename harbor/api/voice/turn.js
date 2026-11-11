// Twilio <Gather> action: receives what the caller said, asks Claude, speaks the reply, listens again.
import { business, runTurn } from "../_lib/receptionist.js";
import { VoiceResponse, verify, loadState, saveState, sendSms, postWebhook, ownerPhone } from "../_lib/twilio.js";

const listen = (vr, text) => {
  const g = vr.gather({ input: "speech", action: "/api/voice/turn", method: "POST", speechTimeout: "auto", speechModel: "phone_call", enhanced: true, language: "en-US", actionOnEmptyResult: true });
  g.say({ voice: business.voice }, text);
};

export default async function handler(req, res, deps = {}) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  if (!verify(req, res)) return;

  const { SpeechResult = "", From, To, CallSid } = req.body;
  const state = loadState(req);
  const vr = new VoiceResponse();
  const done = () => { saveState(res, state); res.setHeader("Content-Type", "text/xml"); res.status(200).send(vr.toString()); };

  const heard = SpeechResult.trim();
  if (!heard) {
    state.silences++;
    if (state.silences >= 2) {
      vr.say({ voice: business.voice }, "I'm having trouble hearing you. I'll text you so we can book you in. Goodbye!");
      vr.hangup();
    } else listen(vr, "Sorry, I didn't catch that. How can I help?");
    return done();
  }
  state.silences = 0;
  state.spoke = true;
  state.history.push({ role: "user", content: heard });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 11000); // Twilio waits 15s for a webhook
  let turn;
  try {
    turn = await runTurn(state.history, {
      onBook: async b => {
        const when = `${b.day}, ${b.window}`;
        const callback = b.callback_number || From;
        await postWebhook({ type: "booking", call_sid: CallSid, caller: From, ...b, callback, company: business.company, at: new Date().toISOString() });
        await Promise.allSettled([
          sendSms(To, callback, `${business.company}: you're booked for ${b.problem} on ${when} at ${b.address}. Reply C to change. ${business.fees}`),
          sendSms(To, ownerPhone, `NEW JOB${b.urgent ? " (URGENT)" : ""}: ${b.name}, ${b.problem}, ${when}, ${b.address}, ${callback}`),
        ]);
        state.booked = true;
        return `Booked for ${when}. Confirmation text sent to ${callback}.`;
      },
    }, { signal: ctrl.signal, client: deps.client });
  } catch (err) {
    console.error("voice turn failed", err?.message);
    turn = { say: "Sorry, I'm having a little trouble on my end. I'll have the office text you right away to get you booked. Is there anything urgent I should pass on?" };
  } finally {
    clearTimeout(timer);
  }

  state.history.push({ role: "assistant", content: turn.say });

  if (turn.transfer && ownerPhone) {
    vr.say({ voice: business.voice }, turn.say);
    const dial = vr.dial({ callerId: To, timeout: 25 });
    dial.number(ownerPhone);
    vr.say({ voice: business.voice }, "Sorry, nobody picked up. The technician will call you back within 10 minutes.");
    sendSms(To, ownerPhone, `Missed transfer from ${From}: ${turn.transfer}. Call back ASAP.`).catch(() => {});
  } else if (turn.hangup) {
    vr.say({ voice: business.voice }, turn.say);
    vr.hangup();
  } else {
    listen(vr, turn.say);
  }
  return done();
}
