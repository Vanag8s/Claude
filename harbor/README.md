# Harbor: AI front desk for home-service businesses

A marketing site, a live AI demo and a sales funnel for an AI agency that sells one outcome: **every call answered, every job booked**.
The niche is plumbers, HVAC, roofers and electricians.

- `FOUNDERS_REPORT.md`: the business review (the generic agency failed at 17/40, Harbor passed at 32/40)
- `LAUNCH_CHECKLIST.md`: all 20 pre-launch items and their status

## What's inside
- **Cinematic site** (`index.html`, `css/`, `js/main.js`): an intro curtain, an animated ocean canvas with a lighthouse beam, word-by-word headline reveals, a live call simulation, magnetic buttons, 3D tilt cards and count-up stats. Reduced motion is fully supported.
- **AI demo bot** (`js/bot.js` + `api/chat.js`): a full guided booking flow, emergency safety handling, price quotes and service-area checks. With `ANTHROPIC_API_KEY` set, Claude answers free-form questions. Without it, a local engine keeps the demo working.
- **AI phone receptionist** (`api/voice/*`, `config/business.json`): answers real calls through Twilio, books jobs, texts confirmations, transfers emergencies, and texts back callers who hung up without booking. See `VOICE_SETUP.md`.
- **Talk-to-it demo**: visitors tap the 🎙 mic in the website demo and talk to Harbor out loud (runs in the browser, no phone needed).
- **ROI calculator**, pricing with a monthly/annual toggle, the guarantee, FAQ, and the **lead form** (`api/lead.js` forwards leads to your webhook).

## Run locally
```bash
npm install
npm run dev            # http://localhost:4173
npm run check:links
npm run test:site      # 29 checks run in a headless browser
npm run test:voice     # 12 checks on a simulated phone call
```

## Deploy
Push the `harbor/` folder to Vercel (set the root directory to `harbor`). See `LAUNCH_CHECKLIST.md` for the environment variables.
