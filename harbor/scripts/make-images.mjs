// Renders assets/og-image.png (1200x630) and assets/icon-512.png with Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync('assets/favicon.svg', 'utf8');
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:radial-gradient(60% 80% at 85% 15%,#34527A,#101D30 70%);font-family:system-ui,sans-serif;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:18px;font:700 34px system-ui,sans-serif"><div style="width:64px;height:64px">${svg}</div>Harbor</div>
<h1 style="font-size:92px;line-height:1.02;margin:36px 0 22px;font-weight:700;letter-spacing:-3px">Your Business.<br><i style="font-family:Georgia,serif;font-weight:400;color:#D8C6A5;letter-spacing:-1px">Smarter With AI.</i></h1>
<p style="font:400 28px system-ui,sans-serif;color:#C4D0DE;margin:0">The AI receptionist that answers every call</p></body>`);
await p.screenshot({ path: 'assets/og-image.png' });
await p.setViewportSize({ width: 512, height: 512 });
await p.setContent(`<body style="margin:0">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body>`);
await p.screenshot({ path: 'assets/icon-512.png' });
await b.close(); console.log('images ok');
