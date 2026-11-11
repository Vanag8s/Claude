# Frostveil — cinematic Shopify theme

A one-product Shopify theme (Online Store 2.0) for the **Frostveil 3-Layer All-Season Windshield Cover**.
Dark, cinematic, scroll-driven, built around your real product photography.

## What's on the page

| Section | What it does |
|---|---|
| **Cinematic scroll story** | Pinned full-screen story in 6 chapters: the floating product → frozen windshield → install callouts (mirror pockets, lime trim, 3-layer shell, door flaps) → snow piling up overnight → scroll-driven before/after wipe → summer sun. Depth-of-field snow, live HUD (temperature / time / glass status). |
| **Fabric layers** | CSS-3D stack of the real fabric that separates as you scroll and highlights each layer: nano-coating, Oxford, non-slip PVC. |
| **Benefit cards** | 12 benefits as 3D-tilt cards. |
| **Coverage hotspots** | Product photo with clickable hotspots + close-up photos (windshield, side glass, mirrors). |
| **Morning comparison** | Draggable before/after slider and counters (15 min vs 30 sec). |
| **Season switcher** | Winter / summer toggle with what it protects against in each. |
| **Install steps** | 4 steps with a scroll-progress line. |
| **Buy box** | Gallery, variant pills, quantity, AJAX add-to-cart, slide-out cart drawer, sticky buy bar on mobile. |
| Specs · Reviews · FAQ · Final CTA | Reviews stay hidden until you add real ones (blocks or a reviews app). |

All copy, chapters, benefits, specs and FAQ are editable in **Online Store → Customize**. No external JS libraries.

## Install

1. Zip the theme folders (or connect this repo through **Online Store → Themes → Add theme → Connect from GitHub**):
   ```bash
   zip -r frostveil-theme.zip assets config layout locales sections snippets templates
   ```
2. **Online Store → Themes → Add theme → Upload zip**, then **Publish**.
3. Create the product (below). The product page (`templates/product.json`) is the full cinematic page.
4. In **Customize → Home page → Product buy box**, choose the product so the home page can sell it too.

## Recommended product setup (fair pricing)

Positioned as a premium all-season cover (3-layer fabric, mirror pockets, side flaps).

| Variant (option "Size") | Price | Compare-at |
|---|---|---|
| Standard – Car / Hatchback | **$59.99** | $89.99 |
| XL – SUV / MPV | **$64.99** | $94.99 |

Upload the 5 product photos to the product. Before going live, **check the specs and FAQ against your supplier's details** (sizes, materials, what's in the box), and set the trust badges (shipping, returns) to match your real store policies.

## Local preview (optional)

Renders the home page with a mock product, so you can view it without a Shopify store:

```bash
npm install
```
```bash
npm run preview
```
```bash
npx http-server preview
```
