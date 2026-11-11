// Renders assets/og-image.png (1200x630) and assets/icon-512.png with Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync('assets/favicon.svg', 'utf8');
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:radial-gradient(70% 80% at 80% 20%,#12335f,#07111f 70%);font-family:Georgia,serif;color:#eaf2ff;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:18px;font:700 34px system-ui,sans-serif"><div style="width:64px;height:64px">${svg}</div>Harbor</div>
<h1 style="font-size:86px;line-height:1.02;margin:36px 0 22px;font-weight:400">Every call answered.<br><i style="background:linear-gradient(120deg,#5eead4,#3b82f6);-webkit-background-clip:text;color:transparent">Every job booked.</i></h1>
<p style="font:400 28px system-ui,sans-serif;color:#9db0c9;margin:0">The AI front desk for home-service businesses · Live in 7 days</p></body>`);
await p.screenshot({ path: 'assets/og-image.png' });
await p.setViewportSize({ width: 512, height: 512 });
await p.setContent(`<body style="margin:0">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body>`);
await p.screenshot({ path: 'assets/icon-512.png' });
await b.close(); console.log('images ok');
