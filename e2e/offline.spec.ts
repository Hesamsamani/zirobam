import { test, expect, type Page } from '@playwright/test';

/**
 * These tests run against the production build (`vite preview`, project "offline"): the development server has no
 * service worker. The first visit saves the app; after that the network is switched off.
 */

async function waitUntilSaved(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // the worker fetches every file of the build when it installs: wait until the piano sounds are in the store
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const names = (await caches.keys()).filter((name) => name.startsWith('zirobam-'));
          if (names.length === 0) return 0;
          const cache = await caches.open(names[0]);
          return (await cache.keys()).filter((request) => request.url.includes('/samples/salamander/')).length;
        }),
      { timeout: 60000, intervals: [500] },
    )
    .toBe(30);
}

test.describe('Without internet', () => {
  test('makes no request to any other site, even on the first visit', async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.hostname !== 'localhost') outside.push(request.url());
    });
    await page.goto('./');
    await expect(page.locator('#mainMenu')).toBeVisible();
    await page.goto('#/levels');
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).toHaveClass(/playing/, { timeout: 30000 });
    expect(outside).toEqual([]);
  });

  test('the app opens, and the piano plays, with the network switched off', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.locator('#mainMenu')).toBeVisible();
    await waitUntilSaved(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#mainMenu')).toBeVisible();
    // other screens come from the store too, with their lazily loaded parts
    await page.goto('#/catalog');
    await expect(page.locator('#catalogView .catalog-row').first()).toBeVisible({ timeout: 15000 });
    await page.goto('#/lessons');
    await expect(page.locator('#lessonsView')).toBeVisible();
    // the piano sounds are served from the store
    const status = await page.evaluate(async () => (await fetch(new URL('samples/salamander/C4.mp3', document.baseURI))).status);
    expect(status).toBe(200);
    await page.goto('#/levels');
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).toHaveClass(/playing/, { timeout: 30000 });
    await expect(page.locator('#notice').filter({ hasText: /sound/i })).toHaveCount(0); // no 'the sounds could not be loaded'
  });

  test('says in the options that the app now works without internet', async ({ page }) => {
    await page.goto('./');
    await waitUntilSaved(page);
    await page.locator('[data-tile="settings"]').click();
    await expect(page.locator('#optionsPanel .pwa-offline')).toContainText('works without internet');
  });

  test('has a web app manifest with icons that load', async ({ page, request }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href!, page.url()).href;
    const manifest = await (await request.get(manifestUrl)).json();
    expect(manifest).toMatchObject({ name: 'ZiroBam', display: 'standalone', start_url: './', scope: './' });
    expect(manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icon of manifest.icons) {
      const response = await request.get(new URL(icon.src, manifestUrl).href);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('has a tab icon that loads: an .ico for every browser, the SVG, and the icon of the home screen', async ({ page, request }) => {
    await page.goto('./');
    const links = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) => els.map((el) => (el as HTMLLinkElement).href));
    expect(links).toHaveLength(3);
    expect(links.some((href) => href.endsWith('/favicon.ico'))).toBe(true);
    for (const href of links) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
      expect(response.headers()['content-type'], href).toMatch(/^image\//);
    }
  });

  test('the worker of the build has the list of files and a version', async ({ request, baseURL }) => {
    const source = await (await request.get(new URL('sw.js', baseURL).href)).text();
    expect(source).toMatch(/const VERSION = '[0-9a-f]{12}';/);
    const list = JSON.parse(/const PRECACHE = (\[.*\]);/.exec(source)![1]) as string[];
    expect(list).toContain('index.html');
    expect(list.filter((file) => file.startsWith('samples/salamander/'))).toHaveLength(30);
    expect(list.some((file) => file.startsWith('assets/') && file.endsWith('.js'))).toBe(true);
  });
});
