import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// @tonejs/midi is CommonJS; Playwright loads this file as an ES module
const { Midi } = createRequire(import.meta.url)('@tonejs/midi') as typeof import('@tonejs/midi');

const FIXTURE = path.join(HERE, 'fixtures', 'fixture-tune.musicxml');
const NOT_MUSIC = path.join(HERE, 'fixtures', 'not-music.xml');

const row = (page: Page, suffix: string) => page.locator(`#catalogView [data-song$="${suffix}"]`);

/** Opens the library on one song and attaches the fixture file to it. */
async function attach(page: Page, query: string, suffix: string, file = FIXTURE) {
  await page.goto(`/#/catalog?${query}`);
  await expect(row(page, suffix)).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await row(page, suffix).locator('.catalog-add').click();
  await (await chooser).setFiles(file);
}

test.describe('My scores', () => {
  test('a library song with no notes gets the student\'s file and is practised from it', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be');
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('Let It Be'); // the library's name, not the file's
    await expect(page.locator('.pp-measure')).toHaveCount(2);
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
  });

  test('the score is kept: the row shows it after a reload and practises it again', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be');
    await expect(page.locator('.pp-song')).toBeVisible();
    await page.goto('/#/catalog?q=let+it+be');
    await expect(row(page, 'let-it-be').locator('.catalog-mine')).toHaveText('My score');
    await expect(row(page, 'let-it-be').locator('.catalog-add')).toHaveCount(0);
    await page.reload();
    await expect(row(page, 'let-it-be').locator('.catalog-practise')).toBeVisible();
    await row(page, 'let-it-be').locator('.catalog-practise').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('Let It Be');
  });

  test('the "My scores" chip lists the songs that have a score', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be');
    await page.goto('/#/catalog');
    const chip = page.locator('.chip[data-cat="mine"]');
    await expect(chip).toHaveText('My scores (1)');
    await chip.click();
    await expect(page.locator('#catalogView .catalog-row')).toHaveCount(1);
    await expect(page.locator('#catalogView .catalog-title')).toHaveText('Let It Be');
  });

  test('a score can be removed, after a question', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be');
    await page.goto('/#/catalog?q=let+it+be');
    await row(page, 'let-it-be').locator('.catalog-remove').click();
    await expect(row(page, 'let-it-be').locator('.catalog-confirm')).toContainText('Remove your score of Let It Be?');
    await row(page, 'let-it-be').locator('.catalog-keep').click();
    await expect(row(page, 'let-it-be').locator('.catalog-practise')).toBeVisible();
    await row(page, 'let-it-be').locator('.catalog-remove').click();
    await row(page, 'let-it-be').locator('.catalog-confirm-yes').click();
    await expect(row(page, 'let-it-be').locator('.catalog-add')).toBeVisible();
    await expect(page.locator('.chip[data-cat="mine"]')).toHaveText('My scores (0)');
  });

  test('a file opened without a library song appears in My scores on the songs screen', async ({ page }) => {
    await page.goto('/#/catalog');
    await expect(page.locator('#catalogView .catalog-row').first()).toBeVisible();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.catalog-own').click();
    await (await chooser).setFiles(FIXTURE);
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('Fixture Tune');

    await page.goto('/#/songs');
    const group = page.locator('#songsView .my-scores');
    await expect(group.locator('.song-group-title')).toHaveText('My scores');
    await expect(group.locator('.song-card')).toContainText('Fixture Tune');
    await group.locator('.song-card').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('Fixture Tune');
  });

  test('a MIDI file is kept as bytes and practised again after a reload', async ({ page }) => {
    const midi = new Midi();
    const track = midi.addTrack();
    [60, 62, 64, 65, 67, 69, 71, 72].forEach((note, i) => track.addNote({ midi: note, time: i * 0.5, duration: 0.5 }));
    await page.goto('/#/catalog?q=imagine+lennon');
    const chooser = page.waitForEvent('filechooser');
    await row(page, 'lennon-imagine').locator('.catalog-add').click();
    await (await chooser).setFiles({ name: 'imagine.mid', mimeType: 'audio/midi', buffer: Buffer.from(midi.toArray()) });
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('Imagine');

    await page.goto('/#/catalog?q=imagine+lennon');
    await page.reload();
    await row(page, 'lennon-imagine').locator('.catalog-practise').click();
    await expect(page.locator('.pp-song')).toContainText('Imagine');
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
  });

  test('the practice session of a score is restored after a reload', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be');
    await expect(page.locator('.pp-song')).toContainText('Let It Be');
    await page.reload();
    await expect(page.locator('.pp-song')).toContainText('Let It Be');
    await expect(page.locator('.pp-measure')).toHaveCount(2);
  });

  test('a file that is not music shows a message and keeps nothing', async ({ page }) => {
    await attach(page, 'q=let+it+be', 'let-it-be', NOT_MUSIC);
    await expect(page.locator('#notice')).toContainText(/MusicXML/);
    await expect(row(page, 'let-it-be').locator('.catalog-add')).toBeVisible();
    await expect(page).toHaveURL(/#\/catalog/);
  });

  test('built-in songs do not get an Add button, classical rows get a link to free scores', async ({ page }) => {
    await page.goto('/#/catalog?q=ode+to+joy');
    await expect(page.locator('#catalogView .catalog-row').first()).toBeVisible();
    await expect(page.locator('#catalogView [data-song$="ode-to-joy"] .catalog-add')).toHaveCount(0);
    await page.goto('/#/catalog?cat=classical&q=fur+elise');
    const free = page.locator('#catalogView .catalog-row').first().locator('.catalog-free');
    await expect(free).toHaveAttribute('href', /^https:\/\/www\.mutopiaproject\.org\//);
    await expect(free).toHaveAttribute('target', '_blank');
  });

  test('the score buttons are in Persian too', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/catalog?q=let+it+be');
    await expect(row(page, 'let-it-be').locator('.catalog-add')).toHaveText('افزودن نت خودم');
    await expect(page.locator('.chip[data-cat="mine"]')).toContainText('نت‌های من');
  });
});
