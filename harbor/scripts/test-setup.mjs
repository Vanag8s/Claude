// Tests the member setup page: load a business, quiz its receptionist, argue, buy, save, and edit again.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = new URL('..', import.meta.url).pathname;
const results = []; const ok = (n, c) => { results.push(!!c); console.log(`${c ? '✓' : '✗'} ${n}`); };
const shots = process.argv[2];

await rm(root + 'data', { recursive: true, force: true });
const srv = spawn('node', ['scripts/dev-server.mjs'], { cwd: root, env: { ...process.env, PORT: '4181', ANTHROPIC_API_KEY: '' } });
await new Promise(r => setTimeout(r, 900));
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // No API key here: block the AI endpoints so the offline brain answers (as in the preview).
  await p.route('**/api/assistant', r => r.fulfill({ status: 503, json: { error: 'no key' } }));
  await p.goto('http://localhost:4181/setup.html', { waitUntil: 'networkidle' });
  await p.click('#exampleBtn'); await p.waitForTimeout(600);
  ok('Loads the example business into the form', (await p.inputValue('input[name=company]')) === 'Lagoon Bay Waterpark' && (await p.locator('#offerings .rowi').count()) >= 5);
  ok('Sales mode shows the selling settings', await p.isVisible('#salesBlock'));
  const ask = async q => { await p.fill('#testInput', q); await p.press('#testInput', 'Enter'); await p.waitForTimeout(800); return p.locator('.msg--ai').last().textContent(); };
  let a = await ask('When do you open on Saturday?');
  ok('Answers opening hours from the owner\'s info', a.includes('Saturday and Sunday 09:00') );
  a = await ask('Can my 14 year old son come in without a parent?');
  ok('Quotes the age rule for a 14-year-old', a.includes('14 and 15 may visit without an adult') && a.includes('student ID'));
  a = await ask('How much are tickets?');
  ok('Gives prices', a.includes('$29') || a.includes('$19'));
  ok('Upsells in sales mode', a.includes('By the way'));
  a = await ask("Hmm, that's too expensive for my family.");
  ok('Handles the price objection with the owner\'s argument', a.includes('family ticket') || a.includes('$96'));
  a = await ask("OK, I'll take the family ticket");
  ok('Closes the sale', a.toLowerCase().includes('family ticket') && (await p.locator('.action--sale').count()) === 1);
  a = await ask('Do you have a helicopter landing pad?');
  ok("Doesn't guess when it doesn't know", a.includes("don't have that information"));
  if (shots) await p.screenshot({ path: `${shots}/setup.png`, fullPage: false });

  await p.fill('input[name=phone_number]', '+15550123');
  await p.click('#saveBtn'); await p.waitForTimeout(800);
  ok('Saves the business and shows an admin key', await p.isVisible('#keyBox') && (await p.textContent('#bizKey')).length > 20);
  const id = await p.textContent('#bizId');
  const key = await p.textContent('#bizKey');
  const forged = await (await fetch(`http://localhost:4181/api/business?id=${id}`, { headers: { 'x-admin-key': 'wrong' } })).status;
  ok('Wrong admin key is refused', forged === 403);
  const store = await import('../api/_lib/store.js');
  const rec = await store.businessForNumber('+1 (555) 0123');
  ok('Calls to the Harbor number find this business', rec?.profile.company === 'Lagoon Bay Waterpark');

  await p.fill('textarea[name=hours]', 'Every day 08:00–23:00'); await p.click('#saveBtn'); await p.waitForTimeout(700);
  const p2 = await ctx.newPage();
  await p2.goto(`http://localhost:4181/setup.html?id=${id}`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(600);
  ok('Owner can come back and edit', (await p2.inputValue('textarea[name=hours]')) === 'Every day 08:00–23:00' && key.length > 20);
  ok('No JS errors on the setup page', errs.length === 0); if (errs.length) console.log(errs);
} finally { await b.close(); srv.kill(); await rm(root + 'data', { recursive: true, force: true }); }
const failed = results.filter(x => !x).length;
console.log(failed ? `\n${failed} setup check(s) failed` : `\n✓ All ${results.length} setup checks passed`);
process.exit(failed ? 1 : 0);
