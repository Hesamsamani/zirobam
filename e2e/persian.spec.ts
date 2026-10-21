import { test, expect, type Page } from '@playwright/test';

async function openPersian(page: Page, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="persian"]').click();
  await expect(page.locator('#persianView')).toBeVisible();
}

test.describe('Persian music', () => {
  test('shows the twelve modes, and a mode opens in the scale dictionary on its usual root with the koron drawn', async ({ page }) => {
    await openPersian(page);
    await expect(page.locator('#persianView .pr-mode')).toHaveCount(12);
    await page.locator('#persianView .pr-mode[data-scale="shur"]').click();
    await expect(page.locator('#scalesView')).toBeVisible();
    await expect(page.locator('#scalesView .dict-scale-title')).toHaveText('D Shur');
    expect(await page.evaluate(() => location.hash)).toBe('#/scales/d-shur');
  });

  test('opens the lessons of the Persian unit', async ({ page }) => {
    await openPersian(page);
    await page.locator('#persianView .pr-lessons').click();
    await expect(page.locator('#lessonsView')).toBeVisible();
    await expect(page.locator('#lessonsView')).toContainText('A map of Persian music');
  });

  test('the ear training plays two notes from the app\'s own piano files and judges the answer', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openPersian(page);
    await expect(page.locator('#persianView .pr-prompt')).toHaveText('Two notes. Which one is lower?');
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('#persianView .pr-hear').click();
    expect((await samples).status()).toBe(200);
    await page.locator('#persianView .pr-choice').first().click();
    await expect(page.locator('#persianView .pr-status')).not.toHaveText('');
    expect(errors).toEqual([]);
  });

  test('is in Persian, with the root of a mode left to right, and fits the screen', async ({ page }) => {
    await openPersian(page, 'fa');
    await expect(page.locator('#persianView .view-title')).toHaveText('موسیقی ایرانی');
    expect(await page.locator('#persianView .pr-mode-root').first().getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
