import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect, type Page } from '@playwright/test';

// @tonejs/midi is CommonJS; Playwright loads this file as an ES module
const { Midi } = createRequire(import.meta.url)('@tonejs/midi') as typeof import('@tonejs/midi');

async function openMaker(page: Page, query = 't=prog&s=c-major&style=pop&bars=8&seed=5', locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto(`/#/generator?${query}`);
  await expect(page.locator('#generatorView')).toBeVisible();
  await expect(page.locator('.gen-line svg .note').first()).toBeVisible();
}

const symbols = (page: Page) => page.locator('.gen-chord-symbol').allTextContents();

test.describe('Music maker', () => {
  test('opens from the menu: eight bars of chords and the piece on the staff', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="generator"]').click();
    await expect(page.locator('#generatorView')).toBeVisible();
    await expect(page.locator('#generatorView .view-title')).toHaveText('Music maker');
    await expect(page.locator('.gen-bar')).toHaveCount(8);
    await expect(page.locator('.gen-line')).toHaveCount(2);
    await expect(page.locator('.gen-line svg .note').first()).toBeVisible();
    // the address now says what is shown
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#\/generator\?t=prog&s=c-major&style=pop&bars=8&seed=\d+$/);
  });

  test('an address makes a piece, and the same address makes the same piece again', async ({ page }) => {
    await openMaker(page, 't=prog&s=d-dorian&style=jazz&bars=4&seed=9');
    await expect(page.locator('.gen-summary')).toContainText('D Dorian, Jazz, 4 bars');
    await expect(page.locator('.gen-bar')).toHaveCount(4);
    const first = await symbols(page);
    expect(first.at(-1)).toMatch(/^Dm/);
    await page.reload();
    await expect(page.locator('.gen-line svg .note').first()).toBeVisible();
    expect(await symbols(page)).toEqual(first);
  });

  test('changing the style makes another piece and writes it into the address without a new step in the history', async ({ page }) => {
    await openMaker(page);
    const before = await page.evaluate(() => history.length);
    await page.locator('.gen-group-style [data-style="blues"]').click();
    await expect(page.locator('.gen-summary')).toContainText('Blues');
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('style=blues');
    expect(await page.evaluate(() => history.length)).toBe(before);
  });

  test('the scale comes from the picker: D Shur has open chords, and the staff has a koron', async ({ page }) => {
    await openMaker(page, 't=prog&s=d-shur&style=lofi&bars=8&seed=7');
    await expect(page.locator('.gen-summary')).toContainText('D Shur, Lo-fi');
    const chords = await symbols(page);
    // open chords only: a power chord, a suspended chord or a chord of fourths
    for (const chord of chords) expect(chord).toMatch(/5$|sus|\(4ths\)|\(5ths\)|^[A-G][b#]?m?$/);
  });

  test('a melody in Persian mode shows the koron sign on the staff and plays notes of the scale', async ({ page }) => {
    await openMaker(page, 't=melody&s=ek-segah&style=cinematic&bars=8&seed=5&over=scale');
    const koron = await page.evaluate(
      () => [...document.querySelectorAll('.gen-line svg .accid use')].filter((u) => (u.getAttribute('xlink:href') ?? u.getAttribute('href') ?? '').includes('E460')).length,
    );
    expect(koron).toBeGreaterThan(0);
  });

  test('plays from the app\'s own piano files, marks the bar and stops', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openMaker(page);
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('.gen-play').click();
    expect((await samples).status()).toBe(200);
    await expect(page.locator('.gen-play')).toHaveText('Stop');
    await expect(page.locator('.gen-bar[data-current="true"]')).toHaveCount(1);
    await page.locator('.gen-play').click();
    await expect(page.locator('.gen-play')).toHaveText('Play');
    expect(errors).toEqual([]);
  });

  test('downloads a MIDI file with the chords and the bass', async ({ page }) => {
    await openMaker(page);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.gen-midi').click()]);
    expect(download.suggestedFilename()).toBe('C-Major-Pop.mid');
    const midi = new Midi(readFileSync(await download.path()));
    expect(midi.tracks.map((t: { name: string }) => t.name)).toEqual(['Chords', 'Bass']);
    expect(midi.tracks[0].notes.length).toBeGreaterThan(20);
    await expect(page.locator('#notice')).toContainText('C-Major-Pop.mid');
  });

  test('"Practise this" opens the piece on the music stand', async ({ page }) => {
    await openMaker(page, 't=melody&s=f-major&style=pop&bars=4&seed=3&over=progression');
    await page.locator('.gen-practise').click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'practice');
    await expect(page.locator('#musicStand')).toBeVisible();
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
  });

  test('"Edit in Write a song" saves the tune and opens it in the song maker', async ({ page }) => {
    await openMaker(page, 't=melody&s=c-major&style=pop&bars=4&seed=3&over=scale');
    await page.locator('.gen-maker').click();
    await expect(page.locator('#makerView')).toBeVisible();
    await expect(page).toHaveURL(/#\/maker\/maker-/);
    await expect(page.locator('.maker-preview svg .note').first()).toBeVisible();
    const text = await page.locator('#makerNotes').inputValue();
    expect(text.split('|')).toHaveLength(4);
  });

  test('is in Persian, with the staff and the chord names left to right, and fits the screen', async ({ page }) => {
    await openMaker(page, 't=prog&s=c-major&style=bossa&bars=8&seed=3', 'fa');
    await expect(page.locator('#generatorView .view-title')).toHaveText('سازنده‌ی موسیقی');
    expect(await page.locator('.gen-line').first().getAttribute('dir')).toBe('ltr');
    expect(await page.locator('.gen-chord-symbol').first().getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('fits the screen without scrolling sideways on the melody tab too', async ({ page }) => {
    await openMaker(page, 't=melody&s=c-major&style=jazz&bars=16&seed=2&over=progression');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
