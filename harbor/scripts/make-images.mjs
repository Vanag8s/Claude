// Renders assets/og-image.png (1200x630) and assets/icon-512.png with Playwright.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const svg = readFileSync('assets/favicon.svg', 'utf8');
const b = await chromium.launch(); const p = await b.newPage();
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(`<body style="margin:0;width:1200px;height:630px;background:linear-gradient(180deg,#bfdde6 0%,#f7e6cf 55%,#2f8ea0 56%,#1f7a8c 72%,#fbfdfc 73%,#e7d3b2 76%,#f4e9d8 100%);font-family:Georgia,serif;color:#16324a;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:18px;font:700 34px system-ui,sans-serif"><div style="width:64px;height:64px">${svg}</div>Harbor</div>
<h1 style="font-size:86px;line-height:1.02;margin:36px 0 22px;font-weight:400">Every call answered.<br><i style="color:#1d6f86">Like the tide, always.</i></h1>
<p style="font:400 28px system-ui,sans-serif;color:#2b4a63;margin:0">The AI receptionist membership · Never miss a call</p></body>`);
await p.screenshot({ path: 'assets/og-image.png' });
await p.setViewportSize({ width: 512, height: 512 });
await p.setContent(`<body style="margin:0">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body>`);
await p.screenshot({ path: 'assets/icon-512.png' });
await b.close(); console.log('images ok');
