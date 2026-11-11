# Founder Review: Does this business pay off?

> No "founders" skill was installed in this workspace, so this review follows the same steps by hand.
> It uses a standard founder/investor checklist: problem pain, who pays, size of the market,
> competition, how you reach customers, unit economics, speed to first dollar and defensibility.
> Scores go from 1 to 5. A concept needs **≥ 32 / 40, with no score under 3** to pass.

## Round 1: "Coast 2.0", a general AI agency (chatbots + automations for any business)

| Criterion | Score | Why |
|---|---|---|
| Problem pain | 2 | "Add AI to your business" is a nice-to-have. Buyers can't say what pain it fixes. |
| Who pays | 2 | Owners don't know what they're buying, so you get long sales calls and lots of tire-kickers. |
| Market size | 4 | Huge on paper, but there's no focus. |
| Competition | 1 | Thousands of identical "AI agencies", freelancers on Fiverr and DIY tools. |
| Distribution | 2 | No clear place to find buyers. You'd be cold-pitching everyone. |
| Unit economics | 2 | Custom one-off builds bring ~$1–3k each, with no recurring revenue and lots of scope creep. |
| Time to first $ | 3 | Possible, but each deal is bespoke. |
| Defensibility | 1 | No niche data, no integrations, no brand. |
| **Total** | **17 / 40** | **❌ FAIL.** Generic, commoditized, and it's hard to say what the customer gets. |

**What's wrong:** a better website and a better bot can't fix a positioning problem. People buy
*outcomes in a niche* ("more booked jobs"), not "AI". So we pivoted before writing any code.

## Round 2 (built): Harbor, an AI front desk for home-service businesses

The offer is one specific outcome: *every call answered, every job booked.* It's a productized subscription
($297 / $597 / $1,197 per month), set up in 7 days, with a performance guarantee.

| Criterion | Score | Why |
|---|---|---|
| Problem pain | 5 | A missed call is a lost job worth $150–$15,000. Trades are on ladders and can't answer. The pain is daily, urgent and measurable. |
| Who pays | 5 | One recovered job ($450 average) pays for a month of Starter. The ROI calculator on the site shows this live. |
| Market size | 4 | Hundreds of thousands of US plumbing, HVAC, roofing and electrical shops, plus other trades and other countries. You only need ~170 Growth clients for $1.2M ARR. |
| Competition | 3 | Answering services and some AI receptionists exist. We win on niche focus, done-for-you setup, trade-specific emergency logic and the guarantee. |
| Distribution | 4 | The **free missed-call audit** is the hook: mystery-call 10 shops, send each one a report showing its own lost revenue, then close. There are also local Facebook trade groups, supply-house partnerships and referral loops. |
| Unit economics | 4 | Roughly $40–$120 per client per month in AI, telephony and hosting costs against $597 revenue, so **~80%+ gross margin**. Recurring revenue, low churn while it keeps booking jobs. |
| Time to first $ | 4 | The audit-to-close loop can land a first client in 1–2 weeks. The founding-client offer ($0 setup for the first 25) adds urgency. |
| Defensibility | 3 | Trade-specific prompts, calendar and ServiceTitan/Jobber integrations, conversation data and review flywheels make it harder to switch over time. |
| **Total** | **32 / 40** | **✅ PASS.** No score is under 3. |

### Why people will actually buy
1. **They see their own number.** The audit shows *their* missed calls and the ROI slider shows *their* lost revenue. Fear of loss sells.
2. **The risk is ours.** "10 extra jobs in 60 days or a full refund, and we keep working free."
3. **They try it before they're pitched.** The on-site bot runs a real booking flow (price → time slot → name → phone → address → confirmed).
4. **It's simple.** One 45-minute call, no contracts, keep your number.

### Biggest risks and how to handle them
| Risk | How to handle it |
|---|---|
| AI says something wrong to a customer | It only quotes from approved price ranges, sends emergencies to a human, keeps a log of every conversation, and has a weekly review in onboarding. |
| Rules for AI calls and texts (TCPA, recording-consent laws) | It says it's an AI up front, only replies to people who reached out first (no cold outreach), and gives a recording notice where required. Get a lawyer to review the Terms. |
| Guarantee abuse | The Terms define the bookings that count (made in the synced calendar) and require call forwarding to stay on. |
| Competition from bigger players | Stay narrow (trades), go deep on integrations, and be faster and more personal than horizontal tools. |

### 30-day launch plan
1. **Week 1:** Deploy the site. Set `ANTHROPIC_API_KEY`, `LEAD_WEBHOOK_URL` and the GA ID. Buy the domain. Run the find-and-replace for `harbor-ai.example`.
2. **Week 1–2:** Mystery-call 50 local trade businesses. Send 50 audit reports. Goal: book 10 demos.
3. **Week 2–3:** Close 3–5 founding clients on Growth ($597). Set up each one with a voice-AI and telephony provider, plus calendar sync.
4. **Week 4:** Turn the first results into case studies with permission. Raise the setup fee after client 25.

### Update: the voice AI is built
The phone receptionist (`api/voice/`) is now part of the product, not a promise. That changes two scores:
- **Defensibility 3 → 4:** it's a working, tested phone agent set up per client with a single config file. Most "AI agencies" can't deliver this.
- **Unit economics stays at 4:** about $60–$110/month to run per client against $597 (see `VOICE_SETUP.md`).

**New total: 33 / 40. ✅ PASS.**

**Target after 90 days:** 15 clients × $597 ≈ **$9k MRR**, ~80% gross margin.
