# Harbor: AI front desk for home-service businesses

A marketing site, a live AI demo and a sales funnel for an AI agency that sells one outcome: **every call answered, every job booked**.
The niche is plumbers, HVAC, roofers and electricians.

- `FOUNDERS_REPORT.md`: the business review (the generic agency failed at 17/40, Harbor passed at 32/40)
- `LAUNCH_CHECKLIST.md`: all 20 pre-launch items and their status
- `COMPETITOR_REVIEW.md`: Fireflies vs atsiliepsiu.lt: what they share, what they miss, what Harbor took

## What's inside
- **Cinematic site** (`index.html`, `css/`, `js/main.js`): an intro curtain, an animated ocean canvas with a lighthouse beam, word-by-word headline reveals, a live call simulation, magnetic buttons, 3D tilt cards and count-up stats. Reduced motion is fully supported.
- **AI demo bot** (`js/bot.js` + `api/chat.js`): a full guided booking flow, emergency safety handling, price quotes and service-area checks. With `ANTHROPIC_API_KEY` set, Claude answers free-form questions. Without it, a local engine keeps the demo working.
- **AI phone receptionist that sounds human** (`voice-server/`, `config/business.json`): it streams replies in a natural ElevenLabs voice, stops the instant the caller interrupts, ignores "uh-huh"s and detects when the caller is done talking. It books jobs, texts confirmations, transfers emergencies and texts back callers who hung up. Classic mode (`api/voice/*`) is the automatic backup. See `VOICE_SETUP.md`.
- **Talk-to-it demo**: visitors tap the 🎙 mic in the website demo and talk to Harbor out loud, and can interrupt it mid-sentence (runs in the browser, no phone needed).
- **"Harbor calls you in 10 seconds"** (`api/demo-call.js`): a visitor enters a number and gets a real demo call.
- **Build your Harbor from your website** (`api/onboard.js`): paste a URL and Harbor reads the site, writes the script, and the visitor chats with *their own* receptionist.
- **After-call summaries** (`api/_lib/summary.js`): a text to the owner with an URGENT flag, plus the full write-up sent to the webhook.
- **Industry pages** (`plumbers.html`, `hvac.html`, `roofers.html`, `electricians.html`) and `llms.txt` for search and AI search.
- **ROI calculator**, pricing with a monthly/annual toggle, the guarantee, FAQ, and the **lead form** (`api/lead.js` forwards leads to your webhook).

## Run locally
```bash
npm install
npm run dev            # http://localhost:4173
npm run check:links
npm run test:site      # 50 checks run in a headless browser
npm run test:api       # 18 checks: demo call, website onboarding + SSRF guard, summaries
npm run test:voice     # 12 checks, Classic phone mode
npm run test:live-voice # 27 checks, live interruptible mode over a real WebSocket
npm run voice:live     # run the live voice server locally on :8080
```

## Deploy
Push the `harbor/` folder to Vercel (set the root directory to `harbor`). See `LAUNCH_CHECKLIST.md` for the environment variables.
