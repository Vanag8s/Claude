/**
 * Builds ONE self-contained Shopify section file (frostveil-landing.liquid)
 * that can be pasted into any existing theme via "Edit code → Add a new section".
 * Static content is pre-rendered from the theme sections; the buy box stays live
 * Liquid (product, variants, prices). Photos load from jsDelivr (public repo).
 *
 *   node tools/single/build.mjs <commit-ish>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REF = process.argv[2] || 'main';
const CDN = `https://cdn.jsdelivr.net/gh/Vanag8s/Claude@${REF}/assets/`;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SCHEMA_RE = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/;

const engine = new Liquid({ root: [path.join(ROOT, 'snippets')], partials: path.join(ROOT, 'snippets'), extname: '.liquid' });
engine.registerFilter('asset_url', (n) => CDN + n);
engine.registerFilter('image_url', (i) => i || '');
engine.registerFilter('image_tag', (src) => `<img src="${src}" alt="">`);

function sectionData(type, cfg = {}) {
  const src = read(`sections/${type}.liquid`);
  const m = src.match(SCHEMA_RE);
  const schema = m ? JSON.parse(m[1]) : { settings: [] };
  const defaults = (list) => Object.fromEntries((list || []).filter((s) => s.id).map((s) => [s.id, s.default ?? null]));
  const blocks = (cfg.block_order || []).map((id) => {
    const b = cfg.blocks[id];
    const def = (schema.blocks || []).find((x) => x.type === b.type) || {};
    return { id, type: b.type, shopify_attributes: '', settings: { ...defaults(def.settings), ...(b.settings || {}) } };
  });
  return { src: src.replace(SCHEMA_RE, ''), section: { id: type, settings: { ...defaults(schema.settings), ...(cfg.settings || {}) }, blocks } };
}
const render = async (type, cfg) => { const { src, section } = sectionData(type, cfg); return engine.parseAndRender(src, { section, routes: {}, settings: {} }); };

/* ---------- scope the stylesheet under .fv so it can't clash with the host theme ---------- */
function scopeCss(css) {
  const kf = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  css = css.replace(/@keyframes\s+([\w-]+)/g, (_, n) => `@keyframes fv-${n}`);
  css = css.replace(/animation(-name)?\s*:([^;}]+)/g, (all, n, v) => `animation${n || ''}:${v.replace(/[\w-]+/g, (w) => (kf.has(w) ? `fv-${w}` : w))}`);
  css = css.replace(/url\('fv-cover-cutout\.webp'\)/g, `url('${CDN}fv-cover-cutout.webp')`);
  let out = '', i = 0;
  const scopeSel = (sel) => sel.split(',').map((s) => {
    s = s.trim();
    if (!s) return s;
    if (/^(:root|html|body)$/.test(s)) return '.fv';
    if (s.startsWith('html.lock')) return '.fv-never';
    if (s.startsWith('.js ')) return '.fv.fv-js ' + s.slice(4);
    if (/^[*]/.test(s)) return '.fv ' + s;
    return '.fv ' + s;
  }).join(', ');
  function block(depthCss) {
    let res = '';
    while (i < css.length) {
      const open = css.indexOf('{', i), close = css.indexOf('}', i);
      if (close !== -1 && (open === -1 || close < open)) { i = close + 1; return res; }
      if (open === -1) { res += css.slice(i); i = css.length; return res; }
      const head = css.slice(i, open).trim();
      i = open + 1;
      if (head.startsWith('@media') || head.startsWith('@supports')) res += `${head}{${block()}}\n`;
      else if (head.startsWith('@keyframes')) { const end = matchEnd(); res += `${head}{${css.slice(i, end)}}\n`; i = end + 1; }
      else { const end = css.indexOf('}', i); res += `${scopeSel(head.replace(/\/\*[\s\S]*?\*\//g, ''))}{${css.slice(i, end)}}\n`; i = end + 1; }
    }
    return res;
  }
  function matchEnd() { let d = 1, j = i; while (d && j < css.length) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; } return j - 1; }
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  out = block();
  return out;
}

/* ---------- content ---------- */
const tpl = JSON.parse(read('templates/index.json'));
const order = ['story', 'layers', 'features', 'coverage', 'morning', 'seasons', 'install', 'buy', 'specs', 'faq', 'cta'];
let html = '';
for (const key of order) {
  if (key === 'buy') { html += '__BUY__\n'; continue; }
  const s = tpl.sections[key];
  html += (await render(s.type, s)) + '\n';
}
html = html.replace(/<script type="module"[^>]*><\/script>/g, '');

const icon = async (name) => engine.parseAndRender(read('snippets/fv-icon.liquid'), { name });
const trust = await Promise.all([['car', 'Fast, tracked shipping'], ['shield', '30-day returns'], ['lock', 'Secure checkout']].map(async ([n, t]) => `<li><span>${await icon(n)}</span>${t}</li>`));
const fallbacks = ['fv-zones.webp', 'fv-coverage.webp', 'fv-layers.webp', 'fv-before-after.webp', 'fv-fit.webp'];

const buy = `
<section id="buy" class="section buy" data-buy>
  <div class="buy__aura" aria-hidden="true"></div>
  <div class="container buy__grid">
    <div class="gallery" data-gallery>
      <div class="gallery__main" data-tilt>
        {%- if p and p.images.size > 0 -%}
          {%- for image in p.images -%}<img class="gallery__img" src="{{ image | image_url: width: 1400 }}" alt="{{ image.alt | default: p.title | escape }}" loading="lazy">{%- endfor -%}
        {%- else -%}
${fallbacks.map((f) => `          <img class="gallery__img" src="${CDN + f}" alt="Frostveil windshield cover" loading="lazy">`).join('\n')}
        {%- endif -%}
        <span class="gallery__badge">All-season</span>
      </div>
      <div class="gallery__thumbs">
        {%- if p and p.images.size > 0 -%}
          {%- for image in p.images -%}<button type="button" class="gallery__thumb" data-gallery-thumb aria-label="Image {{ forloop.index }}"><img src="{{ image | image_url: width: 240 }}" alt="" loading="lazy"></button>{%- endfor -%}
        {%- else -%}
${fallbacks.map((f, i) => `          <button type="button" class="gallery__thumb" data-gallery-thumb aria-label="Image ${i + 1}"><img src="${CDN + f}" alt="" loading="lazy"></button>`).join('\n')}
        {%- endif -%}
      </div>
    </div>

    <div class="buy__panel">
      <p class="eyebrow">Limited winter stock</p>
      <h2 class="h2 buy__title">{% if p %}{{ p.title }}{% else %}Frostveil 3-Layer All-Season Windshield Cover{% endif %}</h2>
      <div class="price">
        {%- if p -%}
          <span class="price__now" data-price>{{ v.price | money }}</span>
          <s class="price__was" data-compare {% unless v.compare_at_price > v.price %}hidden{% endunless %}>{{ v.compare_at_price | money }}</s>
          <span class="price__save" data-save {% unless v.compare_at_price > v.price %}hidden{% endunless %}>Save {{ v.compare_at_price | minus: v.price | money }}</span>
        {%- else -%}
          <span class="price__now">$59.99</span><s class="price__was">$89.99</s>
        {%- endif -%}
      </div>
      <ul class="buy__bullets">
        <li>Covers windshield, front side windows and both mirrors</li>
        <li>3-layer composite: nano-coating, Oxford, non-slip PVC</li>
        <li>Door-tuck flaps hold it in wind and deter theft</li>
        <li>Reflective mirror bands for night visibility</li>
        <li>Folds flat for storage</li>
      </ul>
      {%- if p -%}
        {%- form 'product', p, class: 'product-form', data-product-form: '' -%}
          <script type="application/json" data-product-json>{{ p | json }}</script>
          <input type="hidden" name="id" value="{{ v.id }}" data-variant-id>
          {%- unless p.has_only_default_variant -%}
            {%- for option in p.options_with_values -%}
              {%- assign opt_idx = forloop.index0 -%}
              <fieldset class="option" data-option-index="{{ opt_idx }}">
                <legend>{{ option.name }}: <span data-option-value>{{ option.selected_value }}</span></legend>
                <div class="option__pills">
                  {%- for value in option.values -%}
                    <label class="pill"><input type="radio" name="fv-option-{{ opt_idx }}" value="{{ value | escape }}" {% if option.selected_value == value %}checked{% endif %}><span>{{ value }}</span></label>
                  {%- endfor -%}
                </div>
              </fieldset>
            {%- endfor -%}
          {%- endunless -%}
          <div class="buy__row">
            <div class="qty" data-qty>
              <button type="button" data-qty-minus aria-label="Decrease quantity">−</button>
              <input type="number" name="quantity" value="1" min="1" max="10" aria-label="Quantity">
              <button type="button" data-qty-plus aria-label="Increase quantity">+</button>
            </div>
            <button type="submit" class="btn btn--lime btn--glow btn--block" data-add-btn {% unless v.available %}disabled{% endunless %}>
              <span data-add-label>{% if v.available %}Add to cart{% else %}Sold out{% endif %}</span>
            </button>
          </div>
          <p class="form-error" data-form-error hidden></p>
        {%- endform -%}
      {%- else -%}
        <p class="notice">Pick your product in this section's settings (Customize → Frostveil landing → Product) to turn on checkout.</p>
      {%- endif -%}
      <ul class="trust">
        ${trust.join('\n        ')}
      </ul>
    </div>
  </div>
</section>`;

html = html.replace('__BUY__', buy);

const css = scopeCss(read('assets/base.css'));
const js = read('assets/story.js') + '\n' + read('assets/theme.js');
const extraCss = `
.fv { position: relative; isolation: isolate; overflow-x: clip; background: var(--bg); color: var(--text); font: 400 16px/1.6 var(--font-body); -webkit-font-smoothing: antialiased; }
.fv img { max-width: 100%; height: auto; }
.fv .container { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--gutter); }
.fv .btn { text-decoration: none; }
.fv .chapter--intro { bottom: clamp(40px, 10vh, 120px); }
.fv .story__hud { top: 24px; }
`;

const out = `{%- comment -%}
  FROSTVEIL LANDING – one-file Shopify section.
  Install: Online Store → Themes → … → Edit code → Sections → "Add a new section"
  → name it  frostveil-landing  → delete everything in it → paste this whole file → Save.
  Then Customize → open your product page (or home page) → Add section → "Frostveil landing"
  → choose your product in the section settings → Save.
  Photos load from: ${CDN}
{%- endcomment -%}
{%- liquid
  assign p = section.settings.product
  if product
    assign p = product
  endif
  if p
    assign v = p.selected_or_first_available_variant
  endif
-%}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="${CDN}fv-cover-cutout.webp">
<style>
{% raw %}${css}${extraCss}{% endraw %}
</style>

<div class="fv" id="fv-landing">
${html}
</div>

<script>
  window.Frost = {
    routes: { cartAdd: {{ routes.cart_add_url | json }}, cartChange: {{ routes.cart_change_url | json }}, cart: {{ routes.cart_url | json }} },
    moneyFormat: {{ shop.money_format | json }},
    snow: true,
    preview: false
  };
  document.getElementById('fv-landing').classList.add('fv-js');
</script>
<script>
{% raw %}${js}{% endraw %}
</script>

{% schema %}
{
  "name": "Frostveil landing",
  "tag": "section",
  "class": "section-frostveil",
  "settings": [
    { "type": "product", "id": "product", "label": "Product" }
  ],
  "presets": [{ "name": "Frostveil landing" }]
}
{% endschema %}
`;

fs.writeFileSync(path.join(ROOT, 'frostveil-landing.liquid'), out);
console.log('frostveil-landing.liquid', (out.length / 1024).toFixed(1), 'KB');
