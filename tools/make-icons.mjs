// Рисует PNG-иконки приложения из SVG (нужен Playwright + Chromium). Запуск: node tools/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { capybara, panda } from '../src/characters.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.execPath, '../../lib/node_modules/playwright')));
}

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
function icon({ pad = 0 } = {}) {
  const s = 512, k = (s - pad * 2) / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FE3FF"/><stop offset="1" stop-color="#FFD166"/></linearGradient></defs>
  <rect width="${s}" height="${s}" rx="${pad ? 0 : 112}" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${k})">
    <ellipse cx="256" cy="470" rx="220" ry="30" fill="#52B788"/>
    <g transform="translate(20 110) scale(1.6)">${inner(panda({ mood: 'happy' }))}</g>
    <g transform="translate(236 160) scale(1.35)">${inner(capybara({ mood: 'happy' }))}</g>
  </g>
</svg>`;
}

fs.writeFileSync(path.join(ROOT, 'assets/icon.svg'), icon());
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 70],
  ['apple-touch-icon.png', 180, 0],
]) {
  await page.setViewportSize({ width: size, height: size });
  const svg = icon({ pad }).replace(/rx="112"/, 'rx="0"');
  await page.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(ROOT, 'assets', file), omitBackground: false });
  console.log('✔ assets/' + file);
}
await browser.close();
