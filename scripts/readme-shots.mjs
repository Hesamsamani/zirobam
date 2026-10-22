// Takes the screenshots of the README into docs/images. Run by hand after the look of the app changes:
//   node scripts/readme-shots.mjs
// It starts the development server itself and needs Playwright's chromium (`npx playwright install chromium`).
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'images');
mkdirSync(OUT, { recursive: true });
copyFileSync(path.join(ROOT, 'public', 'favicon.svg'), path.join(OUT, 'logo.svg'));

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: true } });
await server.listen();
const BASE = 'http://localhost:5199/zirobam/';

/** name, address, look, what to do before the picture, and the size */
const SHOTS = [
  { name: 'home', hash: '#/', look: { theme: 'dark', accent: 'brass' }, size: [1280, 860] },
  { name: 'home-light-fa', hash: '#/', look: { theme: 'light', accent: 'rose', locale: 'fa' }, size: [1280, 860] },
  { name: 'stand', hash: '#/levels', look: { theme: 'dark', accent: 'brass' }, size: [1280, 800], click: ['#pianoToggle'], wait: '#notation svg' },
  { name: 'dictionary', hash: '#/scales/d-shur', look: { theme: 'dark', accent: 'violet' }, size: [1280, 900], wait: '.sc-staff svg .note' },
  { name: 'maker', hash: '#/generator?t=prog&s=c-major&style=jazz&bars=8&seed=12', look: { theme: 'light', accent: 'blue' }, size: [1280, 900], wait: '.gen-line svg .note' },
  { name: 'phone-home', hash: '#/', look: { theme: 'dark', accent: 'copper' }, size: [390, 844], phone: true },
  { name: 'phone-drawer', hash: '#/lessons', look: { theme: 'light', accent: 'violet' }, size: [390, 844], phone: true, click: ['.nav-handle'], settle: 600 },
];

const browser = await chromium.launch();
for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.size[0], height: shot.size[1] },
    deviceScaleFactor: shot.phone ? 2 : 1,
    isMobile: Boolean(shot.phone),
    hasTouch: Boolean(shot.phone),
    reducedMotion: 'reduce',
  });
  await context.addInitScript((look) => {
    localStorage.setItem('ui.theme', look.theme);
    localStorage.setItem('ui.accent', look.accent);
    localStorage.setItem('ui.locale', look.locale ?? 'en');
  }, shot.look);
  const page = await context.newPage();
  await page.goto(BASE + shot.hash);
  await page.locator(shot.wait ?? 'body').first().waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  for (const selector of shot.click ?? []) {
    await page.locator(selector).first().click({ force: true });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(shot.settle ?? 300);
  await page.screenshot({ path: path.join(OUT, `${shot.name}.png`) });
  console.log(shot.name);
  await context.close();
}
await browser.close();
await server.close();
