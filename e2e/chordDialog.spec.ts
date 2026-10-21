import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect, type Page } from '@playwright/test';

// @tonejs/midi is CommonJS; Playwright loads this file as an ES module
const { Midi } = createRequire(import.meta.url)('@tonejs/midi') as typeof import('@tonejs/midi');

async function openChord(page: Page, address: string, family: string, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto(`/#/scales/${address}`);
  await expect(page.locator('#scalesView')).toBeVisible();
  await page.locator('.sc-tab[data-tab="chords"]').click();
  await page.locator(`.dict-families [data-family="${family}"]`).click();
  await page.locator('.dict-card').first().click();
  await expect(page.locator('dialog.chord-dialog')).toBeVisible();
  await expect(page.locator('.cd-staff svg .note').first()).toBeVisible();
}

test.describe('Chord dialog', () => {
  test('a card opens the dialog, Escape closes it, and the card has the focus again', async ({ page }) => {
    await openChord(page, 'c-major', 'seventh');
    await expect(page.locator('.chord-dialog .app-dialog-title')).toHaveText('Cmaj7');
    await expect(page.locator('.cd-notes')).toHaveText('C · E · G · B');
    await expect(page.locator('.cd-staff svg .note')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.chord-dialog')).toHaveCount(0);
    await expect(page.locator('.dict-card').first()).toBeFocused();
  });

  test('turns the chord: the title, the notes and the guitar follow', async ({ page }) => {
    await openChord(page, 'c-major', 'triad');
    await page.locator('.cd-turns .sc-chip').nth(1).click();
    await expect(page.locator('.chord-dialog .app-dialog-title')).toHaveText('C/E');
    await expect(page.locator('.cd-notes')).toHaveText('E · G · C');
    await expect(page.locator('.cd-turns .sc-chip').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cd-shape').first()).toBeVisible();
  });

  test('shows the shapes on a guitar with diagrams, among them the open C', async ({ page }) => {
    await openChord(page, 'c-major', 'triad');
    await expect(page.locator('.cd-shape[data-frets="-1,3,2,0,1,0"] .fretboard')).toBeVisible();
    await expect(page.locator('.cd-shape[data-frets="-1,3,2,0,1,0"] .cd-shape-kind')).toHaveText('Open');
    expect(await page.locator('.cd-shape .fretboard').first().getAttribute('dir')).toBe('ltr');
  });

  test('downloads the chord as a MIDI file that reads back as its notes', async ({ page }) => {
    await openChord(page, 'c-major', 'seventh');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.cd-midi').click()]);
    expect(download.suggestedFilename()).toBe('Cmaj7.mid');
    const midi = new Midi(readFileSync(await download.path()));
    expect(midi.tracks[0].notes.map((n: { midi: number }) => n.midi)).toEqual([60, 64, 67, 71, 60, 64, 67, 71]);
    await expect(page.locator('#notice')).toContainText('Cmaj7.mid');
  });

  test('plays the chord from the app\'s own piano files, without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openChord(page, 'c-major', 'triad');
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('.cd-arpeggio').click();
    expect((await samples).status()).toBe(200);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('fits the screen, and in Persian the staff, the keys and the diagrams stay left to right', async ({ page }) => {
    await openChord(page, 'c-major', 'triad', 'fa');
    expect(await page.locator('.cd-staff').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('.cd-keys').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('.cd-shape .fretboard').first().getAttribute('dir')).toBe('ltr');
    await expect(page.locator('.cd-turns .sc-chip').first()).toHaveText('وضع اصلی');
    const box = await page.locator('dialog.chord-dialog').boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    expect(box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
