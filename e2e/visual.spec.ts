import { test, expect, type Page } from '@playwright/test';

// Screenshot baselines for the screens whose content never changes between runs. They guard style refactors
// (tokens, CSS split): the pictures must stay the same unless a change is meant to alter them.
// Run: `npx playwright test --project=visual`; accept intended changes with `--update-snapshots`.
// The exercise screen is left out on purpose, it draws random music.

async function open(page: Page, hash: string, ready: string, locale?: 'fa', look: { theme?: 'light'; accent?: string } = {}): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  if (look.theme) await page.addInitScript((value) => localStorage.setItem('ui.theme', value), look.theme);
  if (look.accent) await page.addInitScript((value) => localStorage.setItem('ui.accent', value), look.accent);
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

  test('music maker', async ({ page }) => {
    await open(page, 'generator?t=prog&s=c-major&style=jazz&bars=8&seed=12', '.gen-line svg .note');
    await shot(page, 'generator');
  });

  test('music maker in Persian', async ({ page }) => {
    await open(page, 'generator?t=melody&s=c-major&style=bossa&bars=8&seed=3&over=progression', '.gen-line svg .note', 'fa');
    await shot(page, 'generator-fa');
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

// The light theme and the accent colours: a cool desk with the warm paper of the staves on it.
test.describe('Visual baseline: themes and accents', () => {
  test('home, light', async ({ page }) => {
    await open(page, '', '#mainMenu .menu-tile', undefined, { theme: 'light' });
    await shot(page, 'home-light');
  });

  test('home, dark with the violet accent', async ({ page }) => {
    await open(page, '', '#mainMenu .menu-tile', undefined, { accent: 'violet' });
    await shot(page, 'home-violet');
  });

  test('dictionary, light', async ({ page }) => {
    await open(page, 'scales/d-shur', '.sc-staff svg .note', undefined, { theme: 'light' });
    await shot(page, 'scales-light');
  });

  test('music maker in Persian, light with the rose accent', async ({ page }) => {
    await open(page, 'generator?t=melody&s=c-major&style=bossa&bars=8&seed=3&over=progression', '.gen-line svg .note', 'fa', { theme: 'light', accent: 'rose' });
    await shot(page, 'generator-fa-light');
  });

  test('settings panel, light with the copper accent', async ({ page }) => {
    await open(page, '', '#mainMenu .menu-tile', undefined, { theme: 'light', accent: 'copper' });
    await page.locator('#mainMenu [data-tile="settings"]').click();
    await expect(page.locator('#optionsPanel')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.locator('#optionsPanel')).toHaveScreenshot('settings-light-copper.png', { animations: 'disabled', maxDiffPixels: 0 });
  });
});
