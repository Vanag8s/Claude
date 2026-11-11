# Harbor: the AI receptionist membership

Harbor is an AI receptionist sold as a **monthly membership** to businesses that miss calls: Shore $149 (small & solo), Tide $349 (growing), Ocean $899 (big teams).
The site has a warm sand-and-sea design, and its chat bot is Harbor itself: a salesperson that senses the visitor's tone and knows when to sell.

- `FOUNDERS_REPORT.md`: the business review (the generic agency failed at 17/40, Harbor passed at 32/40)
- `LAUNCH_CHECKLIST.md`: all 20 pre-launch items and their status
- `COMPETITOR_REVIEW.md`: Fireflies vs atsiliepsiu.lt: what they share, what they miss, what Harbor took

## What's inside
- **Talk to Harbor** (`js/bot.js`, `api/concierge.js`, `js/tone.js`): the visitor talks to Harbor by text or voice. Claude reads their tone (from their words plus pace, loudness and pitch measured in the browser), tracks where they are in buying, and only recommends a plan when it's the right moment. It can switch into a live role-play as the visitor's own receptionist. Tick "Show what Harbor senses" to watch it think.
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
ANTHROPIC_API_KEY=... npm run dev   # site + AI on http://localhost:4173
npm run check:links
npm run test:site      # 50 checks run in a headless browser
npm run test:api       # 18 checks: demo call, website onboarding + SSRF guard, summaries
npm run test:voice     # 12 checks, Classic phone mode
npm run test:live-voice # 27 checks, live interruptible mode over a real WebSocket
npm run voice:live     # run the live voice server locally on :8080
```

## Deploy
Push the `harbor/` folder to Vercel (set the root directory to `harbor`). See `LAUNCH_CHECKLIST.md` for the environment variables.

## Photo credits
All photos are public domain (CC0) via Wikimedia Commons, originally from Unsplash. No attribution is required, but here's where they came from:
- `assets/photos/hero.jpg`: "Sunset rolling waves", https://commons.wikimedia.org/wiki/File:Sunset_rolling_waves.jpg
- `assets/photos/surf.jpg`: "54th Street, Newport Beach, United States (Unsplash)", https://commons.wikimedia.org/wiki/File:54th_Street,_Newport_Beach,_United_States_(Unsplash).jpg
- `assets/photos/barber.jpg`: "Head shaved by barber (Unsplash)", https://commons.wikimedia.org/wiki/File:Head_shaved_by_barber_(Unsplash).jpg

To make the site feel even more like *your* business, replace these with your own photos (same file names, landscape, at least 1280px wide).

## Selling Harbor to a business (members)
1. The business owner opens **`/setup.html`** and writes or dictates everything about the business (hours, prices, rules, what to sell), or pastes their website. Harbor organizes it into a profile (`api/understand.js`).
2. They pick a **mode**: *Receptionist* (answer, book, take messages) or *Sales* (also qualifies callers, recommends one product, handles objections with the owner's own arguments, and records sales).
3. They **test it like a customer** in the chat on the same page, by typing or talking (they can interrupt it). With an API key it's Claude; without one, a simpler offline brain answers from their facts.
4. **Save** creates the business (`api/business.js`) with a private admin key for later edits.
5. Put the business's **Harbor phone number** in the profile. The live voice server looks up the dialed number and answers as that business, using its facts, tools and owner phone for transfers and alerts.

Storage: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (a free Upstash Redis database) on Vercel **and** on the voice server so both see the same businesses. Locally it saves to `harbor/data/` (git-ignored).
