// End-to-end launch checks: serves the site, then tests forms, bot, consent, 404, mobile layout and SEO tags.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  if (p.startsWith('/api/')) { res.writeHead(404); return res.end(); } // simulate static hosting: bot + form must still work
  try { const b = await readFile(join('.', p)); res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(await readFile('404.html')); }
}).listen(4173);
const base = 'http://localhost:4173';
const results = []; const ok = (n, c) => { results.push([n, !!c]); console.log(`${c ? '✓' : '✗'} ${n}`); };
const shots = process.argv[2];
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  ok('Title set', (await p.title()).length > 20);
  ok('Meta description', (await p.getAttribute('meta[name=description]', 'content'))?.length > 80);
  ok('Canonical URL', await p.getAttribute('link[rel=canonical]', 'href'));
  ok('Open Graph image', await p.getAttribute('meta[property="og:image"]', 'content'));
  ok('Favicon', await p.getAttribute('link[rel=icon]', 'href'));
  ok('Single H1', (await p.locator('h1').count()) === 1);
  ok('All images have alt', await p.$$eval('img', i => i.every(x => x.hasAttribute('alt'))));
  await p.waitForTimeout(2600);
  ok('Cookie banner shows', await p.isVisible('#cookie'));
  if (shots) await p.screenshot({ path: `${shots}/hero.png` });
  await p.click('[data-consent=reject]');
  ok('Cookie choice stored', (await p.evaluate(() => localStorage.getItem('harbor_consent'))) === 'reject');

  // ROI
  await p.locator('#roi').scrollIntoViewIfNeeded();
  await p.fill('#calls', '100');
  ok('ROI calculator updates', (await p.textContent('#recovered')) !== '$0');

  // Bot booking flow
  await p.locator('#demo').scrollIntoViewIfNeeded(); await p.waitForTimeout(1800);
  ok('Bot greets', (await p.locator('.msg--ai').count()) >= 1);
  const send = async t => { await p.fill('#botInput', t); await p.press('#botInput', 'Enter'); await p.waitForTimeout(1900); };
  await send('How much to unclog a drain?');
  ok('Bot quotes price', (await p.locator('.msg--ai').last().textContent()).includes('$149'));
  await send('yes book it');
  ok('Bot offers slots', (await p.locator('.slots button').count()) >= 4);
  await p.locator('.slots button').first().click(); await p.waitForTimeout(1800);
  await send('jane doe'); await send('555 123 4567'); await send('12 Elm St, Oakwood');
  await p.waitForTimeout(2000);
  ok('Bot completes booking', await p.locator('.msg--card').count() === 1 && (await p.locator('.msg--card').textContent()).includes('Drain cleaning'));
  if (shots) await p.locator('#demo').screenshot({ path: `${shots}/demo.png` });
  await send('Is there gas smell danger?'); // safety path
  await send('I smell gas in my basement');
  ok('Bot gives gas safety first', (await p.locator('.msg--ai').last().textContent()).includes('leave the building'));

  // Form validation + submit
  await p.locator('#book').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  await p.click('#leadForm button[type=submit]');
  ok('Form blocks empty submit', (await p.locator('#leadForm .invalid').count()) >= 4 && await p.isHidden('#formDone'));
  await p.fill('#name', 'Sam Lee'); await p.fill('#company', 'Lee HVAC'); await p.fill('#email', 'bad-email');
  await p.fill('#phone', '555-010-1234'); await p.selectOption('#trade', 'HVAC'); await p.check('#consentBox');
  await p.click('#leadForm button[type=submit]');
  ok('Form rejects bad email', await p.isHidden('#formDone'));
  await p.fill('#email', 'sam@leehvac.test'); await p.click('#leadForm button[type=submit]'); await p.waitForTimeout(800);
  ok('Form submits + success state', await p.isVisible('#formDone'));
  ok('No JS errors (desktop)', errors.length === 0); if (errors.length) console.log(errors);

  // 404
  const r404 = await p.goto(base + '/nope-not-here');
  ok('Custom 404 page', r404.status() === 404 && (await p.textContent('h1')).includes('drifted'));

  // Browser voice demo with a simulated mic + speech engine: barge-in and echo filtering
  const vctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await vctx.addInitScript(() => {
    window.__voice = { cancels: 0, spoken: [] };
    class FakeSR { constructor() { window.__rec = this; } start() { this.on = true; } abort() { this.on = false; } stop() { this.on = false; } }
    window.webkitSpeechRecognition = FakeSR; window.SpeechRecognition = FakeSR;
    const synth = { speaking: false, pending: false, getVoices: () => [], speak(u) { this.speaking = true; window.__voice.spoken.push(u.text); window.__utt = u; }, cancel() { this.speaking = false; window.__voice.cancels++; } };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.__hear = (t, final) => window.__rec.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: final })] });
  });
  const vp = await vctx.newPage(); const verr = []; vp.on('pageerror', e => verr.push(e.message));
  await vp.goto(base + '/', { waitUntil: 'networkidle' });
  await vp.locator('#demo').scrollIntoViewIfNeeded(); await vp.waitForTimeout(1800);
  ok('Mic button shows when speech is supported', await vp.isVisible('#botMic'));
  await vp.click('#botMic'); await vp.waitForTimeout(200);
  ok('Voice mode speaks Harbor\'s greeting + listens', (await vp.evaluate(() => window.__voice.spoken.length)) >= 1 && await vp.evaluate(() => window.__rec.on));
  await vp.evaluate(() => window.__hear("riverside plumbing virtual assistant", false));
  ok('Ignores its own voice (echo)', (await vp.evaluate(() => window.__voice.cancels)) === 0);
  await vp.evaluate(() => window.__hear("how much for a drain", false));
  ok('Caller can interrupt: speech stops instantly', (await vp.evaluate(() => window.__voice.cancels)) === 1);
  await vp.evaluate(() => window.__hear("how much for a drain", true)); await vp.waitForTimeout(1900);
  ok('Answers the interrupting question out loud', (await vp.evaluate(() => window.__voice.spoken.at(-1))).includes('149'));
  ok('No JS errors in voice mode', verr.length === 0); if (verr.length) console.log(verr);
  await vctx.close();

  // Mobile
  const m = await b.newContext({ ...devices['iPhone 13'] }); const mp = await m.newPage();
  await mp.goto(base + '/', { waitUntil: 'networkidle' }); await mp.waitForTimeout(2600);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('No horizontal scroll on mobile', overflow <= 1);
  await mp.click('.nav__toggle'); ok('Mobile menu opens', await mp.isVisible('#mobileMenu')); await mp.click('.nav__toggle');
  if (shots) await mp.screenshot({ path: `${shots}/mobile.png` });
  for (const path of ['/legal/privacy.html', '/legal/terms.html', '/legal/cookies.html', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/assets/og-image.png']) {
    const r = await mp.goto(base + path); ok(`Serves ${path}`, r.status() === 200);
  }
} finally { await b.close(); srv.close(); }
const failed = results.filter(r => !r[1]).length;
console.log(failed ? `\n${failed} check(s) failed` : `\n✓ All ${results.length} launch checks passed`);
process.exit(failed ? 1 : 0);
