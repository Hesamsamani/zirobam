import { test, expect, type Page } from '@playwright/test';

async function openRhythm(page: Page, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="rhythm"]').click();
  await expect(page.locator('#rhythmView')).toBeVisible();
  await expect(page.locator('#rhythmView .rh-staff svg .note').first()).toBeVisible();
}

test.describe('Rhythm trainer', () => {
  test('opens from the menu with a rhythm on the staff, and level 1 only', async ({ page }) => {
    await openRhythm(page);
    await expect(page.locator('#rhythmView .view-title')).toHaveText('Rhythm trainer');
    await expect(page.locator('#rhythmView .rh-levels [data-level="2"]')).toBeDisabled();
    await expect(page.locator('#rhythmView .rh-state')).toHaveText('Press Start.');
  });

  test('counts in with clicks from the app, shows the taps window, takes taps and stops', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openRhythm(page);
    await page.locator('#rhythmView .rh-start').click();
    await expect(page.locator('#rhythmView .rh-state')).toHaveText('Count in…');
    await expect(page.locator('#rhythmView .rh-start')).toHaveText('Stop');
    await expect(page.locator('#rhythmView .rh-state')).toHaveText('Tap the rhythm.', { timeout: 8000 });
    await page.locator('#rhythmView .rh-pad').click();
    await page.locator('#rhythmView .rh-start').click();
    await expect(page.locator('#rhythmView .rh-start')).toHaveText('Start');
    expect(errors).toEqual([]);
  });

  test('a round that is not played ends with its result, in words', async ({ page }) => {
    await openRhythm(page);
    await page.locator('#rhythmView .rh-start').click();
    await expect(page.locator('#rhythmView .rh-result')).toContainText('Not quite on time yet.', { timeout: 25000 });
    await expect(page.locator('#rhythmView .rh-result')).toContainText('missed');
    await expect(page.locator('#rhythmView .rh-staff .rh-missed').first()).toBeVisible();
  });

  test('is in Persian, with the staff left to right, and fits the screen', async ({ page }) => {
    await openRhythm(page, 'fa');
    await expect(page.locator('#rhythmView .view-title')).toHaveText('تمرین ریتم');
    expect(await page.locator('#rhythmView .rh-staff').getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
