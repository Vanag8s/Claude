// Shared booking side effects for both voice modes: webhook + confirmation text + owner alert.
import { business } from "./receptionist.js";
import { sendSms, postWebhook, ownerPhone } from "./twilio.js";

export function makeBooker({ from, to, callSid }) {
  return async b => {
    const when = `${b.day}, ${b.window}`;
    const callback = b.callback_number || from;
    await postWebhook({ type: "booking", call_sid: callSid, caller: from, ...b, callback, company: business.company, at: new Date().toISOString() });
    await Promise.allSettled([
      sendSms(to, callback, `${business.company}: you're booked for ${b.problem} on ${when} at ${b.address}. Reply C to change. ${business.fees}`),
      sendSms(to, ownerPhone, `NEW JOB${b.urgent ? " (URGENT)" : ""}: ${b.name}, ${b.problem}, ${when}, ${b.address}, ${callback}`),
    ]);
    return `Booked for ${when}. Confirmation text sent to ${callback}.`;
  };
}
