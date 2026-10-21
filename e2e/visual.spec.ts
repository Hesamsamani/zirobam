import { test, expect, type Page } from '@playwright/test';

// Screenshot baselines for the screens whose content never changes between runs. They guard style refactors
// (tokens, CSS split): the pictures must stay the same unless a change is meant to alter them.
// Run: `npx playwright test --project=visual`; accept intended changes with `--update-snapshots`.
// The exercise screen is left out on purpose, it draws random music.

async function open(page: Page, hash: string, ready: string, locale?: 'fa'): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto(`/#/${hash}`);
  await expect(page.locator(ready).first()).toBeVisible();
  // fonts and the staff are drawn a moment after the screen is shown
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', maxDiffPixels: 0 });

test.describe('Visual baseline', () => {
  test('home', async ({ page }) => {
    await open(page, '', '#mainMenu .menu-tile');
    await shot(page, 'home');
  });

  test('home in Persian', async ({ page }) => {
    await open(page, '', '#mainMenu .menu-tile', 'fa');
    await shot(page, 'home-fa');
  });

  test('scale and chord dictionary', async ({ page }) => {
    await open(page, 'scales/c-major', '.sc-staff svg .note');
    await shot(page, 'scales');
  });

  test('dictionary: a Persian mode with its quarter tone', async ({ page }) => {
    await open(page, 'scales/d-shur', '.sc-staff svg .note');
    await shot(page, 'scales-shur');
  });

  test('dictionary: the chords of a scale', async ({ page }) => {
    await open(page, 'scales/c-major', '.sc-staff svg .note');
    await page.locator('.sc-tab[data-tab="chords"]').click();
    await expect(page.locator('.dict-card').first()).toBeVisible();
    await shot(page, 'scales-chords');
  });

  test('dictionary: the chord dialog', async ({ page }) => {
    await open(page, 'scales/c-major', '.sc-staff svg .note');
    await page.locator('.sc-tab[data-tab="chords"]').click();
    await page.locator('.dict-families [data-family="seventh"]').click();
    await page.locator('.dict-card').first().click();
    await expect(page.locator('.cd-staff svg .note').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await shot(page, 'scales-chord-dialog');
  });

  test('dictionary in Persian', async ({ page }) => {
    await open(page, 'scales/ek-segah', '.sc-staff svg .note', 'fa');
    await shot(page, 'scales-segah-fa');
  });

  test('songs', async ({ page }) => {
    await open(page, 'songs', '#songsView .song-card');
    await shot(page, 'songs');
  });

  test('lessons', async ({ page }) => {
    await open(page, 'lessons', '#lessonsView');
    await shot(page, 'lessons');
  });

  test('progress', async ({ page }) => {
    await open(page, 'progress', '#progressView');
    await shot(page, 'progress');
  });
});
