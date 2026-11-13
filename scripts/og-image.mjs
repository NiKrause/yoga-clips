// The link preview (static/og-image.png, 1200×630): the signet on night, the
// wordmark in Sora, the tagline. Drawn by Chromium, since the wordmark needs
// the font; nothing is loaded from the network.
//   node scripts/og-image.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const mark = readFileSync(new URL('brand/mark-dark.svg', root), 'utf8');
const font = readFileSync(new URL('src/lib/fonts/sora-latin-wght-normal.woff2', root)).toString(
	'base64'
);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; background: #0b0e15; color: #f4f6fb; font-family: Sora, sans-serif; overflow: hidden; }
.row { position: absolute; inset: 0; display: flex; align-items: center; gap: 64px; padding: 0 110px; }
.row svg { width: 250px; height: 250px; flex: none; }
.words { display: flex; flex-direction: column; gap: 16px; }
.prefix { color: #7c5cff; letter-spacing: .32em; font-weight: 500; font-size: 26px; }
.name { font-weight: 700; letter-spacing: -.03em; font-size: 112px; line-height: 1; }
.tagline { margin-top: 18px; font-size: 30px; line-height: 40px; color: #8a94a6; max-width: 640px; }
.rule { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: #c6f24e; }
</style></head><body><div class="row">${mark}<div class="words">
<span class="prefix">LE SPACE</span><span class="name">yoga clips</span>
<span class="tagline">Short clips from your favourite teachers, shared peer to peer.</span>
</div></div><div class="rule"></div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(async () => {
	await Promise.all(['500', '700'].map((w) => document.fonts.load(`${w} 40px Sora`)));
});
await page.screenshot({ path: new URL('static/og-image.png', root).pathname });
await browser.close();
console.log('static/og-image.png');
