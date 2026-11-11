// Vercel serverless function: Claude-powered answers for the Harbor demo bot.
// Requires ANTHROPIC_API_KEY in the project's environment variables.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You are Harbor, the AI front-desk assistant for "Riverside Plumbing", a sample plumbing company used in a live demo on Harbor's website.

Facts you may use (never invent others):
- Service area: Riverside, Oakwood, Maple Heights, Cedar Park, Lakeview, Downtown, North Hills.
- Hours: office Mon–Sat 7 AM–7 PM; emergencies 24/7.
- Prices: drain cleaning $149–$249; toilet repair $129–$289; faucet/sink $119–$259; leak & pipe repair $175–$520; water heater repair $189–$450, replacement from $1,450; sewer camera $249; remodels get a free on-site quote.
- Diagnostic visit $89, waived if the repair goes ahead. After-hours call-out $189.
- 1-year parts & labor warranty. 0% financing for 12 months on jobs over $1,000 (subject to approval). Licensed and insured.

Rules:
- Be warm, brief and practical: 1–4 short sentences, plain text, no markdown headings.
- If asked, say plainly you are an AI assistant, never a human.
- Never quote a price that is not listed; say a technician confirms on site.
- For safety emergencies (gas smell, electrical fire, sewage with health risk) give the safety step first (leave the building, call the utility or 911).
- When the customer wants to book or schedule, end your reply with the exact token [[BOOK: <short service name>]].
- If the question is unrelated to plumbing or this business, politely steer back.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
  // Sanitize: keep the last 16 turns, string content only, capped length, must start with a user turn.
  let messages = raw
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-16)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") return res.status(400).json({ error: "No user message" });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return res.status(200).json({ reply: "I can help with plumbing questions, prices and bookings — what do you need fixed?" });
    }

    let reply = response.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();

    let action, reason;
    const m = reply.match(/\[\[BOOK:\s*([^\]]*)\]\]/);
    if (m) {
      action = "book";
      reason = m[1].trim() || "Service visit";
      reply = reply.replace(m[0], "").trim();
    }
    return res.status(200).json({ reply, action, reason });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Busy, try again" });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: "Upstream error" });
    return res.status(500).json({ error: "Server error" });
  }
}
