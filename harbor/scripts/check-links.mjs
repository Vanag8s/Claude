// Crawls every local HTML page and reports broken internal links, anchors and assets.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
const root = resolve('.');
const pages = [];
const walk = d => readdirSync(d).forEach(f => { const p = join(d, f); if (f === 'node_modules' || f.startsWith('.')) return; statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && pages.push(p); });
walk(root);
let bad = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
    const [path, hash] = url.split('#');
    let target = path ? (path.startsWith('/') ? join(root, path) : join(dirname(page), path)) : page;
    if (path === '/' ) target = join(root, 'index.html');
    if (!existsSync(target)) { console.log(`✗ ${page.replace(root, '')}: missing ${url}`); bad++; continue; }
    if (hash) {
      const tHtml = target.endsWith('.html') ? readFileSync(target, 'utf8') : '';
      const tIds = target === page ? ids : new Set([...tHtml.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
      if (!tIds.has(hash)) { console.log(`✗ ${page.replace(root, '')}: missing anchor ${url}`); bad++; }
    }
  }
}
console.log(bad ? `${bad} broken link(s) across ${pages.length} pages` : `✓ No broken links across ${pages.length} pages`);
process.exit(bad ? 1 : 0);
