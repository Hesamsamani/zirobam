import { test, expect, type Page } from '@playwright/test';

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const key = (page: Page, note: string) => page.locator(`#chordsView .ch-keys .lk-key[data-note="${note}"]`);

async function openChords(page: Page, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="chords"]').click();
  await expect(page.locator('#chordsView')).toBeVisible();
  await expect(page.locator('#chordsView .ch-keys .lk-key').first()).toBeVisible();
}

/** The notes of a major or minor chord of the first stage, written the way the keys are named (`C4`, `D#4`). */
function notesOf(symbol: string): string[] {
  const minor = symbol.endsWith('m');
  const root = LETTERS[symbol[0]];
  return [0, minor ? 3 : 4, 7].map((interval) => {
    const midi = 60 + root + interval;
    return `${SHARPS[midi % 12]}${Math.floor(midi / 12) - 1}`;
  });
}

test.describe('Chord reader', () => {
  test('opens from the menu and names the chord of the keys that are pressed on the keyboard picture', async ({ page }) => {
    await openChords(page);
    await expect(page.locator('#chordsView .view-title')).toHaveText('Chord reader');
    for (const note of ['A3', 'C4', 'E4']) await key(page, note).click();
    await expect(page.locator('#chordsView .ch-name')).toHaveText('Am');
    await expect(page.locator('#chordsView .ch-kind')).toHaveText('Minor');
    await expect(page.locator('#chordsView .ch-notes')).toHaveText('Notes: A C E');
    // a key pressed again is let go, and the keys can all be let go
    await key(page, 'A3').click();
    await expect(page.locator('#chordsView .ch-keys .lk-key.marked')).toHaveCount(2);
    await page.locator('#chordsView .ch-clear').click();
    await expect(page.locator('#chordsView .ch-keys .lk-key.marked')).toHaveCount(0);
  });

  test('the quiz asks for a chord and says "Right!" when it is played', async ({ page }) => {
    await openChords(page);
    await page.locator('#chordsView .ch-tabs [data-tab="quiz"]').click();
    const symbol = (await page.locator('#chordsView .ch-target').textContent())!;
    expect(symbol).toMatch(/^[A-G]m?$/);
    for (const note of notesOf(symbol)) await key(page, note).click();
    await expect(page.locator('#chordsView .ch-status')).toHaveText('Right!');
    // the next chord follows by itself
    await expect(page.locator('#chordsView .ch-status')).toHaveText('', { timeout: 5000 });
  });

  test('a wrong chord shows the notes of the right one', async ({ page }) => {
    await openChords(page);
    await page.locator('#chordsView .ch-tabs [data-tab="quiz"]').click();
    for (const note of ['C#4', 'F4', 'A4']) await key(page, note).click();
    await expect(page.locator('#chordsView .ch-status')).toContainText('Not quite. The notes are');
    await expect(page.locator('#chordsView .ch-next')).toBeVisible();
  });

  test('is in Persian, with the keys left to right, and fits the screen', async ({ page }) => {
    await openChords(page, 'fa');
    await expect(page.locator('#chordsView .view-title')).toHaveText('آکوردخوان');
    expect(await page.locator('#chordsView .ch-keys').getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
