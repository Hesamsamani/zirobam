import { test, expect } from '@playwright/test';

/**
 * Runs against the production build (project "offline", `vite preview`): the stored theme and language must be on the
 * page before the app's own script has run, or a visit would flash the dark, left-to-right page first. The test holds
 * the main script back and looks at the page meanwhile.
 */
test.describe('First paint', () => {
  test('the stored light theme, accent and Persian are on the page while the app script is still held back', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ui.theme', 'light');
      localStorage.setItem('ui.accent', 'rose');
      localStorage.setItem('ui.locale', 'fa');
    });
    // hold the entry script back for a while; the style sheet is not held, so the page is drawn
    await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto('./', { waitUntil: 'commit' });
    await page.waitForTimeout(900);

    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      accent: document.documentElement.dataset.accent,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      appStarted: document.querySelector('#mainMenu') !== null,
      background: document.body ? getComputedStyle(document.body).backgroundColor : null,
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    }));
    expect(state.appStarted, 'the app script must still be held back for this test to mean anything').toBe(false);
    expect(state).toMatchObject({ theme: 'light', accent: 'rose', lang: 'fa', dir: 'rtl', background: 'rgb(233, 237, 241)', themeColor: '#e2e7ec' });

    // and when the script arrives it keeps what was already on the page
    await expect(page.locator('#mainMenu')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('a first visit has no theme stored: dark, brass, English, as before', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'brass');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
