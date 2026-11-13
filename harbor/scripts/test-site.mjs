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
}).listen(4180);
const base = 'http://localhost:4180';
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

  // Talk to Harbor (offline: local concierge, since /api/* returns 404 here)
  await p.locator('#talk').scrollIntoViewIfNeeded(); await p.waitForTimeout(1600);
  ok('Harbor greets and asks about the business', (await p.locator('.msg--ai').first().textContent()).includes('What kind of business'));
  const send = async t => { await p.fill('#botInput', t); await p.press('#botInput', 'Enter'); await p.waitForTimeout(1700); };
  const lastAi = async () => (await p.locator('.msg--ai').last().textContent());
  await p.check('#showSense');
  await send('I run a small dental clinic and we miss a lot of calls during appointments');
  ok('Discovers first: no pitch on the first message', !(await lastAi()).includes('$') && (await p.textContent('#botSense')).includes('not yet'));
  ok('Senses panel shows tone + stage', await p.isVisible('#botSense') && (await p.textContent('#botSense')).includes('Stage'));
  await send('Honestly I do not trust AI on the phone, it sounds fake');
  ok('Senses skepticism and offers proof, not a pitch', (await p.textContent('#botSense')).includes('skeptical') && (await p.locator('.quick button').last().textContent()).length > 0 && !(await lastAi()).includes('$149'));
  await send('How much does it cost?');
  ok('Right moment: recommends one plan for a small business', (await p.textContent('#botSense')).includes('yes') && (await lastAi()).includes('Shore') && await p.locator('.quick .is-cta').count() >= 1);
  ok('Highlights the recommended membership', (await p.getAttribute('[data-plan-card=shore]', 'class')).includes('is-recommended'));
  await send('Can you act as my receptionist so I can hear it?');
  await p.waitForTimeout(900);
  ok('Switches into receptionist role-play', (await p.textContent('#botSub')).includes('playing your receptionist'));
  await send('How much to unclog a drain?');
  ok('Receptionist quotes a price', (await lastAi()).includes('$149'));
  await send('yes book it');
  ok('Receptionist offers time slots', (await p.locator('.slots button').count()) >= 4);
  await p.locator('.slots button').first().click(); await p.waitForTimeout(1500);
  await send('jane doe'); await send('555 123 4567'); await send('12 Elm St, Oakwood');
  await p.waitForTimeout(1500);
  ok('Receptionist completes a booking', (await p.locator('.msg--card').allTextContents()).some(t => t.includes('Drain cleaning') && t.includes('Jane Doe')));
  if (shots) await p.locator('#talk').screenshot({ path: `${shots}/demo.png` });
  await p.locator('.quick .is-cta').last().click(); await p.waitForTimeout(2200);
  ok('Back to Harbor, ready to sign up', (await p.textContent('#botName')) === 'Harbor' && (await p.textContent('#botSense')).includes('ready to buy'));
  await p.locator('.quick .is-cta').last().click(); await p.waitForTimeout(1400);
  ok('Sign-up button opens the membership form with the plan picked', (await p.inputValue('#planSelect')) === 'shore');

  // Form validation + submit
  await p.locator('#join').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  await p.click('#leadForm button[type=submit]');
  ok('Form blocks empty submit', (await p.locator('#leadForm .invalid').count()) >= 4 && await p.isHidden('#formDone'));
  await p.fill('#name', 'Sam Lee'); await p.fill('#company', 'Lee Dental'); await p.fill('#email', 'bad-email');
  await p.fill('#phone', '555-010-1234'); await p.selectOption('#trade', 'Real estate'); await p.check('#consentBox');
  await p.click('#leadForm button[type=submit]');
  ok('Form rejects bad email', await p.isHidden('#formDone'));
  await p.fill('#email', 'sam@leedental.test'); await p.click('#leadForm button[type=submit]'); await p.waitForTimeout(800);
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
    const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Samantha', lang: 'en-US', voiceURI: 'sam', localService: true }, { name: 'Microsoft Guy Online (Natural)', lang: 'en-US', voiceURI: 'guy', localService: false }, { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', voiceURI: 'aria', localService: false }], speak(u) { this.speaking = true; window.__voice.spoken.push(u.text); window.__voice.used = u.voice?.name; window.__utt = u; }, cancel() { this.speaking = false; window.__voice.cancels++; } };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    window.__played = []; const _play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return Promise.resolve(); };
    window.__hear = (t, final) => window.__rec.onresult({ results: [Object.assign([{ transcript: t }], { isFinal: final })] });
  });
  const vp = await vctx.newPage(); const verr = []; vp.on('pageerror', e => verr.push(e.message));
  await vp.goto(base + '/', { waitUntil: 'networkidle' });
  await vp.locator('#talk').scrollIntoViewIfNeeded(); await vp.waitForTimeout(1800);
  ok('Mic button shows when speech is supported', await vp.isVisible('#botMic'));
  await vp.click('#botMic'); await vp.waitForTimeout(200);
  ok('Voice mode speaks Harbor\'s greeting + listens', (await vp.evaluate(() => window.__voice.spoken.length)) >= 1 && await vp.evaluate(() => window.__rec.on));
  await vp.evaluate(() => window.__hear("answer the calls your business can't", false));
  ok('Ignores its own voice (echo)', (await vp.evaluate(() => window.__voice.cancels)) === 0);
  await vp.evaluate(() => window.__hear("how much does it cost", false));
  ok('Caller can interrupt: speech stops instantly', (await vp.evaluate(() => window.__voice.cancels)) === 1);
  await vp.evaluate(() => window.__hear("how much does it cost", true)); await vp.waitForTimeout(1900);
  ok('Answers the interrupting question out loud', (await vp.evaluate(() => window.__voice.spoken.at(-1))).includes('149'));
  await vp.click('#botMic'); // mic off again
  await vp.click('.vpick [data-g=male]'); await vp.waitForTimeout(150);
  ok("Man's voice: plays the recorded greeting + switches the call player", (await vp.evaluate(() => window.__played?.at(-1) || '')).endsWith('greeting-man.mp3') && (await vp.getAttribute('#callAudio', 'src')).endsWith('call-man.mp3') && (await vp.evaluate(() => window.harborVoices.voice.name)) === 'Microsoft Guy Online (Natural)');
  await vp.click('.vpick [data-g=female]'); await vp.waitForTimeout(150);
  ok("Woman's voice: recorded greeting + most natural female device voice", (await vp.evaluate(() => window.__played?.at(-1) || '')).endsWith('greeting-woman.mp3') && (await vp.evaluate(() => window.harborVoices.voice.name)) === 'Microsoft Aria Online (Natural)');
  await vp.check('.vpick [data-aloud]');
  const before = await vp.evaluate(() => window.__voice.spoken.length);
  await vp.fill('#botInput', 'How much does it cost?'); await vp.press('#botInput', 'Enter'); await vp.waitForTimeout(1900);
  ok('Read replies aloud works without the mic', (await vp.evaluate(() => window.__voice.spoken.length)) > before && (await vp.evaluate(() => window.__voice.spoken.at(-1))).includes('149'));
  ok('Voice choice is remembered', (await vp.evaluate(() => JSON.parse(localStorage.getItem('harbor_voice')).gender)) === 'female');
  ok('No JS errors in voice mode', verr.length === 0); if (verr.length) console.log(verr);
  await vctx.close();

  // Growth features with mocked APIs (as when deployed)
  const gctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const gp = await gctx.newPage(); const gerr = []; gp.on('pageerror', e => gerr.push(e.message));
  const profile = { company: 'Ace Plumbing', trade: 'plumbing', services: [{ name: 'Drain cleaning', price: '$99' }, { name: 'Water heater install', price: 'from $1,200' }], hours: 'Mon–Fri 8–6', service_area: ['Austin', 'Round Rock'], phone: '', emergency_service: true, greeting: 'Thanks for calling Ace Plumbing, this is Harbor, the virtual assistant. How can I help?', faq: [{ q: 'Do you do emergencies?', a: 'Yes' }], missing: ['Weekend hours'] };
  let chatBody = null, callBody = null;
  await gp.route('**/api/demo-call', r => { callBody = JSON.parse(r.request().postData()); r.fulfill({ json: { ok: true, sid: 'CA1' } }); });
  await gp.route('**/api/onboard', r => r.fulfill({ json: { ok: true, profile } }));
  await gp.route('**/api/chat', r => { chatBody = JSON.parse(r.request().postData()); r.fulfill({ json: { reply: 'Drain cleaning at Ace is $99. Want me to book it?' } }); });
  await gp.goto(base + '/', { waitUntil: 'networkidle' });
  await gp.evaluate(() => localStorage.setItem('harbor_consent', 'reject'));
  await gp.locator('#callMe').scrollIntoViewIfNeeded();
  await gp.fill('#callPhone', '555 010 1234'); await gp.click('#callMe button[type=submit]');
  ok('Call-me requires consent', (await gp.textContent('#callMsg')).includes('tick the box') && callBody === null);
  await gp.check('#callConsent'); await gp.click('#callMe button[type=submit]'); await gp.waitForTimeout(400);
  ok('Call-me places the demo call', callBody?.phone === '555 010 1234' && (await gp.textContent('#callMsg')).includes('Calling you now'));
  await gp.locator('#build').scrollIntoViewIfNeeded();
  await gp.fill('#buildUrl', 'aceplumbing.com'); await gp.click('#buildForm button[type=submit]'); await gp.waitForTimeout(900);
  ok('Build-your-Harbor shows the profile', await gp.isVisible('#buildOut') && (await gp.textContent('#pCompany')) === 'Ace Plumbing' && (await gp.textContent('#pServices')).includes('$99'));
  ok('Shows what\'s missing to finish setup', (await gp.textContent('#pMissing')).includes('Weekend hours'));
  if (shots) await gp.locator('#build').screenshot({ path: `${shots}/build.png` });
  await gp.click('#pChat'); await gp.waitForTimeout(1600);
  ok('Chat switches to the visitor\'s business', (await gp.textContent('#botName')) === 'Ace Plumbing' && (await gp.locator('.msg--ai').last().textContent()).includes('Ace Plumbing'));
  await gp.fill('#botInput', 'how much is drain cleaning'); await gp.press('#botInput', 'Enter'); await gp.waitForTimeout(800);
  ok('Their Harbor answers from their own facts', chatBody?.profile?.company === 'Ace Plumbing' && (await gp.locator('.msg--ai').last().textContent()).includes('$99'));
  ok('Audit form pre-filled with their company', (await gp.inputValue('#company')) === 'Ace Plumbing');
  ok('No JS errors in growth features', gerr.length === 0); if (gerr.length) console.log(gerr);
  if (shots) { await gp.locator('.after').scrollIntoViewIfNeeded(); await gp.waitForTimeout(2200); await gp.locator('.after').screenshot({ path: `${shots}/after.png` }); }
  await gctx.close();

  // Concierge with mocked Claude API: tone, sell moment, role-play as their business
  const cctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const cp = await cctx.newPage(); const cerr = []; cp.on('pageerror', e => cerr.push(e.message));
  const bodies = []; let chatProfile = null;
  const replies = [
    { reply: "Fair question. Want to hear me answer as your receptionist?", tone: { label: 'skeptical', intensity: 'medium', cues: 'doubted it sounds real' }, stage: 'objection', sell_now: false, action: 'offer_call_demo', plan: 'none', business: { name: 'Bright Smile Dental', type: 'dental clinic', size: 'growing', pain: 'miss calls during appointments' }, roleplay_greeting: '' },
    { reply: "Switching now. Call me like a patient would!", tone: { label: 'curious', intensity: 'medium', cues: 'asked to hear it' }, stage: 'evaluating', sell_now: false, action: 'start_roleplay', plan: 'none', business: { name: 'Bright Smile Dental', type: 'dental clinic', size: 'growing', pain: '' }, roleplay_greeting: 'Thanks for calling Bright Smile Dental, this is Harbor, the virtual assistant. How can I help?' },
  ];
  await cp.route('**/api/concierge', r => { bodies.push(JSON.parse(r.request().postData())); r.fulfill({ json: replies.shift() }); });
  await cp.route('**/api/chat', r => { chatProfile = JSON.parse(r.request().postData()).profile; r.fulfill({ json: { reply: 'Of course! We have a cleaning slot Thursday at 10.' } }); });
  await cp.goto(base + '/', { waitUntil: 'networkidle' });
  await cp.evaluate(() => localStorage.setItem('harbor_consent', 'reject'));
  await cp.locator('#talk').scrollIntoViewIfNeeded(); await cp.waitForTimeout(1500);
  await cp.check('#showSense');
  await cp.fill('#botInput', 'We are Bright Smile Dental, does this really sound human?'); await cp.press('#botInput', 'Enter'); await cp.waitForTimeout(800);
  ok('Concierge sends the conversation to Claude', bodies[0]?.messages.at(-1).content.includes('Bright Smile') && bodies[0].via === 'text');
  ok('Shows the tone Claude sensed', (await cp.textContent('#botSense')).includes('skeptical') && (await cp.textContent('#botSense')).includes('doubted it sounds real'));
  ok('Offers a phone demo button', (await cp.locator('.quick .is-cta').last().textContent()).includes('call my phone'));
  await cp.fill('#botInput', 'Ok, play my receptionist'); await cp.press('#botInput', 'Enter'); await cp.waitForTimeout(3200);
  ok('Role-plays as their own business', (await cp.textContent('#botName')) === 'Bright Smile Dental' && (await cp.locator('.msg--ai').last().textContent()).includes('Bright Smile Dental'));
  await cp.fill('#botInput', 'Can I get a cleaning this week?'); await cp.press('#botInput', 'Enter'); await cp.waitForTimeout(800);
  ok('Receptionist answers as their business', chatProfile?.company === 'Bright Smile Dental' && (await cp.locator('.msg--ai').last().textContent()).includes('Thursday'));
  ok('No JS errors in concierge', cerr.length === 0); if (cerr.length) console.log(cerr);
  await cctx.close();

  // Stripe payment links on membership buttons
  const sctx = await b.newContext(); const sp = await sctx.newPage();
  await sp.route('**/config/plans.json', r => r.fulfill({ json: { tide: { monthly: 'https://buy.stripe.com/test_tide_m', yearly: 'https://buy.stripe.com/test_tide_y' }, shore: { monthly: 'https://evil.example/pay', yearly: '' }, ocean: { monthly: '', yearly: '' } } }));
  await sp.goto(base + '/', { waitUntil: 'networkidle' }); await sp.waitForTimeout(300);
  ok('Membership button goes to the Stripe payment link', (await sp.getAttribute('[data-plan=tide]', 'href')) === 'https://buy.stripe.com/test_tide_m');
  await sp.click('.toggle [data-billing=annual]');
  ok('Yearly toggle switches to the yearly link', (await sp.getAttribute('[data-plan=tide]', 'href')) === 'https://buy.stripe.com/test_tide_y');
  ok('Non-Stripe links are ignored (sign-up form instead)', (await sp.getAttribute('[data-plan=shore]', 'href')) === '#join');
  await sctx.close();

  // Industry page
  const ip = await (await b.newContext()).newPage(); const ierr = []; ip.on('pageerror', e => ierr.push(e.message));
  await ip.goto(base + '/plumbers.html', { waitUntil: 'networkidle' });
  ok('Industry page has unique title + canonical + FAQ schema', (await ip.title()).includes('Plumbers') && (await ip.getAttribute('link[rel=canonical]', 'href')).endsWith('/plumbers.html') && (await ip.locator('script[type="application/ld+json"]').count()) === 1);
  ok('Industry page has no JS errors', ierr.length === 0);

  // Mobile
  const m = await b.newContext({ ...devices['iPhone 13'] }); const mp = await m.newPage();
  await mp.goto(base + '/', { waitUntil: 'networkidle' }); await mp.waitForTimeout(2600);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('No horizontal scroll on mobile', overflow <= 1);
  await mp.click('.nav__toggle'); ok('Mobile menu opens', await mp.isVisible('#mobileMenu')); await mp.click('.nav__toggle');
  if (shots) await mp.screenshot({ path: `${shots}/mobile.png` });
  for (const path of ['/plumbers.html', '/hvac.html', '/roofers.html', '/electricians.html', '/llms.txt', '/legal/privacy.html', '/legal/terms.html', '/legal/cookies.html', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/assets/og-image.png']) {
    const r = await mp.goto(base + path); ok(`Serves ${path}`, r.status() === 200);
  }
} finally { await b.close(); srv.close(); }
const failed = results.filter(r => !r[1]).length;
console.log(failed ? `\n${failed} check(s) failed` : `\n✓ All ${results.length} launch checks passed`);
process.exit(failed ? 1 : 0);
