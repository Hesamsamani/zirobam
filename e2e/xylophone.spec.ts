import { test, expect, type Page } from '@playwright/test';

const HOME_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'];
const HOME_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];

const codeFor = (note: string) => HOME_CODES[HOME_NOTES.indexOf(note)];
const bar = (page: Page, note: string) => page.locator(`.xylo-bar[data-note="${note}"]`);

async function openXylophone(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
    }, locale);
  }
  await page.goto('/#/xylophone');
  await expect(page.locator('#xylophoneView')).toBeVisible();
  await expect(page.locator('.xylo-bar').first()).toBeVisible();
}

test.describe('Xylophone screen', () => {
  test('opens from the menu with 11 bars on the home row', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="xylophone"]').click();
    await expect(page).toHaveURL(/#\/xylophone$/);
    await expect(page.locator('#xylophoneView')).toBeVisible();
    await expect(page.locator('#musicStand')).toBeHidden();
    await expect(page.locator('.xylo-bar')).toHaveCount(11);
    await expect(page.locator('.xylo-bar-key')).toHaveText(['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"]);
    await expect(page.locator('.xylo-bar-name')).toHaveText(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F']);
  });

  test('the keys of the row play the bars from left to right', async ({ page }) => {
    await openXylophone(page);
    for (let i = 0; i < HOME_CODES.length; i++) {
      await page.keyboard.down(HOME_CODES[i]);
      await expect(page.locator('.xylo-bar').nth(i)).toHaveAttribute('data-active', 'true');
      await expect(page.locator('.xylo-bar[data-active="true"]')).toHaveCount(1);
      await page.keyboard.up(HOME_CODES[i]);
      await expect(page.locator('.xylo-bar[data-active="true"]')).toHaveCount(0);
    }
  });

  test('works with any keyboard layout, because keys are matched by position', async ({ page }) => {
    await openXylophone(page);
    // a Persian layout types ش where the A key is; the position (code) is what counts
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'ش', bubbles: true })));
    await expect(bar(page, 'C4')).toHaveAttribute('data-active', 'true');
  });

  test('another row of the keyboard can be chosen', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-row="number"]').click();
    await expect(page.locator('.xylo-bar')).toHaveCount(12);
    await expect(page.locator('.xylo-bar-key').first()).toHaveText('1');
    await page.keyboard.down('Digit1');
    await expect(bar(page, 'C4')).toHaveAttribute('data-active', 'true');
    await page.keyboard.up('Digit1');
    // the home row is no longer connected
    await page.keyboard.down('KeyA');
    await expect(page.locator('.xylo-bar[data-active="true"]')).toHaveCount(0);
    await page.keyboard.up('KeyA');

    await page.locator('[data-row="top"]').click();
    await page.keyboard.down('KeyQ');
    await expect(bar(page, 'C4')).toHaveAttribute('data-active', 'true');
    await page.keyboard.up('KeyQ');
    await page.keyboard.down('BracketRight');
    await expect(bar(page, 'G5')).toHaveAttribute('data-active', 'true');
    await page.keyboard.up('BracketRight');
  });

  test('bars can be played with the mouse or touch', async ({ page }) => {
    await openXylophone(page);
    const e4 = bar(page, 'E4');
    await e4.dispatchEvent('pointerdown');
    await expect(e4).toHaveAttribute('data-active', 'true');
    await e4.dispatchEvent('pointerup');
    await expect(e4).not.toHaveAttribute('data-active', 'true');
  });

  test('plays its own sound: no piano samples are downloaded and nothing breaks', async ({ page }) => {
    const errors: string[] = [];
    const sampleRequests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('salamander')) sampleRequests.push(r.url());
    });
    await openXylophone(page);
    for (const code of HOME_CODES) {
      await page.keyboard.press(code);
    }
    await page.waitForTimeout(500);
    expect(sampleRequests).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the piano keys of the exercise screens stay out of the way', async ({ page }) => {
    await openXylophone(page);
    // W is the C sharp of the piano keyboard and is not a bar of the home row
    await page.keyboard.down('KeyW');
    await expect(page.locator('.xylo-bar[data-active="true"]')).toHaveCount(0);
    await expect(page.locator('.piano-key[data-note="C#4"]')).not.toHaveClass(/pressed/);
    await page.keyboard.up('KeyW');
  });

  test('keys stop playing when the screen is left', async ({ page }) => {
    await openXylophone(page);
    await page.locator('#xylophoneView .back-btn').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await page.keyboard.down('KeyA');
    await expect(page.locator('.xylo-bar[data-active="true"]')).toHaveCount(0);
    await page.keyboard.up('KeyA');
  });

  test('remembers the row and the lowest bar', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-row="bottom"]').click();
    await page.locator('[data-octave="5"]').click();
    await page.reload();
    await expect(page.locator('[data-row="bottom"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.xylo-bar').first()).toHaveAttribute('data-note', 'C5');
    await expect(page.locator('.xylo-bar')).toHaveCount(10);
  });

  test('the note names can be hidden', async ({ page }) => {
    await openXylophone(page);
    await expect(page.locator('.xylo-bar-name').first()).toBeVisible();
    await page.locator('[data-option="names"]').uncheck();
    await expect(page.locator('.xylo-bar-name').first()).toBeHidden();
  });
});

test.describe('Xylophone: read and play', () => {
  test('asks for a note on the staff and checks the bar that is played', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-mode="read"]').click();
    await expect(page.locator('.xylo-note svg').first()).toBeVisible();
    const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
    expect(HOME_NOTES).toContain(asked);

    await page.keyboard.press(codeFor(asked!));
    await expect(page.locator('#xylophoneView')).toHaveAttribute('data-result', 'correct');
    await expect(page.locator('.xylo-feedback')).not.toBeEmpty();

    // then the next question arrives
    await expect(page.locator('#xylophoneView')).not.toHaveAttribute('data-result', /.+/, { timeout: 5000 });
    const next = await page.locator('#xylophoneView').getAttribute('data-pitch');
    expect(next).not.toBe(asked);

    // a wrong bar marks the answer wrong and shows the right bar
    const wrong = HOME_NOTES.find((n) => n !== next)!;
    await page.keyboard.press(codeFor(wrong));
    await expect(page.locator('#xylophoneView')).toHaveAttribute('data-result', 'wrong');
    await expect(bar(page, next!)).toHaveAttribute('data-hint', 'true');

    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('xyloStats.v1') ?? '{}'));
    expect(Object.keys(stats.pitches).length).toBeGreaterThanOrEqual(2);
  });

  test('the note quiz keeps its own statistics', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-mode="read"]').click();
    const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
    await page.keyboard.press(codeFor(asked!));
    const quiz = await page.evaluate(() => localStorage.getItem('noteStats.v1'));
    expect(quiz).toBeNull();
  });

  test('the hint shows the bar to play', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-mode="read"]').click();
    await expect(page.locator('.xylo-bar[data-hint="true"]')).toHaveCount(0);
    await page.locator('[data-option="hints"]').check();
    const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
    await expect(bar(page, asked!)).toHaveAttribute('data-hint', 'true');
  });
});

test.describe('Xylophone: play a song', () => {
  test('plays Mary Had a Little Lamb note by note and earns three stars', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-mode="song"]').click();
    await expect(page.locator('.xylo-songs [data-song="mary-lamb"]')).toBeVisible();
    await expect(page.locator('.xylo-songs [data-song="minuet-g"]')).toHaveCount(0); // has F sharp
    await page.locator('.xylo-songs [data-song="mary-lamb"]').click();

    for (let i = 0; i < 26; i++) {
      const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
      expect(asked, `note ${i + 1}`).not.toBeNull();
      await page.keyboard.press(codeFor(asked!));
    }
    await expect(page.locator('#xylophoneView')).toHaveAttribute('data-result', 'done');
    await expect(page.locator('.xylo-stars .star.on')).toHaveCount(3);
    await expect(page.locator('.xylo-again')).toBeVisible();

    await page.locator('.xylo-again').click();
    await expect(page.locator('#xylophoneView')).not.toHaveAttribute('data-result', /.+/);
    await expect(page.locator('.xylo-progress')).toContainText('1');
  });

  test('a wrong bar costs a mistake and keeps the note', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-mode="song"]').click();
    const first = await page.locator('#xylophoneView').getAttribute('data-pitch');
    const wrong = HOME_NOTES.find((n) => n !== first)!;
    await page.keyboard.press(codeFor(wrong));
    await expect(page.locator('#xylophoneView')).toHaveAttribute('data-pitch', first!);
    await expect(page.locator('.xylo-progress')).toContainText('1');
  });
});

test.describe('Xylophone on every screen', () => {
  test('fits the screen without scrolling sideways', async ({ page }) => {
    await openXylophone(page);
    await page.locator('[data-row="number"]').click(); // 12 bars: the widest row
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await page.locator('.xylo-bar').first().boundingBox();
    expect(box!.width).toBeGreaterThan(18);
  });

  test('in Persian the page is right-to-left but the bars stay left-to-right', async ({ page }) => {
    await openXylophone(page, 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#xylophoneView h2')).toHaveText('زایلوفون');
    await expect(page.locator('[data-mode="read"]')).toHaveText('بخوان و بنواز');
    expect(await page.locator('.xylo-bars').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    const first = await page.locator('.xylo-bar').first().boundingBox();
    const last = await page.locator('.xylo-bar').last().boundingBox();
    expect(first!.x).toBeLessThan(last!.x); // C is still on the left
    await expect(page.locator('.xylo-bar-key').first()).toHaveText('A');
  });
});
