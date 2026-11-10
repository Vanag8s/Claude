# Coast landing page

A standalone, dependency-free landing page (`index.html`, `styles.css`, `main.js`, `favicon.svg`). It replaces the marketing page on Bolt; your app stays where it is and every "Sign in" or "Start trial" button links to it.

**Preview locally:** `cd site && python3 -m http.server 8000` → http://localhost:8000

## What changed vs. the current site (and why — see `../founder/`)

- **Removed** the "10x faster", "50+ brands" and "€0" stats and the three testimonials. None had a source; the board and panel flagged them as the biggest trust risk (and EU rules ban fake reviews).
- **Fixed** the broken hero image (its alt text was showing in the corner) → replaced with an animated canvas sea, sun and parallax dunes.
- **New positioning:** "Coast through Monday" — a week per client, in their voice, approved with one link. Answers the panel's #1 objection ("I already have ChatGPT") in the FAQ and the problem section.
- **English / Lithuanian** switch (auto-detects LT browsers, remembers the choice).
- **Scroll-driven demo** of the 4-step workflow (sticky on desktop, auto-playing on mobile).
- **New pricing** from `founder/pricing.md`: Solo €15 · Studio €29 · Agency €59, yearly = 2 months free, founding-member Studio €19 for the first 50, voice guarantee, 14-day trial.
- Respects `prefers-reduced-motion`, keyboard focus, and phones down to 320px.

## Before you publish — you must check these

1. **`main.js` → `CONFIG`**: `APP_URL` (your app), `CONTACT_EMAIL` (switch to a business address), `LEGAL` links (privacy, terms, DPA pages).
2. **Features marked "Founding beta"** (approval link, CSV export) don't exist in the app yet. Build them, or keep the badge and only give them to founding members. Don't remove the badge until they ship.
3. **The trust claims** (element marked `data-verify`): "stored in the EU", "not used to train AI", "DPA on request". Publish them only if they are true for your hosting and AI provider.
4. **Pricing and trial length** must match what your app's billing actually charges (the current app shows €19/49/99 and a 2-day trial).
5. **Lithuanian copy** was written by an AI. Have a native speaker read it once.
6. Add your name and photo to the "Who's behind Coast" section. That was the panel's second-biggest objection.

## Putting it on Bolt

Paste the three files into your Bolt project's `public/` folder and serve `index.html` at `/`, with the app on `/app`. Or host this folder anywhere static (Netlify, Vercel, Cloudflare Pages) on your own domain and keep the app on Bolt.
