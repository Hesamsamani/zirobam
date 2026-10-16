import { test, expect, type Page } from '@playwright/test';

const HOME_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'];
const HOME_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];

async function openMenu(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
    }, locale);
  }
  await page.goto('/');
  await expect(page.locator('#mainMenu')).toBeVisible();
}

/** Opens the note quiz from the menu. */
async function startQuiz(page: Page): Promise<void> {
  await page.locator('#mainMenu [data-tile="learn"]').click();
  await expect(page.locator('#learnView')).toBeVisible();
  await expect(page.locator('#learnView')).toHaveAttribute('data-panel', 'quiz');
}

async function answerRight(page: Page): Promise<void> {
  const pitch = await page.locator('#learnView').getAttribute('data-pitch');
  await page.locator(`.learn-answer[data-letter="${pitch![0]}"]`).click();
  await expect(page.locator('#learnView')).toHaveAttribute('data-result', 'correct');
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('game.v1') ?? '{}'));

test.describe('Rewards on the home screen', () => {
  test('start at rank 1 with an empty goal and no streak', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('#mainMenu .hud-rank-name')).toHaveText('Rank 1');
    await expect(page.locator('#mainMenu .hud-goal-text')).toHaveText('Today: 0 of 50 XP');
    await expect(page.locator('#mainMenu .hud-streak-text')).toHaveText('Days in a row: 0');
    await expect(page.locator('#mainMenu .hud-rank-note')).toHaveText('50 XP to rank 2');
  });

  test('the progress tile opens the badges, all still locked', async ({ page }) => {
    await openMenu(page);
    await page.locator('#mainMenu [data-tile="progress"]').click();
    await expect(page).toHaveURL(/#\/progress$/);
    await expect(page.locator('#progressView')).toBeVisible();
    await expect(page.locator('.pv-badge')).toHaveCount(18);
    await expect(page.locator('.pv-badge[data-state="earned"]')).toHaveCount(0);
    await expect(page.locator('.pv-count')).toHaveText('0 of 18 earned');
    await page.locator('#progressView .back-btn').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
  });

  test('do not scroll the page sideways', async ({ page }) => {
    await openMenu(page);
    for (const route of ['/', '/#/progress']) {
      await page.goto(route);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Rewards for the note quiz', () => {
  test('a right answer earns XP, the first-note badge and a toast, and it all stays after a reload', async ({ page }) => {
    await openMenu(page);
    await startQuiz(page);
    await answerRight(page);

    const toasts = page.locator('#toasts');
    await expect(toasts).toHaveAttribute('role', 'status');
    await expect(toasts.locator('.toast[data-kind="xp"] .toast-title')).toHaveText('+2 XP');
    await expect(toasts.locator('.toast[data-kind="badge"] .toast-title', { hasText: 'First note' })).toHaveText('Badge earned: First note');
    expect((await saved(page)).xp).toBe(2);

    await page.reload();
    await expect(page.locator('#learnView')).toBeVisible();
    await page.locator('#learnView .learn-header .learn-text-btn').last().click();
    await expect(page.locator('#mainMenu .hud-goal-text')).toHaveText('Today: 2 of 50 XP');
    await page.locator('#mainMenu [data-tile="progress"]').click();
    await expect(page.locator('.pv-badge[data-badge="first-note"]')).toHaveAttribute('data-state', 'earned');
    await expect(page.locator('.pv-badge[data-badge="lessons"]')).toHaveAttribute('data-state', 'locked');
    await expect(page.locator('.pv-count')).toHaveText('1 of 18 earned');
    await expect(page.locator('[data-stat="correct"] dd')).toHaveText('1');
  });

  test('five right answers in a row show a combo and a bonus', async ({ page }) => {
    await openMenu(page);
    await startQuiz(page);
    for (let i = 0; i < 5; i++) {
      await answerRight(page);
      if (i < 4) await expect(page.locator('#learnView')).not.toHaveAttribute('data-result', /.+/, { timeout: 5000 });
    }
    await expect(page.locator('.learn-combo')).toHaveText('In a row: 5');
    expect((await saved(page)).xp).toBe(2 * 5 + 1); // five answers, one more for the fifth in a row
    expect((await saved(page)).counters.bestCombo).toBe(5);
  });

  test('a wrong answer earns nothing and ends the combo', async ({ page }) => {
    await openMenu(page);
    await startQuiz(page);
    await answerRight(page);
    await expect(page.locator('#learnView')).not.toHaveAttribute('data-result', /.+/, { timeout: 5000 });
    const pitch = await page.locator('#learnView').getAttribute('data-pitch');
    const wrong = pitch![0] === 'C' ? 'D' : 'C';
    await page.locator(`.learn-answer[data-letter="${wrong}"]`).click();
    await expect(page.locator('#learnView')).toHaveAttribute('data-result', 'wrong');
    expect((await saved(page)).xp).toBe(2); // the one right answer
    await expect(page.locator('.learn-combo')).toBeHidden();
  });

  test('opening the quiz alone earns nothing: the lessons have their own rewards', async ({ page }) => {
    await openMenu(page);
    await startQuiz(page);
    expect((await saved(page)).xp ?? 0).toBe(0);
    expect((await saved(page)).badges ?? {}).toEqual({});
  });
});

test.describe('Rewards for the xylophone', () => {
  test('finishing a song cleanly earns 30 XP, two badges and the stars', async ({ page }) => {
    await page.goto('/#/xylophone');
    await page.locator('[data-mode="song"]').click();
    await page.locator('.xylo-songs [data-song="mary-lamb"]').click();
    for (let i = 0; i < 26; i++) {
      const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
      await page.keyboard.press(HOME_CODES[HOME_NOTES.indexOf(asked!)]);
    }
    await expect(page.locator('#xylophoneView')).toHaveAttribute('data-result', 'done');
    await expect(page.locator('.toast[data-kind="badge"] .toast-title')).toContainText(['Badge earned: Bar by bar', 'Badge earned: Clean strikes']);
    const state = await saved(page);
    expect(state.xp).toBe(30);
    expect(state.xyloBest['mary-lamb']).toBe(3);
    expect(state.badges['xylo-first']).toBeTruthy();
    expect(state.badges['xylo-3stars']).toBeTruthy();
  });

  test('right answers in the read-and-play mode earn XP too', async ({ page }) => {
    await page.goto('/#/xylophone');
    await page.locator('[data-mode="read"]').click();
    const asked = await page.locator('#xylophoneView').getAttribute('data-pitch');
    await page.keyboard.press(HOME_CODES[HOME_NOTES.indexOf(asked!)]);
    await expect(page.locator('.toast[data-kind="xp"] .toast-title')).toHaveText('+2 XP');
  });
});

test.describe('Rewards for practice', () => {
  test('a clean run of a practice step earns 5 XP', async ({ page }) => {
    await page.goto('/');
    await page.locator('#mainMenu [data-tile="songs"]').click();
    await page.locator('#songsView [data-song="mary-lamb"]').click();
    await page.evaluate(() => {
      const keys: Record<string, string> = { C4: 'KeyA', D4: 'KeyS', E4: 'KeyD', F4: 'KeyF', G4: 'KeyG' };
      document.addEventListener('trainer:beat', (e) => {
        const pitches = (e as CustomEvent).detail.pitches as string[];
        setTimeout(() => {
          for (const pitch of pitches) {
            const code = keys[pitch];
            if (!code) continue;
            document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 60);
          }
        }, 40);
      });
    });
    await page.locator('#bpm').fill('200');
    await page.locator('#bpm').blur();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toHaveAttribute('data-tone', 'good', { timeout: 60000 });
    await page.locator('#playPause').click();
    await expect(page.locator('.toast[data-kind="xp"]').first()).toBeVisible();
    expect((await saved(page)).xp).toBeGreaterThanOrEqual(5);
    expect((await saved(page)).counters.stepsPassed).toBeGreaterThanOrEqual(1);
  });
});

test.describe('The progress screen', () => {
  test('the daily goal can be changed and the home screen follows', async ({ page }) => {
    await page.goto('/#/progress');
    await page.locator('[data-goal="100"]').click();
    await expect(page.locator('[data-goal="100"]')).toHaveAttribute('aria-pressed', 'true');
    expect((await saved(page)).goal).toBe(100);
    await page.locator('#progressView .back-btn').click();
    await expect(page.locator('#mainMenu .hud-goal-text')).toHaveText('Today: 0 of 100 XP');
  });

  test('starting over asks first, in the page, and then erases the progress', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('game.v1')) {
        const today = new Date();
        const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        localStorage.setItem('game.v1', JSON.stringify({
          version: 1, xp: 120, goal: 50, days: { [key]: 120 },
          counters: { correct: 40, bestCombo: 12, piecesPassed: 3, stepsPassed: 9, songsFinished: 1, xyloSongs: 0, xyloThreeStars: 0, maxLevel: 3, maxStage: 2 },
          songStars: { 'mary-lamb': 2 }, xyloBest: {}, badges: { 'first-note': key, combo10: key },
        }));
      }
    });
    let dialogs = 0;
    page.on('dialog', (d) => {
      dialogs++;
      void d.dismiss();
    });
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .hud-rank-name')).toHaveText('Rank 2');
    await expect(page.locator('#progressView .hud-goal-text')).toHaveText('Daily goal reached');
    await expect(page.locator('#progressView .hud-streak-text')).toHaveText('Days in a row: 1');

    await page.locator('.pv-reset').click();
    await expect(page.locator('.pv-confirm')).toBeVisible();
    await page.locator('.pv-reset-no').click();
    await expect(page.locator('.pv-confirm')).toBeHidden();
    expect((await saved(page)).xp).toBe(120);

    await page.locator('.pv-reset').click();
    await page.locator('.pv-reset-yes').click();
    await expect(page.locator('#progressView .hud-rank-name')).toHaveText('Rank 1');
    await expect(page.locator('.pv-count')).toHaveText('0 of 18 earned');
    expect((await saved(page)).xp).toBe(0);
    expect((await saved(page)).goal).toBe(50);
    expect(dialogs).toBe(0);
  });

  test('song cards show the best stars', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('game.v1')) {
        localStorage.setItem('game.v1', JSON.stringify({ version: 1, xp: 30, songStars: { 'mary-lamb': 3, twinkle: 1 } }));
      }
    });
    await page.goto('/#/songs');
    await expect(page.locator('[data-song="mary-lamb"] .song-card-stars .star.on')).toHaveCount(3);
    await expect(page.locator('[data-song="twinkle"] .song-card-stars .star.on')).toHaveCount(1);
    await expect(page.locator('[data-song="ode-to-joy"] .song-card-stars')).toHaveCount(0);
  });

  test('damaged saved progress does not stop the app', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('game.v1', '{"version":1,"xp":"lots","days":5,"badges":{"x":1}}'));
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .hud-rank-name')).toHaveText('Rank 1');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Rewards in Persian', () => {
  test('the home strip and the badges use Persian words and digits', async ({ page }) => {
    await openMenu(page, 'fa');
    await expect(page.locator('#mainMenu .hud-rank-name')).toHaveText('رتبه‌ی ۱');
    await expect(page.locator('#mainMenu .hud-goal-text')).toHaveText('امروز: ۰ از ۵۰ امتیاز');
    await page.locator('#mainMenu [data-tile="progress"]').click();
    await expect(page.locator('#progressView h2')).toHaveText('پیشرفت');
    await expect(page.locator('.pv-count')).toHaveText('۰ از ۱۸ نشان به دست آمده');
    await expect(page.locator('.pv-badge[data-badge="first-note"] .pv-badge-title')).toHaveText('نخستین نت');
  });
});
