// Vercel serverless function: receives audit requests from the site form.
// Set LEAD_WEBHOOK_URL (Zapier / Make / Slack incoming webhook / CRM) in project env vars.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: silently drop bots

  const lead = {
    name: String(b.name || "").trim().slice(0, 120),
    company: String(b.company || "").trim().slice(0, 160),
    email: String(b.email || "").trim().slice(0, 200),
    phone: String(b.phone || "").trim().slice(0, 40),
    trade: String(b.trade || "").trim().slice(0, 60),
    plan: String(b.plan || "").trim().slice(0, 20),
    consent: b.consent === "on" || b.consent === true,
    received_at: new Date().toISOString(),
  };
  if (lead.name.length < 2 || lead.company.length < 2 || !EMAIL.test(lead.email) || lead.phone.replace(/\D/g, "").length < 7 || !lead.trade || !lead.consent) {
    return res.status(422).json({ error: "Invalid submission" });
  }

  const hook = process.env.LEAD_WEBHOOK_URL;
  if (!hook) return res.status(503).json({ error: "Lead destination not configured" });
  try {
    const r = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `New Harbor audit request: ${lead.name} (${lead.company}, ${lead.trade}) ${lead.email} ${lead.phone}`, ...lead }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "Could not forward lead" });
  }
}
