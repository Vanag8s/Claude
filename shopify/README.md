# Installing the Nordveil page in a Shopify theme (Horizon or any Online Store 2.0 theme)

Do NOT paste `index.html` into a theme file — Shopify only accepts Liquid in its own folders.

1. **Assets** – in the code editor, open `assets` → *Add a new asset* → upload every `.webp` from the repo's `/assets` folder
   (after, before, car-hatch, car-sedan, car-suv, coverage, coverage-clean, cover-top, hero, layers, night, protection).
2. **Section** – `sections` → *Add a new section* → name it `nordveil-product` → replace everything with the contents of
   `shopify/sections/nordveil-product.liquid` → Save.
3. **Template** – `templates` → *Add a new template* → type **product**, format **JSON**, name `nordveil` → replace everything with
   `shopify/templates/product.nordveil.json` → Save.
4. **Product** – Admin → Products → your cover:
   - Option name `Vehicle type`, values `Hatchback`, `Sedan`, `SUV`
   - Prices €49 / €79 / €119, compare-at €69 / €109 / €159
   - Right sidebar → *Theme template* → `product.nordveil` → Save.

Prices, stock, cart and checkout all come from Shopify. Variant titles containing "hatch", "sedan" or "SUV" get the matching car thumbnail.
