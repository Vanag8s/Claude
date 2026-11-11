// A member business's receptionist, by chat. Used by the owner's test chat (a saved business or a draft profile).
// Tools run in "test mode": bookings, messages and sales are returned to the page instead of being sent anywhere.
import Anthropic from "@anthropic-ai/sdk";
import { getAI } from "./_lib/ai.js";
import { buildSystem, toolsFor, normalizeProfile } from "./_lib/profile.js";
import { getBusiness } from "./_lib/store.js";
import { limited, clientIp } from "./_lib/ratelimit.js";

let client;
export default async function handler(req, res, deps = {}) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (limited("assistant:" + clientIp(req), 120, 3600_000)) return res.status(429).json({ error: "Too many messages" });

  let profile = req.body?.profile;
  if (req.body?.business_id) {
    const rec = await (deps.getBusiness || getBusiness)(req.body.business_id);
    if (!rec) return res.status(404).json({ error: "Business not found" });
    profile = rec.profile;
  }
  if (!profile || typeof profile !== "object") return res.status(422).json({ error: "No business profile" });
  profile = normalizeProfile(profile);

  let messages = (Array.isArray(req.body?.messages) ? req.body.messages : [])
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-24).map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .reduce((acc, m) => { if (acc.length && acc.at(-1).role === m.role) acc.at(-1).content += "\n" + m.content; else acc.push({ ...m }); return acc; }, []);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") return res.status(400).json({ error: "No customer message" });

  const tools = toolsFor(profile);
  const actions = [];
  const spoken = [];
  try {
    const c = deps.anthropic || (client ??= getAI());
    for (let round = 0; round < 4; round++) {
      const r = await c.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 2048,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: buildSystem(profile, { channel: req.body?.via === "voice" ? "voice" : "chat" }), cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      });
      if (r.stop_reason === "refusal") { spoken.push("Sorry, I can't help with that one. Is there anything else about " + profile.company + " I can help with?"); break; }
      for (const b of r.content) if (b.type === "text" && b.text.trim()) spoken.push(b.text.trim());
      const calls = r.content.filter(b => b.type === "tool_use");
      if (r.stop_reason !== "tool_use" || !calls.length) break;
      messages.push({ role: "assistant", content: r.content });
      messages.push({ role: "user", content: calls.map(call => {
        actions.push({ type: call.name, details: call.input });
        const result = { book: "Booked (test mode). Confirm the details to the customer.", take_message: "Message saved for the team (test mode).", capture_sale: "Sale recorded (test mode). Thank the customer and confirm next steps.", transfer_to_human: "Test mode: say you'd connect them to the team now.", end_call: "Conversation ends after your goodbye." }[call.name] || "ok";
        return { type: "tool_result", tool_use_id: call.id, content: result };
      }) });
    }
    return res.status(200).json({ reply: spoken.join(" ").trim() || "Sorry, could you say that again?", actions });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Busy, try again" });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: "Upstream error" });
    return res.status(500).json({ error: "Server error" });
  }
}
