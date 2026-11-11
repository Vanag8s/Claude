// After-call summary: Claude turns the transcript into a short, structured note for the owner.
import Anthropic from "@anthropic-ai/sdk";
import { business } from "./receptionist.js";
import { sendSms, postWebhook, ownerPhone } from "./twilio.js";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    caller_name: { type: "string", description: "Caller's name, or empty string if not given" },
    reason: { type: "string", description: "What the caller needed, max 12 words" },
    urgent: { type: "boolean" },
    outcome: { type: "string", enum: ["booked", "transferred", "info_only", "needs_callback", "spam_or_wrong_number"] },
    follow_up: { type: "string", description: "What the owner should do next, max 15 words, or empty string" },
    summary: { type: "string", description: "2-3 sentence summary of the call" },
  },
  required: ["caller_name", "reason", "urgent", "outcome", "follow_up", "summary"],
};

let client;
export async function summarizeCall(history, { from, to, callSid, booked, demo }, { anthropic } = {}) {
  const transcript = history
    .filter(h => !h.content.startsWith("(call connected)"))
    .map(h => `${h.role === "user" ? "Caller" : "Harbor"}: ${h.content.replace(/^\(You were interrupted[^\n]*\n/, "")}`)
    .join("\n");
  if (!transcript.includes("Caller:")) return null;

  const c = anthropic || (client ??= new Anthropic());
  const res = await c.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: `You write short after-call notes for the owner of ${business.company}. Be factual; use only what is in the transcript.`,
    messages: [{ role: "user", content: `Call transcript (booked: ${booked ? "yes" : "no"}):\n\n${transcript}` }],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content.find(b => b.type === "text")?.text;
  if (!text) return null;
  const s = JSON.parse(text);

  const tag = s.urgent ? "🚨 URGENT · " : "";
  const line = `${tag}${s.caller_name || "Caller"} (${from}): ${s.reason}. ${s.outcome.replace(/_/g, " ")}.${s.follow_up ? " Next: " + s.follow_up : ""}`;
  await Promise.allSettled([
    postWebhook({ type: demo ? "demo_call_summary" : "call_summary", call_sid: callSid, caller: from, company: business.company, booked, ...s, transcript, at: new Date().toISOString() }),
    demo ? Promise.resolve() : sendSms(to, ownerPhone, line.slice(0, 320)),
  ]);
  return s;
}
