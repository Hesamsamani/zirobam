import { test, expect, type Page } from '@playwright/test';

// The theme (dark, light, or the device's) and the accent colour, chosen in Settings.

async function openSettings(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('./');
  await expect(page.locator('#mainMenu')).toBeVisible();
  await page.locator('#mainMenu [data-tile="settings"]').click();
  await expect(page.locator('#optionsPanel')).toBeVisible();
  await page.locator('#appearanceGroup').scrollIntoViewIfNeeded();
}

const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const rootToken = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.describe('Appearance', () => {
  test('starts dark with the brass accent', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'brass');
    await expect(page.locator('#themeSelect')).toHaveValue('dark');
    await expect(page.locator('#appearanceGroup [data-accent="brass"]')).toHaveAttribute('aria-checked', 'true');
    expect(await bodyBackground(page)).toBe('rgb(30, 29, 27)');
  });

  test('the light theme changes the page, the browser bar, and is still there after a reload', async ({ page }) => {
    await openSettings(page);
    await page.locator('#themeSelect').selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bodyBackground(page)).toBe('rgb(233, 237, 241)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#e2e7ec');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bodyBackground(page)).toBe('rgb(233, 237, 241)');
    // and back
    await page.locator('#mainMenu [data-tile="settings"]').click();
    await page.locator('#themeSelect').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1a1a1a');
  });

  test('"Same as the device" follows the device, and a change of the device while the app is open', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openSettings(page);
    await page.locator('#themeSelect').selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#themeSelect')).toHaveValue('system');
  });

  test('an accent colour is chosen from six swatches that share one row, and is kept', async ({ page }) => {
    await openSettings(page);
    const swatches = page.locator('#appearanceGroup [data-accent]');
    await expect(swatches).toHaveCount(6);
    const tops = await swatches.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const boxes = await swatches.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    expect(Math.min(...boxes)).toBeGreaterThanOrEqual(36);
    expect(await rootToken(page, '--current')).toBe('#c9a227');
    await page.locator('#appearanceGroup [data-accent="violet"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
    await expect(page.locator('#appearanceGroup [data-accent="violet"]')).toHaveAttribute('aria-checked', 'true');
    expect(await rootToken(page, '--current')).toBe('#b39dff');
    // the same accent is deeper on the light theme, so it stays readable
    await page.locator('#themeSelect').selectOption('light');
    expect(await rootToken(page, '--current')).toBe('#5b44b8');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
  });

  test('the arrow keys move between the swatches', async ({ page }) => {
    await openSettings(page);
    await page.locator('#appearanceGroup [data-accent="brass"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet');
    await expect(page.locator('#appearanceGroup [data-accent="violet"]')).toBeFocused();
  });

  test('the staff stays paper in the light theme, so the notes read as on printed music', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.theme', 'light'));
    await page.goto('#/levels');
    await expect(page.locator('#notation svg').first()).toBeVisible({ timeout: 30000 });
    const paper = await page.locator('#notation svg').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(paper).toBe('rgb(248, 245, 240)');
  });

  test('has Persian names, and the same six swatches', async ({ page }) => {
    await openSettings(page, 'fa');
    await expect(page.locator('#appearanceGroup h3')).toHaveText('ظاهر');
    await expect(page.locator('#themeSelect option')).toHaveText(['تیره', 'روشن', 'مطابق دستگاه']);
    await expect(page.locator('#appearanceGroup [data-accent="rose"]')).toHaveAttribute('aria-label', 'صورتی');
    await expect(page.locator('#appearanceGroup [data-accent]')).toHaveCount(6);
  });
});
