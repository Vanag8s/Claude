# Operations: Coast

A one-founder, self-serve SaaS. "Operations" is mostly product reliability, AI cost control, support and compliance.

## 1. The daily/weekly cycle (✱ = customer sees it)

1. Check overnight errors, AI-provider status, failed payments.
2. ✱ Answer support email/chat (target: same business day).
3. Review AI spend vs. subscribers (daily dashboard; alert above €X/account).
4. ✱ Onboard new trials: personal welcome note to each in the first 50 (manual on purpose — it's your best research).
5. Build/fix (the roadmap in `offer.md`: approval links → CSV export → example-post voice learning → team seats).
6. Weekly: churn/cancel reasons, trial→paid rate, edit-rate metric, invoices/VAT bookkeeping.

## 2. Suppliers (all need verification on their own pricing pages; nothing fetched from here)

| input | options | what to check |
| --- | --- | --- |
| AI model | Anthropic (Claude), OpenAI, Mistral (EU-based) | per-token price; **data-use/no-training terms**; EU data residency; quality in **Lithuanian** — test all three on the same 20 real briefs before choosing |
| App hosting | Bolt (current), Vercel, Netlify | plan price; custom domain; whether Bolt is fine for production or only prototyping |
| Database/auth | Supabase (current RLS suggests it), Neon | EU region; backups; Pro plan price |
| Payments | Stripe, Paddle, Lemon Squeezy | fees; **Paddle/Lemon Squeezy act as merchant of record and handle EU VAT for you** — worth it for a solo founder |
| Email | Google Workspace / Zoho + Postmark/Resend for transactional | price per seat; deliverability |

**Action:** the AI cost per request in `numbers.json` (€0.02) is an estimate. Read the real figure from your provider dashboard after 100 real requests and update `numbers.json`, then re-run `/founder-cfo`.

## 3. People

Year 1: founder only, ~20–40 h/week (assumption). Weekly rhythm: Mon–Tue build, Wed support + onboarding calls, Thu marketing, Fri metrics + bookkeeping. Outsource: an accountant (monthly, VAT/OSS), a Lithuanian native copy reviewer for voice-quality tests (paid per batch). No wages are in the CFO model — founder pay is €0 there; flag this to your accountant (Lithuanian self-employed social security/health contributions apply).

## 4. Routines (SOPs)

**A. New trial onboarding (10 min)** 1) Welcome email within 1 h. 2) Day 1: check they pasted example posts; if not, send a 2-line nudge. 3) Day 3: ask "which client did it nail / miss?". 4) Day 10: offer a 15-min call. 5) Day 14: convert or ask for the cancel reason (log it).

**B. Voice complaint** 1) Ask for the 3 worst drafts + what the client said. 2) Re-run with more example posts. 3) If still off, refund per the guarantee (no argument). 4) Log in the quality sheet.

**C. AI outage** 1) Status banner in-app. 2) Switch to fallback model if configured. 3) Email affected agencies with ETA.

**D. Weekly close** 1) Export Stripe/Paddle payouts → bookkeeping. 2) AI spend per account → flag top 5% users against fair-use. 3) Update the metrics sheet (trials, paid, churn, edit rate).

## 5. Tools (smallest stack)

Hosting + DB (Bolt/Supabase) · payments with merchant of record (Paddle or Lemon Squeezy) · Plausible or similar for privacy-friendly analytics · Crisp/email for support · a spreadsheet for metrics. Prices: verify on each vendor's page.

## 6. Licences, compliance, insurance (confirm each with the authority or a professional — not legal advice)

- [ ] Register a business in Lithuania: individual activity certificate or an MB (small partnership) — Registrų centras (https://www.registrucentras.lt) and VMI (https://www.vmi.lt).
- [ ] VAT: registration threshold and EU OSS for B2C digital services — VMI; or use a merchant of record.
- [ ] **GDPR:** you are a *processor* for your agencies' client data. Need: privacy policy, a Data Processing Agreement (DPA) template, a sub-processor list (AI provider, hosting), records of processing. Lithuanian DPA: VDAI (https://vdai.lrv.lt).
- [ ] **EU AI Act transparency:** check obligations for AI-generated content provided to users (Art. 50) — mostly on deployers, but say clearly in-app that drafts are AI-generated.
- [ ] Terms of service, refund policy matching the guarantee.
- [ ] Consumer-protection / unfair commercial practices: no fake reviews or unsourced claims (see `brand.md`).
- [ ] Professional/cyber liability insurance: get a quote.

## 7. Risk register

| # | risk | likely | bad | plan |
| --- | --- | --- | --- | --- |
| 1 | Nobody pays (panel: 0/20 on today's offer) | high | fatal | run the pilot test in `launch.md` before building more |
| 2 | ChatGPT/Claude add better per-client projects | high | high | differentiate on approvals + local language + workflow, not on "AI writes captions" |
| 3 | Heavy users blow AI costs ("unlimited") | medium | high | fair-use cap (~1,500 req/mo), per-account spend alert |
| 4 | Voice quality poor in Lithuanian | medium | high | test 3 models on 20 real LT briefs before launch |
| 5 | Data leak / RLS bug exposes client data | low | fatal | security review of RLS policies; backups; DPA |
| 6 | Unsourced testimonials trigger complaints | medium | high | remove them now |
| 7 | AI provider outage | medium | medium | fallback model |
| 8 | Founder burnout / single point of failure | medium | high | fixed weekly rhythm; documented SOPs |
| 9 | Bolt prototype limits at scale | medium | medium | plan migration path once >50 paid |
| 10 | Payment/VAT mistakes | medium | medium | merchant of record + accountant |
