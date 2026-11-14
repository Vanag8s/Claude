# Launch Checklist: the 20 items from the reel

| # | Item | Where / how it's covered | Status |
|---|---|---|---|
| 1 | Privacy policy | `legal/privacy.html` (GDPR/CCPA sections) | ✅ (get a lawyer to review) |
| 2 | Terms page | `legal/terms.html`, with the guarantee's terms spelled out | ✅ (get a lawyer to review) |
| 3 | Clear CTA | "Get my free missed-call audit" in the hero, nav, pricing, a sticky mobile bar and the bot | ✅ |
| 4 | FAQ | 7 objection-handling questions plus `FAQPage` schema markup | ✅ |
| 5 | robots.txt | `robots.txt` (keeps crawlers out of `/api/`, points to the sitemap) | ✅ |
| 6 | sitemap.xml | `sitemap.xml` | ✅ |
| 7 | Custom 404 | `404.html` (Vercel serves it automatically, tested to return 404) | ✅ |
| 8 | Alt text | Every `<img>` has alt text (decorative ones use `alt=""`). Tested. | ✅ |
| 9 | Analytics | `js/analytics.js`: GA4 loads only after consent. Tracks CTA clicks, ROI use, demo messages, demo bookings and leads | ⚠️ Add your GA4 ID |
| 10 | Meta titles | Unique `<title>` on every page | ✅ |
| 11 | Meta description | On every page | ✅ |
| 12 | Social share | Open Graph and Twitter tags, plus a 1200×630 `assets/og-image.png` | ✅ |
| 13 | Favicon | SVG favicon, 512px PNG icon, web manifest | ✅ |
| 14 | Canonical URLs | `<link rel="canonical">` on every page | ⚠️ Replace `harbor-ai.example` with your domain |
| 15 | Cookie consent | Banner with Accept / Essential only, a "Cookie settings" link in the footer, and `legal/cookies.html` | ✅ |
| 16 | Mobile version | Responsive layout, mobile menu, sticky CTA. Tested on iPhone 13 with no horizontal scroll | ✅ |
| 17 | Accessibility | Skip link, semantic landmarks, labeled inputs, `aria-live` for the chat and errors, focus rings, reduced-motion support, keyboard-friendly FAQ | ✅ |
| 18 | Test forms | `npm run test:site` checks empty and invalid input, a successful submit, the honeypot and the bot booking flow | ✅ |
| 19 | Check broken links | `npm run check:links` found 0 broken links and anchors | ✅ |
| 20 | Optimize performance | No frameworks. Fonts load without blocking. The canvas pauses when off-screen, caps DPR at 1.5 and is skipped under reduced motion. Long-cache headers for static files | ✅ |

## Before going live
```bash
# 1. Swap in your real domain everywhere
grep -rl "harbor-ai.example" . --exclude-dir=node_modules | xargs sed -i 's/harbor-ai.example/yourdomain.com/g'
# 2. Put your GA4 ID in js/analytics.js
# 3. In Vercel → Project → Settings → Environment Variables:
#    ANTHROPIC_API_KEY   (makes the demo bot Claude-powered; without it the built-in engine still works)
#    LEAD_WEBHOOK_URL    (Zapier/Make/Slack webhook that receives audit requests)
# 4. Phone AI: follow VOICE_SETUP.md (Twilio number + TWILIO_*, OWNER_PHONE)
#    Website call-me demo: DEMO_FROM_NUMBER, LIVE_VOICE_URL, DEMO_ALLOWED_PREFIXES
# 5. Run the checks
npm run check:links && npm run test:site && npm run test:voice
```

---

# "So your site doesn't get sued": the second 20

| # | Item | How it's covered | Status |
|---|---|---|---|
| 1 | Privacy policy | `legal/privacy.html`: controller vs. processor, a table of each data type with its purpose and GDPR legal basis, AI disclosure, processors, transfers outside the EU, retention, rights, Lithuanian supervisory authority | ✅ fill in the [brackets], lawyer review |
| 2 | Terms & conditions | `legal/terms.html`: business customers, the service and its AI limits, your responsibilities, billing, availability, liability, governing law | ✅ fill in the [brackets], lawyer review |
| 3 | Cookie policy | `legal/cookies.html`: every stored item, with its name, purpose and how long it's kept | ✅ |
| 4 | Cookie consent | Banner with Accept / Essential only; nothing optional loads before you accept; "Cookie settings" link in the footer | ✅ |
| 5 | Refund policy | `legal/refunds.html`: cancel any time, the exact conditions of the 30-day promise, yearly plans, EU consumers' 14-day withdrawal right | ✅ |
| 6 | Form consent | Consent checkboxes on the sign-up and demo-call forms, a notice under the chat, a notice on "Build my Harbor" | ✅ |
| 7 | Only necessary data | Forms ask only what's needed; the voice feature sends measurements, never audio | ✅ |
| 8 | Analytics tracking | GA4 loads only after "Accept all", with anonymized IPs | ✅ add your GA ID |
| 9 | Third-party embeds | Fonts **self-hosted** (no Google request); no videos, maps or social widgets; tested: 0 outside requests before consent | ✅ |
| 10 | Accessibility | `legal/accessibility.html` (WCAG 2.1 AA target), skip link, labels, focus outlines, reduced motion | ✅ |
| 11 | Alt text | Every image has alt text; decorative images use alt="" | ✅ |
| 12 | Color contrast | Buttons and text recolored to pass AA (4.5:1): coral #bf4e33, gray #56636e, teal #1f7f73 | ✅ |
| 13 | Keyboard-friendly forms | Every control reachable by Tab, visible focus, Enter submits | ✅ |
| 14 | Clear button labels | Buttons say what they do; icon buttons have names screen readers can read ("Start over", "Play the sample call") | ✅ |
| 15 | Remove fake reviews | No testimonials. Sample calls and messages are marked "Example"; credits explain the voices are generated | ✅ |
| 16 | Unsupported claims | Removed the "85%" survey figure, "never double-books", direct calendar-integration and "CCPA ready" claims; comparison prices marked as typical ranges | ✅ |
| 17 | Business details | `legal/company.html` + the footer: name, company code, address, VAT, contact | ⚠️ fill in your details |
| 18 | Image copyright | All photos CC0, fonts under the Open Font License, voices generated with Kokoro (Apache 2.0); sources listed in `legal/credits.html` | ✅ |
| 19 | Applicable local laws | GDPR, ePrivacy (cookies), EU AI Act (says it's an AI), call recording notice, Lithuanian authority, consumer withdrawal right | ✅ lawyer review |
| 20 | Other legal risks | Liability cap, "not an emergency service", acceptable use (no spam calls), DPA for members. **Check the "Harbor" name for trademarks** before you invest in branding | ⚠️ trademark check |
