import { test, expect, type Page } from '@playwright/test';

const notes = (page: Page) => page.locator('#makerNotes');

async function openMaker(page: Page) {
  await page.goto('/#/songs');
  await page.locator('.songs-make').click();
  await expect(page).toHaveURL(/#\/maker$/);
  await expect(page.locator('#makerView')).toBeVisible();
}

test.describe('Song maker', () => {
  test('writes a song with the buttons, shows it on the staff and practises it', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerName').fill('First tune');
    await page.locator('.maker-note[data-letter="C"]').click();
    await page.locator('.maker-note[data-letter="D"]').click();
    await page.locator('.maker-note[data-letter="E"]').click();
    await page.locator('.maker-note[data-letter="F"]').click();
    await expect(notes(page)).toHaveValue('C4q D4q E4q F4q |'); // the full measure closes itself
    await page.locator('.maker-chip', { hasText: 'Whole' }).click();
    await page.locator('.maker-note[data-letter="G"]').click();
    await expect(notes(page)).toHaveValue('C4q D4q E4q F4q | G4w |');
    await expect(page.locator('.maker-preview svg .note')).toHaveCount(5);
    await expect(page.locator('.maker-count')).toHaveText('Measures: 2');
    await expect(page.locator('.maker-problem')).toHaveText('');

    await page.locator('.maker-practise').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toContainText('First tune');
    await expect(page.locator('.pp-measure')).toHaveCount(2);
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
  });

  test('the song is kept: it is in My scores after a reload, and can be edited and removed', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerName').fill('Kept tune');
    await notes(page).fill('C4q D4q E4q F4q | G4w');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-status')).toHaveText('Saved in My scores.');
    await expect(page).toHaveURL(/#\/maker\/maker-[a-z0-9]+$/);

    await page.goto('/#/songs');
    await page.reload();
    const card = page.locator('#songsView .my-scores .song-card', { hasText: 'Kept tune' });
    await expect(card).toBeVisible();
    await page.locator('#songsView .score-edit').click();
    await expect(page.locator('#makerName')).toHaveValue('Kept tune');
    await expect(notes(page)).toHaveValue('C4q D4q E4q F4q | G4w');

    await page.locator('#makerName').fill('Changed tune');
    await notes(page).fill('C4q D4q E4q F4q | G4h A4h');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-status')).toHaveText('Saved in My scores.');

    await page.goto('/#/songs');
    await expect(page.locator('#songsView .my-scores .song-card')).toHaveCount(1); // the same song, changed
    await expect(page.locator('#songsView .my-scores .song-card')).toContainText('Changed tune');
    await page.locator('#songsView .score-remove').click();
    await page.locator('#songsView .score-confirm-yes').click();
    await expect(page.locator('#songsView .my-scores')).toHaveCount(0);
  });

  test('opening the address of a song made here edits it', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerName').fill('Linked tune');
    await notes(page).fill('G4w');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-status')).toHaveText('Saved in My scores.');
    await page.reload();
    await expect(page.locator('#makerName')).toHaveValue('Linked tune');
    await expect(notes(page)).toHaveValue('G4w');
  });

  test('a wrong note or a short measure is explained and nothing is saved', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerName').fill('Broken');
    await notes(page).fill('C4q X4q');
    await expect(page.locator('.maker-problem')).toContainText('cannot read "X4q"');

    await notes(page).fill('C4q D4q | E4w');
    await expect(page.locator('.maker-problem')).toContainText('Measure 1 has 2 beats, but this time signature needs 4');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-status')).toHaveText('');
    await page.goto('/#/songs');
    await expect(page.locator('#songsView .my-scores')).toHaveCount(0);
  });

  test('a song needs a name', async ({ page }) => {
    await openMaker(page);
    await notes(page).fill('C4w');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-problem')).toContainText('Give the song a name');
    await expect(page.locator('#makerName')).toBeFocused();
  });

  test('the key and the time signature change the staff and the checks', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerTime').selectOption('3');
    await page.locator('#makerKey').selectOption('1');
    await notes(page).fill('G4q A4q B4q | F4h.');
    await expect(page.locator('.maker-problem')).toContainText('Write F#4');
    await notes(page).fill('G4q A4q B4q | F#4h.');
    await expect(page.locator('.maker-problem')).toHaveText('');
    await page.locator('#makerName').fill('Waltz');
    await page.locator('.maker-save').click();
    await expect(page.locator('.maker-status')).toHaveText('Saved in My scores.');
  });

  test('an unfinished song is still there after a reload', async ({ page }) => {
    await openMaker(page);
    await page.locator('#makerName').fill('Half done');
    await notes(page).fill('C4q D4q');
    await page.reload();
    await expect(page.locator('#makerName')).toHaveValue('Half done');
    await expect(notes(page)).toHaveValue('C4q D4q');
  });

  test('delete last and clear all work', async ({ page }) => {
    await openMaker(page);
    await page.locator('.maker-note[data-letter="A"]').click();
    await page.locator('.maker-note[data-letter="B"]').click();
    await page.locator('.maker-tool[data-action="delete"]').click();
    await expect(notes(page)).toHaveValue('A4q');
    await page.locator('.maker-tool[data-action="clear"]').click();
    await expect(notes(page)).toHaveValue('');
    await expect(page.locator('.maker-empty')).toBeVisible();
  });

  test('the screen is in Persian too, with the notes box left to right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/songs');
    await page.locator('.songs-make').click();
    await expect(page.locator('#makerView .view-title')).toHaveText('نوشتن آهنگ');
    await expect(page.locator('.maker-save')).toHaveText('ذخیره');
    await expect(notes(page)).toHaveAttribute('dir', 'ltr');
    await notes(page).fill('C4q D4q | E4w');
    await expect(page.locator('.maker-problem')).toContainText('میزان ۱');
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });

  test('fits the screen without scrolling sideways', async ({ page }) => {
    await openMaker(page);
    await notes(page).fill('C4w | D4w | E4w | F4w | G4w');
    await expect(page.locator('.maker-more')).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
