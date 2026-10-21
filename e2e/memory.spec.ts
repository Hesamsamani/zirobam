import { test, expect, type Page } from '@playwright/test';

// What the student answers in the app is remembered: `mistakes.v1` (how often each note was asked and missed, by day)
// and `srs.v1` (the box each thing is in). These tests answer for real and read what was stored.

const today = (page: Page) =>
  page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
const stored = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

const press = (page: Page, code: string) =>
  page.evaluate((c) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), 30);
  }, code);

test.describe('Practice memory', () => {
  test('the note quiz: a right answer and a wrong one are both remembered', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="learn"]').click();
    await expect(page.locator('#learnView')).toHaveAttribute('data-panel', 'quiz');

    const right = (await page.locator('#learnView').getAttribute('data-pitch'))!;
    await page.locator(`.learn-answer[data-letter="${right[0]}"]`).click();
    await expect(page.locator('#learnView')).toHaveAttribute('data-result', 'correct');
    await expect(page.locator('#learnView')).not.toHaveAttribute('data-result', /.+/, { timeout: 5000 });

    const asked = (await page.locator('#learnView').getAttribute('data-pitch'))!;
    const wrongLetter = asked[0] === 'C' ? 'D' : 'C';
    await page.locator(`.learn-answer[data-letter="${wrongLetter}"]`).click();
    await expect(page.locator('#learnView')).toHaveAttribute('data-result', 'wrong');

    const day = await today(page);
    const log = await stored(page, 'mistakes.v1');
    expect(log.version).toBe(1);
    expect(log.days[day].notes[right]).toEqual([1, 0]);
    expect(log.days[day].notes[asked]).toEqual([1, 1]);

    const boxes = await stored(page, 'srs.v1');
    expect(boxes.items[`note:${right}`][0]).toBe(2); // right: up from box 1
    expect(boxes.items[`note:${asked}`][0]).toBe(1); // wrong: box 1
  });

  test('the practice stand in wait mode: a wrong key counts against the note that was waited for', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="songs"]').click();
    await page.locator('#songsView [data-song="mary-lamb"]').click();
    await expect(page.locator('.pp-measure').first()).toBeVisible();
    const opener = page.locator('.pa-open');
    if ((await opener.getAttribute('aria-expanded')) !== 'true') await opener.click();
    await page.locator('[data-aid="wait"]').click();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toHaveText('Waiting for you: play the marked note.', { timeout: 15000 });

    // the piece waits for E4. C4 is wrong, then E4 is right
    await press(page, 'KeyA');
    await expect(page.locator('#notation .note.wrong')).toHaveCount(1);
    await press(page, 'KeyD');
    await expect(page.locator('#notation .note.correct')).toHaveCount(1);

    const day = await today(page);
    const log = await stored(page, 'mistakes.v1');
    expect(log.days[day].notes.E4).toEqual([2, 1]); // asked twice, missed once
    expect(log.days[day].notes.C4).toBeUndefined(); // the wrong key is not blamed on itself
    expect((await stored(page, 'srs.v1')).items['note:E4'][0]).toBe(2); // the last answer was right
    await page.locator('#playPause').click();
  });

  test('nothing is remembered for a screen that asks nothing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#mainMenu')).toBeVisible();
    await page.locator('#mainMenu [data-tile="scales"]').click();
    await expect(page.locator('#scalesView')).toBeVisible();
    expect(await stored(page, 'mistakes.v1')).toBeNull();
    expect(await stored(page, 'srs.v1')).toBeNull();
  });
});
