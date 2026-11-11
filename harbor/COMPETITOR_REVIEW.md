# Competitor review: Fireflies Voice Agents vs atsiliepsiu.lt ("Agnė")

Reviewed on November 11, 2026, from each site's live page and code.

## What they are
| | **Fireflies AI Voice Agents** (fireflies.ai/voice-agents) | **atsiliepsiu.lt: Agnė** |
|---|---|---|
| Who it's for | Big teams: recruiting screens, sales discovery, lead qualification, user research | Lithuanian solo operators and small businesses: tradespeople, salons, clinics, auto shops, restaurants |
| What it does | Runs structured calls via a shared link, then writes notes and scorecards and syncs them to your CRM or recruiting software | Answers your phone in Lithuanian, takes a message, emails you a summary |
| Price on page | ✗ No ("Get started free" / "Request demo") | ✗ No: "you'll see the exact price when you register" |
| Try it | ✗ No live demo on the page | ✅ Enter your number and Agnė calls you in 10 s, ✅ a demo number to call, ✅ a talk-in-browser demo |
| Trust | ✅✅ Very strong: 1M+ companies, SOC 2 Type II, ISO 42001, GDPR, HIPAA, "never trains on your data" | ✅ EU servers/GDPR, DPA page, names her own law; 10 testimonials (first name + city only) |
| Setup | Pick an agent, connect a knowledge base, share a link | ✅ Enter your website, the AI reads it and writes the script, you confirm, you get a number in 1–2 days |
| Voice | ✅ Voice cloning, 70+ languages, accent/tone control | Lithuanian only, custom name-inflection dictionary |
| After the call | ✅ Recording, transcript, summary, scorecards, CRM sync, "ask across calls" | ✅ Email summary, recording, transcript, dashboard, URGENT flag |
| Extras | Guardrails, control over when it hands off | "Never answer these numbers" list, one page per industry (20+), blog, case studies, comparisons, `llms.txt` |
| Guarantee | — | 30-day money-back |

## What they have in common
1. **24/7, answers instantly, and "sounds natural"** is the headline promise of both.
2. **Notes after every call**: summary, transcript and recording. This is now table stakes.
3. **Setup in 3–4 steps**, built from your existing company info or website.
4. **Privacy as a selling point**: GDPR, "your data is never used for training".
5. **Easy to try**: "free" or "no registration".
6. **An FAQ that tackles the robot fear**: "Do they sound natural? Can they replace humans?"

## What they're missing (Harbor's opening)
| Gap | Fireflies | Agnė | Harbor now |
|---|---|---|---|
| **Books the job** into the calendar | ✗ (notes and scorecards) | ✗ "only takes a message, doesn't book or promise anything" | ✅ books, texts the confirmation and alerts the owner |
| **Live emergency transfer** | Hand-off rules | ✗ only marks the email "URGENT" | ✅ patches the caller through to the on-call tech |
| **Texts back callers who hang up** | ✗ | ✗ | ✅ automatic |
| **Price shown upfront** | ✗ | ✗ (only after registering) | ✅ three plans on the page |
| **ROI calculator / proof of value** | ✗ | Says "one recovered client pays for it" but shows no math | ✅ live calculator plus a free missed-call audit |
| **Outcome guarantee** | ✗ | Money back only | ✅ "10 extra jobs in 60 days or refund + free until it does" |
| **Live demo on the page** | ✗ | ✅ | ✅ call-me demo, talk-in-browser with interrupting, chat |
| **Demo of *your own* business** | ✗ | Only after signing up | ✅ paste your website and chat with *your* Harbor right now, no sign-up |
| **Trade-specific safety logic** | ✗ generic | ✗ generic | ✅ shut off water, gas-smell protocol, no heat/AC triage |

## What Harbor took from them
- **From Agnė:** "Harbor calls you in 10 seconds" (`api/demo-call.js`), setup from your website (`api/onboard.js`, now *before* sign-up), after-call summaries texted to the owner with an URGENT flag (`api/_lib/summary.js`), a VIP "never answer" list that rings the owner directly, industry landing pages (`plumbers/hvac/roofers/electricians.html`), `llms.txt`.
- **From Fireflies:** multiple languages (caller-language detection in live voice), a trust section (honesty, privacy, guardrails, transcripts, GDPR/CCPA, no lock-in), and the "what happens after the call" story.

## What's still worth doing (needs your accounts or real customers)
1. **Real social proof.** Both competitors lean on it. Get 3 founding clients, record before/after numbers, and publish case studies. Don't invent testimonials.
2. **Owner dashboard** with call log, recordings and settings. Agnė has one. For now it's webhook → Google Sheet.
3. **Voice cloning**, so it sounds like the owner (Fireflies). ElevenLabs supports it; the voice ID goes in `config/business.json`.
4. **Security badges** such as SOC 2. Only claim them once audited.
5. **A Lithuanian / EU version.** If you want to sell in Lithuania, Agnė is the direct competitor. Harbor's edge there would be booking, transfers and text-backs. Speech-to-text and voice support for Lithuanian needs checking with Twilio's providers first.
