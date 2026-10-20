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

  test('scales and chords', async ({ page }) => {
    await open(page, 'scales', '.sc-staff svg .note');
    await shot(page, 'scales');
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
