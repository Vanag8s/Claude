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
# 4. Run the checks
npm run check:links && npm run test:site
```
