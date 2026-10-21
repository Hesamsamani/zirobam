// Draws the icons of the app from the SVG of the mark. Run by hand after the mark changes: `node scripts/build-icons.mjs`.
// The results are committed, so a normal build needs no browser for this.
//
//   public/favicon.svg                    the mark (also the source of the large icons)
//   scripts/icons/mark-small.svg          heavier, for 16 and 32 pixels
//   scripts/icons/mark-maskable.svg       full-bleed, for the maskable icon and the icon of the home screen
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packIco } from './ico.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (...parts) => path.join(ROOT, ...parts);
const svg = (...parts) => readFileSync(file(...parts), 'utf8');

const MARK = svg('public', 'favicon.svg');
const SMALL = svg('scripts', 'icons', 'mark-small.svg');
const MASKABLE = svg('scripts', 'icons', 'mark-maskable.svg');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** The picture of an SVG at `size` pixels; the corners the SVG leaves empty stay transparent. */
async function draw(source, size) {
  await page.setViewportSize({ width: size, height: size });
  const url = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
  await page.setContent(`<!doctype html><body style="margin:0;background:transparent"><img id="m" src="${url}" width="${size}" height="${size}" style="display:block">`);
  await page.evaluate(() => document.getElementById('m').decode());
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

const outputs = [
  ['public/icons/favicon-32.png', SMALL, 32],
  ['public/icons/apple-touch-icon.png', MASKABLE, 180],
  ['public/icons/icon-192.png', MARK, 192],
  ['public/icons/icon-512.png', MARK, 512],
  ['public/icons/icon-maskable-512.png', MASKABLE, 512],
];
for (const [name, source, size] of outputs) {
  writeFileSync(file(name), await draw(source, size));
  console.log(`${name} ${size}x${size}`);
}

const ico = packIco([
  { size: 16, png: await draw(SMALL, 16) },
  { size: 32, png: await draw(SMALL, 32) },
  { size: 48, png: await draw(MARK, 48) },
]);
writeFileSync(file('public', 'favicon.ico'), ico);
console.log(`public/favicon.ico 16, 32, 48 (${ico.length} bytes)`);

// the icon of the Desktop shortcut
const shortcut = packIco([{ size: 256, png: await draw(MARK, 256) }]);
writeFileSync(file('Start-Trainer.ico'), shortcut);
console.log(`Start-Trainer.ico 256 (${shortcut.length} bytes)`);

await browser.close();
