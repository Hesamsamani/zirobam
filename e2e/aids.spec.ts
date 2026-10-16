import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TWO_HANDS = fs.readFileSync(path.join(HERE, 'fixtures', 'two-hands.musicxml'), 'utf8');

const KEY_FOR: Record<string, string> = {
  C4: 'KeyA', D4: 'KeyS', E4: 'KeyD', F4: 'KeyF', G4: 'KeyG', A4: 'KeyH', B4: 'KeyJ', C5: 'KeyK', D5: 'KeyL',
};

async function openSong(page: Page, songId = 'mary-lamb', locale?: 'fa'): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="songs"]').click();
  await page.locator(`#songsView [data-song="${songId}"]`).click();
  await expect(page.locator('.pp-measure').first()).toBeVisible();
  await openAids(page);
}

/** The aids are folded away until the small button is pressed. */
async function openAids(page: Page) {
  const opener = page.locator('.pa-open');
  await expect(opener).toBeVisible();
  if ((await opener.getAttribute('aria-expanded')) !== 'true') await opener.click();
  await expect(page.locator('[data-aid="wait"]')).toBeVisible();
}

/** Records the moments of the piece (`trainer:beat`) in window.__waits. */
async function recordBeats(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __waits: Array<{ beatIndex: number; pitches: string[]; waiting?: boolean }> };
    w.__waits = [];
    document.addEventListener('trainer:beat', (e) => w.__waits.push((e as CustomEvent).detail));
  });
}
const beats = (page: Page) => page.evaluate(() => (window as unknown as { __waits: Array<{ beatIndex: number; pitches: string[]; waiting?: boolean }> }).__waits);

/** The student plays the notes that the piece waits for, a moment after they are marked, for the first `moments` moments. */
async function playWhatIsAsked(page: Page, moments = 4) {
  await page.evaluate(([keys, limit]) => {
    let played = 0;
    document.addEventListener('trainer:beat', (e) => {
      const detail = (e as CustomEvent).detail as { pitches: string[]; waiting?: boolean };
      if (!detail.waiting || played >= (limit as number)) return;
      played++;
      setTimeout(() => {
        for (const pitch of detail.pitches) {
          const code = (keys as Record<string, string>)[pitch];
          if (!code) continue;
          document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
          setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 30);
        }
      }, 40);
    });
  }, [KEY_FOR, moments] as const);
}

const press = (page: Page, code: string) =>
  page.evaluate((c) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), 30);
  }, code);

const aid = (page: Page, name: string) => page.locator(`[data-aid="${name}"]`);

test.describe('Practice aids: wait for me', () => {
  test('the piece waits at each note, with no count-in and no tempo', async ({ page }) => {
    await openSong(page);
    await recordBeats(page);
    await aid(page, 'wait').click();
    await expect(aid(page, 'wait')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#playPause').click();
    await expect.poll(async () => (await beats(page)).length, { timeout: 15000 }).toBe(1);
    expect((await beats(page))[0]).toMatchObject({ beatIndex: 0, pitches: ['E4'], waiting: true });
    await expect(page.locator('#notation .note.current')).toHaveCount(1);
    await expect(page.locator('.pp-status')).toHaveText('Waiting for you: play the marked note.');
    await page.waitForTimeout(2500); // nothing moves on its own
    expect(await beats(page)).toHaveLength(1);
    await expect(page.locator('#countoff')).not.toHaveClass(/visible/);

    await press(page, KEY_FOR.E4);
    await expect.poll(async () => (await beats(page)).length).toBe(2);
    expect((await beats(page))[1]).toMatchObject({ beatIndex: 1, pitches: ['D4'] });
    await expect(page.locator('#notation .note.correct')).toHaveCount(1);
  });

  test('playing every asked note moves on to the next step', async ({ page }) => {
    await openSong(page);
    await playWhatIsAsked(page);
    await aid(page, 'wait').click();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toContainText('Clean run. Next: Measures 1-2', { timeout: 20000 });
    await expect(page.locator('.pp-where')).toHaveText('Measures 1-2');
    await page.locator('#playPause').click();
  });

  test('a wrong note is marked, the piece keeps waiting, and the step has to be played again', async ({ page }) => {
    await openSong(page);
    await recordBeats(page);
    await aid(page, 'wait').click();
    await page.locator('#playPause').click();
    await expect.poll(async () => (await beats(page)).length).toBe(1);
    await press(page, KEY_FOR.C4); // E4 is asked
    await expect(page.locator('#notation .note.wrong')).toHaveCount(1);
    await page.waitForTimeout(300);
    expect(await beats(page)).toHaveLength(1);
    await playWhatIsAsked(page);
    await press(page, KEY_FOR.E4); // now the right one: the rest follows by itself
    await expect(page.locator('.pp-status')).toContainText('Not yet', { timeout: 20000 });
    await expect(page.locator('.pp-attempt')).toHaveText('Attempt 2');
    await expect(page.locator('.pp-where')).toHaveText('Measure 1');
    await page.locator('#playPause').click();
  });

  test('the choice is remembered after a reload', async ({ page }) => {
    await openSong(page);
    await aid(page, 'wait').click();
    await aid(page, 'loop').click();
    await page.reload();
    await expect(aid(page, 'wait')).toHaveAttribute('aria-pressed', 'true');
    await expect(aid(page, 'loop')).toHaveAttribute('aria-pressed', 'true');
    await expect(aid(page, 'ladder')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Practice aids: repeat this step', () => {
  test('a step that was played well comes again instead of moving on', async ({ page }) => {
    await openSong(page);
    await recordBeats(page);
    await playWhatIsAsked(page);
    await aid(page, 'wait').click();
    await aid(page, 'loop').click();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toHaveText('Well done! This step comes again.', { timeout: 20000 });
    await expect(page.locator('.pp-where')).toHaveText('Measure 1');
    // the round started again from the first note
    await expect.poll(async () => (await beats(page)).filter((b) => b.beatIndex === 0).length, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
    await page.locator('#playPause').click();
  });
});

test.describe('Practice aids: speed', () => {
  test('the quick speeds are shares of the tempo that was set', async ({ page }) => {
    await openSong(page);
    await page.locator('#bpm').fill('80');
    await page.locator('#bpm').blur();
    await page.locator('[data-speed="50"]').click();
    await expect(page.locator('#bpm')).toHaveValue('40');
    await expect(page.locator('[data-speed="50"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-speed="75"]').click();
    await expect(page.locator('#bpm')).toHaveValue('60');
    await page.locator('[data-speed="100"]').click();
    await expect(page.locator('#bpm')).toHaveValue('80');
    await expect(page.locator('[data-speed="100"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('speeding up as I improve: each clean pass adds 5, up to the tempo that was set', async ({ page }) => {
    await openSong(page);
    await page.locator('#bpm').fill('30');
    await page.locator('#bpm').blur();
    await page.locator('[data-speed="50"]').click(); // 15 is below the slowest tempo: 20
    await expect(page.locator('#bpm')).toHaveValue('20');
    await playWhatIsAsked(page);
    await aid(page, 'wait').click();
    await aid(page, 'ladder').click();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toContainText('Clean run', { timeout: 20000 });
    await expect(page.locator('#bpm')).toHaveValue('25');
    await page.locator('#playPause').click();
  });
});

test.describe('Practice aids: one hand at a time', () => {
  async function openTwoHands(page: Page) {
    await page.goto('/#/songs');
    await page.locator('#xmlUpload').setInputFiles({ name: 'two-hands.musicxml', mimeType: 'application/xml', buffer: Buffer.from(TWO_HANDS) });
    await expect(page.locator('.pp-song')).toContainText('Two Hands');
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
    await openAids(page);
  }
  const events = (page: Page) =>
    page.evaluate(() => (window as unknown as { __timingEvents: Array<{ pitches: string[]; accompaniment?: string[] }> }).__timingEvents.slice(0, 2));

  test('the piece asks for both hands until one is chosen', async ({ page }) => {
    await openTwoHands(page);
    expect((await events(page))[0]).toMatchObject({ pitches: ['C4', 'C3'] });
    await expect(page.locator('#notation')).toHaveAttribute('data-hand', 'both');
  });

  test('right hand: only its notes are asked for, the left hand is played by the app and drawn faintly', async ({ page }) => {
    await openTwoHands(page);
    await page.locator('[data-pick="right"]').click();
    const [first, second] = await events(page);
    expect(first).toMatchObject({ pitches: ['C4'], accompaniment: ['C3'] });
    expect(second).toMatchObject({ pitches: ['D4'] });
    await expect(page.locator('#notation')).toHaveAttribute('data-hand', 'right');
    const opacity = (hand: string) => page.locator(`#notation .staff[data-hand="${hand}"]`).first().evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(await opacity('left'))).toBeLessThan(0.5);
    expect(Number(await opacity('right'))).toBe(1);
  });

  test('left hand: its notes are asked for, the right hand is played by the app', async ({ page }) => {
    await openTwoHands(page);
    await page.locator('[data-pick="left"]').click();
    const [first, second] = await events(page);
    expect(first).toMatchObject({ pitches: ['C3'], accompaniment: ['C4'] });
    expect(second).toMatchObject({ pitches: [], accompaniment: ['D4'] });
  });

  test('a song whose left hand only rests cannot be practised with the left hand', async ({ page }) => {
    await openSong(page);
    await expect(page.locator('[data-pick="left"]')).toBeDisabled();
    await expect(page.locator('[data-pick="right"]')).toBeEnabled();
  });

  test('in wait mode the piece waits for the chosen hand only', async ({ page }) => {
    await openTwoHands(page);
    await recordBeats(page);
    await page.locator('[data-pick="right"]').click();
    await aid(page, 'wait').click();
    await page.locator('#playPause').click();
    await expect.poll(async () => (await beats(page)).length, { timeout: 15000 }).toBe(1);
    expect((await beats(page))[0]).toMatchObject({ pitches: ['C4'], waiting: true });
  });
});

test.describe('Practice aids: screens', () => {
  test('are in Persian too', async ({ page }) => {
    await openSong(page, 'mary-lamb', 'fa');
    await expect(aid(page, 'wait')).toHaveText('منتظر من بمان');
    await expect(page.locator('[data-speed="75"]')).toHaveText('۷۵٪');
    await expect(page.locator('[data-pick="right"]')).toHaveText('راست');
  });

  test('fit the screen without scrolling sideways', async ({ page }) => {
    await openSong(page);
    await expect(page.locator('.practice-aids')).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
