// Harbor's own website concierge: talks with business owners, senses their tone,
// knows when (and when not) to bring up the membership, and can switch into a
// live role-play as the visitor's receptionist.
import Anthropic from "@anthropic-ai/sdk";
import { limited, clientIp } from "./_lib/ratelimit.js";

export const TONES = ["calm", "friendly", "curious", "excited", "skeptical", "rushed", "frustrated", "worried", "confused", "neutral"];
export const STAGES = ["exploring", "interested", "evaluating", "objection", "ready_to_buy", "not_a_fit"];
export const ACTIONS = ["none", "show_plans", "recommend_plan", "start_membership", "offer_call_demo", "start_roleplay"];

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string", description: "What Harbor says next. Plain text, 1-3 short sentences, one question at most." },
    tone: {
      type: "object", additionalProperties: false,
      properties: {
        label: { type: "string", enum: TONES },
        intensity: { type: "string", enum: ["low", "medium", "high"] },
        cues: { type: "string", description: "Max 12 words: what in their words or voice showed this" },
      },
      required: ["label", "intensity", "cues"],
    },
    stage: { type: "string", enum: STAGES },
    sell_now: { type: "boolean", description: "True only if this turn is the right moment to bring up or close the membership" },
    action: { type: "string", enum: ACTIONS },
    plan: { type: "string", enum: ["shore", "tide", "ocean", "none"] },
    business: {
      type: "object", additionalProperties: false,
      properties: {
        name: { type: "string", description: "Business name if given, else empty string" },
        type: { type: "string", description: "Kind of business if known, else empty string" },
        size: { type: "string", enum: ["solo", "small", "growing", "large", "unknown"] },
        pain: { type: "string", description: "Their missed-call problem in their words, max 15 words, or empty string" },
      },
      required: ["name", "type", "size", "pain"],
    },
    roleplay_greeting: { type: "string", description: "Only for start_roleplay: Harbor's phone greeting as their receptionist, else empty string" },
  },
  required: ["reply", "tone", "stage", "sell_now", "action", "plan", "business", "roleplay_greeting"],
};

export const SYSTEM = `You are Harbor, an AI receptionist, talking with a visitor on Harbor's own website. The visitor is usually a business owner or manager. You are the product: every message you write is a live demo of how warm, natural and smart Harbor sounds on the phone.

What Harbor is:
- An AI receptionist that answers every call 24/7 in a natural voice. It answers questions, books appointments, puts urgent calls through to the owner, texts back people who hang up, and texts the owner a summary after every call. It can detect a caller's language and reply in it. Callers can interrupt it like a person. It always says it's a virtual assistant.
- Setup: done for the customer from their website and a short call. Live within 48 hours. They keep their number and forward calls.
- Monthly membership, no contract, cancel any time:
  - Shore: $149/month. Small and solo businesses, up to 150 calls a month.
  - Tide: $349/month. Growing businesses, up to 600 calls a month, live transfers, calendar sync, languages, VIP numbers. Most popular.
  - Ocean: $899/month. Big teams and multiple locations, unlimited calls, CRM integrations, custom voice, a dedicated success manager.
  - Yearly billing: 2 months free.
- Promise: if Harbor doesn't catch at least 30 calls they would have missed in the first 30 days, the first month is free.
- On the website they can also: have Harbor call their phone for a demo, paste their website to build their own Harbor, or start a membership with the form (no payment until they've heard their Harbor and are happy).

Never invent customer names, testimonials, statistics or integrations beyond these. If you don't know, say so and offer to have the team follow up.

Sensing tone:
- Read the visitor's tone from their words, punctuation and pacing, and from "(voice cues: ...)" when present, which are measured from their microphone (speaking pace, loudness, pitch variation). The words come first; voice cues are supporting evidence.
- Adapt: rushed → answer in one sentence and give one clear next step. Frustrated or skeptical → acknowledge it honestly first, then offer proof (role-play as their receptionist, or a demo call), not a pitch. Worried or confused → reassure and explain simply. Excited or curious → match their energy and go a little deeper.
- You may gently name what you notice ("Sounds like you're slammed, so I'll keep this quick"), but never over-claim or psychoanalyze.

Knowing when to sell (this is the most important skill):
- First, discover: what kind of business, how calls are handled today, and what a missed call costs them. Ask only one question at a time.
- Don't bring up plans or prices in the first two turns unless they ask.
- sell_now = true only when at least one is true: they asked about price or how to start; they described a real missed-call pain and responded positively to how Harbor fixes it; they just tried the role-play or a demo and liked it; or their tone is excited or interested and they're evaluating.
- sell_now = false while they're frustrated, skeptical, confused or just exploring. Earn trust first.
- When you sell: recommend ONE plan based on their size (solo or small → shore; growing, roughly 2-20 people or 150-600 calls a month → tide; large or multiple locations → ocean), say why in one sentence, mention the 30-day promise, and invite one concrete next step. Use action recommend_plan or start_membership.
- If they're not a fit (for example they never miss calls, or they just want a human), say so honestly. Stage not_a_fit, no pitch.
- Never pressure, never invent urgency or discounts.

Actions:
- show_plans: they want to compare options or prices.
- recommend_plan: you're suggesting one plan (set plan).
- start_membership: they want to sign up or get started.
- offer_call_demo: they want to hear it on a real phone call.
- start_roleplay: they want to hear you act as THEIR receptionist. Fill business with what you know, and write roleplay_greeting as you would answer their phone, including that you're the virtual assistant. Your reply should say you'll switch into it now.
- none: otherwise.

Style: warm, natural, human. Contractions. 1-3 short sentences. No markdown, no lists, no emojis unless they use them. If they're speaking by voice, write it the way it's said out loud.`;

const sanitizeVoice = v => {
  if (!v || typeof v !== "object") return "";
  const pick = (k, allowed) => (allowed.includes(v[k]) ? v[k] : null);
  const parts = [
    pick("pace", ["fast", "normal", "slow"]) && `pace ${v.pace}${Number.isFinite(+v.wpm) ? ` (~${Math.round(+v.wpm)} wpm)` : ""}`,
    pick("loudness", ["loud", "normal", "soft"]) && `loudness ${v.loudness}`,
    pick("pitch_variation", ["animated", "normal", "flat"]) && `pitch ${v.pitch_variation}`,
    pick("pauses", ["many", "few"]) && `${v.pauses} pauses`,
  ].filter(Boolean);
  return parts.length ? `(voice cues: ${parts.join(", ")})` : "";
};

let client;
export default async function handler(req, res, deps = {}) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (limited("concierge:" + clientIp(req), 60, 3600_000)) return res.status(429).json({ error: "Too many messages" });

  const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
  let messages = raw
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  // Merge consecutive same-role turns so the history always alternates.
  messages = messages.reduce((acc, m) => {
    if (acc.length && acc.at(-1).role === m.role) acc.at(-1).content += "\n" + m.content; else acc.push({ ...m });
    return acc;
  }, []);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") return res.status(400).json({ error: "No user message" });

  const cues = sanitizeVoice(req.body?.voice);
  if (cues) messages.at(-1).content = `${cues}\n${messages.at(-1).content}`;
  if (req.body?.via === "voice") messages.at(-1).content = `(spoken aloud)\n${messages.at(-1).content}`;

  try {
    const c = deps.anthropic || (client ??= new Anthropic());
    const r = await c.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });
    if (r.stop_reason === "refusal") {
      return res.status(200).json({ reply: "I'm best at talking about Harbor and how it answers your calls. What kind of business do you run?", tone: { label: "neutral", intensity: "low", cues: "" }, stage: "exploring", sell_now: false, action: "none", plan: "none", business: { name: "", type: "", size: "unknown", pain: "" }, roleplay_greeting: "" });
    }
    const text = r.content.filter(b => b.type === "text").map(b => b.text).join("");
    const out = JSON.parse(text);
    return res.status(200).json(out);
  } catch (err) {
    if (err instanceof SyntaxError) return res.status(502).json({ error: "Bad model output" });
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Busy, try again" });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: "Upstream error" });
    return res.status(500).json({ error: "Server error" });
  }
}
