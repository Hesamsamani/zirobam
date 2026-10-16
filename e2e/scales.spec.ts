import { test, expect, type Page } from '@playwright/test';

async function openScales(page: Page, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="scales"]').click();
  await expect(page.locator('#scalesView')).toBeVisible();
  await expect(page.locator('.sc-staff svg .note').first()).toBeVisible();
}
const labels = (page: Page) => page.locator('.sc-staff .note-label').allTextContents();
const key = (page: Page, note: string) => page.locator(`.sc-keys .lk-key[data-note="${note}"]`);

test.describe('Scales and chords', () => {
  test('opens from the menu on the C major scale: staff, keys and notes', async ({ page }) => {
    await openScales(page);
    await expect(page.locator('#scalesView .view-title')).toHaveText('Scales and chords');
    await expect(page.locator('.sc-roots .sc-chip')).toHaveCount(12);
    await expect(page.locator('.sc-staff svg .note')).toHaveCount(8);
    await expect(page.locator('.sc-keys .lk-key.marked')).toHaveCount(8);
    await expect(page.locator('.sc-notes')).toHaveText('Notes: C D E F G A B C');
    expect(await labels(page)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });

  test('another key: D flat major has its key signature and its own keys', async ({ page }) => {
    await openScales(page);
    await page.locator('.sc-roots [data-root="1"]').click();
    await expect(page.locator('.sc-roots [aria-pressed="true"]')).toHaveText('D♭');
    await expect(page.locator('.sc-notes')).toHaveText('Notes: D♭ E♭ F G♭ A♭ B♭ C D♭');
    await expect(key(page, 'C#4')).toHaveClass(/marked/);
    await expect(key(page, 'D4')).not.toHaveClass(/marked/);
    // five flats at the start of the staff
    await expect(page.locator('.sc-staff .keySig .keyAccid')).toHaveCount(5);
  });

  test('fingering under the notes, for the right and the left hand', async ({ page }) => {
    await openScales(page);
    await page.locator('.sc-labels [data-labels="right"]').click();
    expect(await labels(page)).toEqual(['1', '2', '3', '1', '2', '3', '4', '5']);
    await page.locator('.sc-labels [data-labels="left"]').click();
    expect(await labels(page)).toEqual(['5', '4', '3', '2', '1', '3', '2', '1']);
    await page.locator('.sc-roots [data-root="1"]').click();
    await expect(page.locator('.sc-note')).toContainText('no fingering');
  });

  test('other kinds of scale, and chords', async ({ page }) => {
    await openScales(page);
    await page.locator('.sc-roots [data-root="9"]').click();
    await page.locator('.sc-types [data-type="harmonic"]').click();
    await expect(page.locator('.sc-notes')).toHaveText('Notes: A B C D E F G♯ A');
    await page.locator('.sc-tab[data-tab="chords"]').click();
    await expect(page.locator('.sc-types .sc-chip')).toHaveCount(7);
    await expect(page.locator('.sc-labels')).toBeHidden();
    await page.locator('.sc-roots [data-root="0"]').click();
    await page.locator('.sc-types [data-type="maj7"]').click();
    await expect(page.locator('.sc-notes')).toHaveText('Notes: C E G B');
    await expect(page.locator('.sc-keys .lk-key.marked')).toHaveCount(4);
  });

  test('Hear it plays the piano from the app\'s own files, without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openScales(page);
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('.sc-hear').click();
    expect((await samples).status()).toBe(200);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('play along: the next key is marked, and finishing earns a reward', async ({ page }) => {
    await openScales(page);
    await page.locator('.sc-along').click();
    await expect(page.locator('.sc-status')).toHaveText('Play the marked key.');
    await expect(page.locator('.sc-keys .lk-key.next-key')).toHaveAttribute('data-note', 'C4');
    await key(page, 'E4').click(); // not the marked one
    await expect(page.locator('.sc-status')).toHaveText('Not that one. Look at the marked key.');
    for (const note of ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']) {
      await expect(page.locator('.sc-keys .lk-key.next-key')).toHaveAttribute('data-note', note);
      await key(page, note).click();
    }
    await expect(page.locator('.sc-status')).toHaveText('Well done! You played every note.');
    await page.goto('#/progress');
    await expect(page.locator('#progressView .pv-stat', { hasText: 'Scales and chords played' })).toContainText('1');
  });

  test('remembers the choice', async ({ page }) => {
    await openScales(page);
    await page.locator('.sc-roots [data-root="7"]').click();
    await page.locator('.sc-types [data-type="minor"]').click();
    await page.reload(); // the address keeps the screen
    await expect(page.locator('#scalesView')).toBeVisible();
    await expect(page.locator('.sc-notes')).toHaveText('Notes: G A B♭ C D E♭ F G');
  });

  test('is in Persian, with Persian digits for the fingers, and the picture left to right', async ({ page }) => {
    await openScales(page, 'fa');
    await expect(page.locator('#scalesView .view-title')).toHaveText('گام‌ها و آکوردها');
    await page.locator('.sc-labels [data-labels="right"]').click();
    expect(await labels(page)).toEqual(['۱', '۲', '۳', '۱', '۲', '۳', '۴', '۵']);
    expect(await page.locator('.sc-staff').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('.sc-keys').getAttribute('dir')).toBe('ltr');
  });

  test('fits the screen without scrolling sideways', async ({ page }) => {
    await openScales(page);
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
