# CFO's note (read this first)

All amounts are **euros** (the tool prints `$`). In this model a "day" is a **month** and a "unit" is **one paying subscriber**, so "18 a day" means 18 paying subscribers. Every input is an estimate or assumption (see `cfo-sources.md`); the founder supplied no costs.

- **The margin:** each subscriber-month leaves **€22.24 (82%)** after AI, card and hosting costs, at a blended €27.20 (new Solo €15 / Studio €29 / Agency €59 ladder, assumed mix 45/40/15). Software margins are fine; **volume is the whole question.**
- **Break-even: 18 paying subscribers.** Year 1 on the assumed ramp (2 → 40 subscribers): **€422 operating profit, −€2,028 after startup costs**, cash needed **€3,662**. Not earned back in year 1.
- **The line to watch: subscribers (the ramp).** The buyer panel bought **0 of 20, twice**, so *the ramp has no evidence behind it.* Half the ramp → year 1 **−€2,069** (−€4,519 after startup). Second line: **the €300/month marketing budget** is 79% of fixed costs.
- **AI cost:** if real AI cost is 3× the estimate (€12 instead of €4 per subscriber — plausible for heavy Agency users), contribution falls to €14.24 and break-even rises to 27. Measure it in week 1. A fair-use cap (~1,500 requests) protects this.
- **Three ways to improve it (each run through the tool):**
  1. **Cut paid marketing to €0 until a pilot proves demand** → break-even **4 subscribers**, year 1 **€4,022**. Founder-led outreach costs time, not cash.
  2. **Raise the blended price to €35** (e.g. more agencies on Studio/Agency) → break-even **13**, year 1 **€2,169**.
  3. **Don't drop to €19 blended** → break-even **28**, year 1 **−€1,415**. The low price only works with far more customers.
- **Board's money conditions:** AI cost per request — still an estimate, **not met**. Fair-use cap — added to the offer, **met on paper**. Positive margin per tier — met, *if* AI cost is near the estimate.
- **Founder pay is €0 in this model.** Any salary pushes break-even up by (salary ÷ €22.24) subscribers — e.g. €1,500/month needs ~67 more subscribers.

Not financial, tax or legal advice: have an accountant check the structure, VAT (EU B2B reverse charge / OSS), and Lithuanian self-employment contributions before money moves.

---

# Unit economics: Coast (AI content workspace for social media agencies) - one 'day' here = one month; units = paying subscribers; amounts are EUR (the tool prints $)

Every number below comes from the input file. Nothing is looked up or guessed.

## One subscriber-month

| line | per subscriber-month |
| --- | ---: |
| Price | $27.20 |
| AI model usage per subscriber-month (ESTIMATE: ~200 requests x ~EUR 0.02) | -$4.00 |
| Card / merchant-of-record fees (ESTIMATE ~1.5% + EUR 0.25 on EUR 27.20; a merchant of record like Paddle costs more, ~5%) | -$0.66 |
| Marginal hosting/database per subscriber (ESTIMATE) | -$0.30 |
| **Contribution** (what each subscriber-month leaves to pay the fixed costs) | **$22.24** (82%) |

## The margin that matters

Fixed costs: $380 a month (App hosting / Bolt plan (ESTIMATE) $25, Database/auth plan, e.g. Supabase Pro (ESTIMATE) $25, Domain + business email (ESTIMATE) $10, Other SaaS tools (ESTIMATE) $20, Always-on marketing budget (ASSUMPTION - founder to set) $300, Founder salary (NOT INCLUDED - unknown; set to 0) $0).

- **Break-even: 18 subscriber-months a day.** Below that you lose money every month.
- **Profit margin at your plan** (40 a day): **47%** of every sale, after every cost.

## Year 1, month by month

| month | subscriber-months a day | revenue | profit | cumulative (after $2,450 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | $54 | -$336 | -$2,786 |
| 2 | 4 | $109 | -$291 | -$3,077 |
| 3 | 6 | $163 | -$247 | -$3,323 |
| 4 | 9 | $245 | -$180 | -$3,503 |
| 5 | 12 | $326 | -$113 | -$3,616 |
| 6 | 15 | $408 | -$46 | -$3,662 |
| 7 | 19 | $517 | $43 | -$3,620 |
| 8 | 23 | $626 | $132 | -$3,488 |
| 9 | 27 | $734 | $220 | -$3,268 |
| 10 | 31 | $843 | $309 | -$2,958 |
| 11 | 36 | $979 | $421 | -$2,538 |
| 12 | 40 | $1,088 | $510 | -$2,028 |

- **Year 1 operating profit: $422** on $6,093 of revenue.
- After the $2,450 startup spend: -$2,028.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$3,662**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 47% | 18 | $422 |
| Price -10% | 41% | 20 | -$188 |
| Volume -20% | 38% | 18 | -$575 |
| Unit costs +15% | 44% | 18 | $255 |

## Red flags

- The startup spend is not earned back within year 1.
