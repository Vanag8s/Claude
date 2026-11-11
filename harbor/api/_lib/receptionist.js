// Shared brain for the Harbor phone receptionist: one Claude turn with booking / transfer / hang-up tools.
// Files under api/_lib are not exposed as routes on Vercel.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

export const business = JSON.parse(
  readFileSync(new URL("../../config/business.json", import.meta.url), "utf8")
);

const priceList = Object.entries(business.prices).map(([k, v]) => `- ${k}: ${v}`).join("\n");

export const SYSTEM = `You are Harbor, the AI phone receptionist for ${business.company}, a ${business.trade} company. You are speaking on a live phone call: your words are converted to speech.

Business facts (never invent others):
- Service area: ${business.service_area.join(", ")}.
- Hours: ${business.hours}
- Prices:
${priceList}
- Fees: ${business.fees}
- Policies: ${business.policies}
- Booking windows offered: ${business.booking_windows.join(", ")}, Monday to Saturday.

How to talk on the phone:
- Speak like a friendly, efficient front-desk person. One or two short sentences per turn, then one question. No lists, no emojis, no markdown, no URLs.
- Say prices the way a person would ("about one forty-nine to two forty-nine").
- If asked, say plainly you are an AI assistant. Never claim to be human.
- Never quote a price that is not listed; say a technician confirms on site.
- Safety first: for a gas smell tell them to leave the building and call the gas company or 911 from outside. For flooding, tell them to shut off the main water valve.

Booking: collect, one at a time, the problem, their name, the service address, and a preferred day and window. The caller's phone number is already known, so don't ask for it unless they want a different one. Read the details back once, then call book_job. After it succeeds, confirm and tell them a text confirmation is on its way.
Call transfer_to_human for a real emergency that needs a technician now, or when the caller insists on a person.
Call end_call once the caller has nothing else, after saying a short goodbye in the same turn.`;

// Extra rules for the real-time (streaming, interruptible) voice line.
export const LIVE_VOICE_STYLE = `
Live-call style (this matters most):
- Sound like a warm, relaxed human receptionist, not a script. Use contractions and quick natural acknowledgments ("Oh no, okay.", "Got it.", "Sure thing.") before getting to the point.
- Keep every turn to one or two short sentences. Start with the most useful words first, because the caller can cut you off at any moment.
- Ask only one question at a time. Never list options longer than two.
- Write everything the way it's spoken: "one forty-nine", "eight to ten in the morning", "twelve Elm Street". No symbols, digits-with-dashes, abbreviations or emojis.
- If a message says you were interrupted, the caller only heard the part shown. Don't repeat it; respond to what they just said.
- If the caller's words look garbled or cut off, ask them to repeat it, casually ("Sorry, you cut out for a sec, what was that?").
- Before you use a tool, say a few words first so there's no dead air ("Okay, let me lock that in.").
- Read the caller's mood from their words and how they're phrased, and adapt like a good receptionist: stressed or in pain → calm, reassuring, get them help fast; rushed → shortest possible answers; angry → acknowledge first, don't argue, offer to put them through; chatty → be warm but keep it moving; confused → slow down and use simpler words.`;

export const TOOLS = [
  {
    name: "book_job",
    description: "Book a service visit in the company calendar once name, address, problem and time window are confirmed with the caller.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Caller's full name" },
        address: { type: "string", description: "Service address including area" },
        problem: { type: "string", description: "Short description of the job" },
        day: { type: "string", description: "Requested day, e.g. 'Tuesday' or 'tomorrow'" },
        window: { type: "string", description: "One of the offered booking windows" },
        urgent: { type: "boolean", description: "True if this is an emergency" },
        callback_number: { type: "string", description: "Different callback number if the caller gave one, else empty string" }
      },
      required: ["name", "address", "problem", "day", "window", "urgent", "callback_number"]
    }
  },
  {
    name: "transfer_to_human",
    description: "Transfer the live call to the on-call technician or office.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: { reason: { type: "string" } },
      required: ["reason"]
    }
  },
  {
    name: "end_call",
    description: "Hang up after the goodbye has been said.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, properties: {}, required: [] }
  }
];

let defaultClient;
const getClient = () => (defaultClient ??= new Anthropic());

/**
 * Runs one caller turn.
 * @param {{role:'user'|'assistant', content:string}[]} history  text-only conversation so far, ending with the caller's words
 * @param {{ onBook:(input)=>Promise<string> }} actions
 * @returns {Promise<{ say:string, booked?:object, transfer?:string, hangup?:boolean }>}
 */
export async function runTurn(history, actions, { client = getClient(), signal } = {}) {
  const messages = history.map(m => ({ role: m.role, content: m.content }));
  const out = { say: "" };
  const spoken = [];

  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create(
      {
        model: "claude-opus-5-5",
        max_tokens: 1024,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      },
      { signal }
    );

    if (response.stop_reason === "refusal") {
      spoken.push("Sorry, I can only help with plumbing questions and bookings. What can I help you fix?");
      break;
    }

    for (const b of response.content) if (b.type === "text" && b.text.trim()) spoken.push(b.text.trim());
    const calls = response.content.filter(b => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || !calls.length) break;

    messages.push({ role: "assistant", content: response.content });
    const results = [];
    for (const call of calls) {
      let result = "ok";
      if (call.name === "book_job") {
        try {
          result = await actions.onBook(call.input);
          out.booked = call.input;
        } catch {
          result = "Booking system unavailable. Tell the caller the office will text to confirm the time.";
        }
      } else if (call.name === "transfer_to_human") {
        out.transfer = call.input.reason || "caller request";
        result = "Transfer will start right after you speak. Tell the caller you're connecting them now.";
      } else if (call.name === "end_call") {
        out.hangup = true;
        result = "Call will end after your goodbye.";
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: result });
    }
    messages.push({ role: "user", content: results });
    // A transfer or hang-up only needs the closing sentence already spoken (or one more short turn).
    if ((out.transfer || out.hangup) && spoken.length) break;
  }

  out.say = spoken.join(" ").replace(/[*_#`]/g, "").trim()
    || (out.transfer ? "Connecting you now, please hold." : out.hangup ? "Thanks for calling, goodbye!" : "Sorry, could you say that again?");
  return out;
}
