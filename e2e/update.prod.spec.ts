import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Runs against the production build (project "offline"). A new version of the app must reach a page that stays open:
 * the browser finds the new worker, the page says "A new version of ZiroBam is ready", and on Reload the new version
 * takes over. The build is served from here, so the test can change the worker script while the page is open.
 */

const DIST = path.resolve(process.cwd(), 'dist'); // the tests run from the root of the project
const BASE = '/zirobam/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

let server: Server;
let origin = '';
let workerSource = '';

test.beforeAll(async () => {
  workerSource = readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(BASE)) {
      response.writeHead(404).end();
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
    if (relative === 'sw.js') {
      response.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-cache' }).end(workerSource);
      return;
    }
    const file = path.join(DIST, relative);
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const cacheNames = (page: Page) => page.evaluate(async () => (await caches.keys()).filter((name) => name.startsWith('zirobam-')));

/** The same, but waits out a reload: while the page is being replaced it has no answer yet. */
const cacheNamesAfterReload = (page: Page) => cacheNames(page).catch(() => [] as string[]);

async function openAndSave(page: Page) {
  await page.goto(`${origin}${BASE}`);
  await expect(page.locator('#mainMenu')).toBeVisible();
  // the first worker fetches every file of the build: wait until the piano sounds are in the store
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          const names = (await caches.keys()).filter((name) => name.startsWith('zirobam-'));
          if (names.length === 0) return 0;
          return (await (await caches.open(names[0])).keys()).filter((request) => request.url.includes('/samples/salamander/')).length;
        }),
      { timeout: 60000, intervals: [500] },
    )
    .toBe(30);
}

/** A build that differs from the one the page has: only its version, which is all a new build changes for the worker. */
const nextVersion = (version: string) => workerSource.replace(/const VERSION = '[0-9a-f]{12}';/, `const VERSION = '${version}';`);

async function lookForUpdate(page: Page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration!.update();
  });
}

test.describe('A new version of the app', () => {
  test('reaches a page that stays open: it is offered, and takes over when the person presses Reload', async ({ page }) => {
    await openAndSave(page);
    const before = await cacheNames(page);
    expect(before).toHaveLength(1);
    await expect(page.locator('.update-banner')).toHaveCount(0);

    workerSource = nextVersion('0123456789ab');
    await lookForUpdate(page);
    const banner = page.locator('.update-banner');
    await expect(banner).toBeVisible({ timeout: 60000 });
    await expect(banner).toContainText('A new version of ZiroBam is ready.');
    // it has not taken over by itself: the page still runs on the old build
    expect(await cacheNames(page)).toEqual(expect.arrayContaining(before));

    await page.locator('.update-reload').click();
    await expect.poll(() => cacheNamesAfterReload(page), { timeout: 60000 }).toEqual(['zirobam-0123456789ab']);
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('.update-banner')).toHaveCount(0);
  });

  test('can be left for later, and then the page is not touched', async ({ page }) => {
    await openAndSave(page);
    const before = await cacheNames(page);
    workerSource = nextVersion('ba9876543210');
    await lookForUpdate(page);
    await expect(page.locator('.update-banner')).toBeVisible({ timeout: 60000 });
    await page.locator('.update-later').click();
    await expect(page.locator('.update-banner')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await cacheNames(page)).toEqual(expect.arrayContaining(before));
    await expect(page.locator('#mainMenu')).toBeVisible();
  });

  test('says so in Persian when the language is', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await openAndSave(page);
    workerSource = nextVersion('00ff00ff00ff');
    await lookForUpdate(page);
    await expect(page.locator('.update-banner')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.update-banner .update-text')).toHaveText('نسخهٔ تازهٔ زیر و بم آماده است.');
  });
});
