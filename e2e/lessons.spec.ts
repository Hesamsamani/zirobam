import { test, expect, type Page } from '@playwright/test';

async function openMenu(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
    }, locale);
  }
  await page.goto('/');
  await expect(page.locator('#mainMenu')).toBeVisible();
}

const tile = (page: Page, id: string) => page.locator(`#mainMenu [data-tile="${id}"]`);
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('game.v1') ?? '{}'));

test.describe('Lessons', () => {
  test('the Lessons tile opens the course, apart from the quiz', async ({ page }) => {
    await openMenu(page);
    await expect(tile(page, 'lessons')).toContainText('Lessons');
    await expect(tile(page, 'learn')).toContainText('Note quiz');
    await tile(page, 'lessons').click();
    await expect(page).toHaveURL(/#\/lessons$/);
    await expect(page.locator('#lessonsView')).toBeVisible();
    await expect(page.locator('#learnView')).toBeHidden();
    await expect(page.locator('#lessonsView h2')).toHaveText('Lessons');
    await expect(page.locator('.course-unit')).toHaveCount(3);
    expect(await page.locator('.lesson-card').count()).toBeGreaterThanOrEqual(30);
    await expect(page.locator('.course-progress-text')).toContainText('0 of');
  });

  test('has lessons about notes, rhythm and the piano', async ({ page }) => {
    await page.goto('/#/lessons');
    await expect(page.locator('.course-unit')).toHaveCount(3); // the list is drawn after the page loads
    for (const unit of ['notes', 'rhythm', 'piano']) {
      expect(await page.locator(`.course-unit[data-unit="${unit}"] .lesson-card`).count(), unit).toBeGreaterThanOrEqual(10);
    }
  });

  test('Back returns to the menu', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'lessons').click();
    await page.locator('#lessonsView .back-btn').first().click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#lessonsView')).toBeHidden();
  });

  test('starts the first lesson, draws its notes and goes on to the next one', async ({ page }) => {
    await page.goto('/#/lessons');
    await page.locator('.course-continue').click();
    await expect(page).toHaveURL(/#\/lessons\/staff$/);
    await expect(page.locator('.lesson-title')).toHaveText('The staff');
    await expect(page.locator('.lesson-staff svg').first()).toBeVisible();
    await expect(page.locator('.lesson-staff g.note').first()).toBeVisible();

    await page.locator('.lesson-next').click();
    await expect(page).toHaveURL(/#\/lessons\/treble-clef$/);
    await expect(page.locator('.lesson-title')).toHaveText('The treble clef');
    await expect(page.locator('.lesson-staff .note-label').first()).toBeVisible();
    await expect(page.locator('.lesson-where-n')).toHaveText('Lesson 2 of 12');
  });

  test('reading a lesson is remembered, rewarded once and shown in the list', async ({ page }) => {
    await page.goto('/#/lessons/staff');
    await page.locator('.lesson-next').click();
    await expect(page.locator('#toasts .toast[data-kind="xp"] .toast-title')).toHaveText('+3 XP');
    expect((await saved(page)).xp).toBe(3);

    await page.reload();
    await page.locator('.lesson-all').click();
    await expect(page.locator('.course-progress-text')).toHaveText(/^1 of \d+ lessons read$/);
    await expect(page.locator('.lesson-card[data-lesson="staff"]')).toHaveAttribute('data-read', 'true');
    await expect(page.locator('.course-continue')).toContainText('The treble clef');

    // reading it again earns nothing more
    await page.locator('.lesson-card[data-lesson="staff"]').click();
    await page.locator('.lesson-next').click();
    expect((await saved(page)).xp).toBe(3);
  });

  test('a lesson has its own address, which works on a fresh page and with Back', async ({ page }) => {
    await page.goto('/#/lessons/five-finger-position');
    await expect(page.locator('.lesson-title')).toHaveText('The five-finger position');
    await expect(page.locator('.lk').first()).toBeVisible();
    await expect(page.locator('.lk .lk-mark').first()).toHaveText('1');

    await page.locator('.lesson-all').click();
    await expect(page).toHaveURL(/#\/lessons$/);
    await page.goBack();
    await expect(page.locator('.lesson-title')).toHaveText('The five-finger position');
  });

  test('a lesson that does not exist shows the list with a message', async ({ page }) => {
    await page.goto('/#/lessons/no-such-lesson');
    await expect(page.locator('.course-notice')).toContainText('does not exist');
    expect(await page.locator('.lesson-card').count()).toBeGreaterThanOrEqual(30);
  });

  test('"Try it" sends the student to the quiz, which has a way back to the lessons', async ({ page }) => {
    await page.goto('/#/lessons/staff');
    await page.locator('.lesson-try-btn[data-action="quiz"]').click();
    await expect(page).toHaveURL(/#\/learn$/);
    await expect(page.locator('#learnView')).toBeVisible();
    await expect(page.locator('#learnView')).toHaveAttribute('data-panel', 'quiz');
    await page.locator('.learn-open-lessons').click();
    await expect(page).toHaveURL(/#\/lessons$/);
    await expect(page.locator('#lessonsView')).toBeVisible();
    await expect(page.locator('#learnView')).toBeHidden();
  });

  test('the note names follow the chosen system', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.noteNames', 'solfege'));
    await page.goto('/#/lessons/treble-clef');
    await expect(page.locator('.lesson-p').first()).toContainText('Sol');
    await expect(page.locator('.lesson-staff .note-label').first()).toHaveText('Sol');
  });

  test('finishing the whole course pays the bonus and earns the student badge', async ({ page }) => {
    await page.goto('/#/lessons');
    await expect(page.locator('.lesson-card').first()).toBeVisible(); // the list is drawn after the page loads
    const ids = await page.locator('.lesson-card').evaluateAll((cards) => cards.map((c) => (c as HTMLElement).dataset.lesson!));
    const last = ids[ids.length - 1];
    await page.evaluate((all) => localStorage.setItem('lessons.read.v1', JSON.stringify(all.slice(0, -1))), ids);
    await page.goto(`/#/lessons/${last}`);
    await page.reload();
    await expect(page.locator('.lesson-next')).toHaveText('Finish the course', { timeout: 15000 }); // a reload of a heavy page, on a busy machine
    await page.locator('.lesson-next').click();
    await expect(page).toHaveURL(/#\/lessons$/);
    await expect(page.locator('.course-done')).toBeVisible();
    await expect(page.locator('.course-continue')).toHaveCount(0);
    const state = await saved(page);
    expect(state.xp).toBe(23);
    expect(state.badges.lessons).toBeTruthy();
    expect(state.badges['lessons-5']).toBeTruthy();
  });

  test('the Play button and the keys of a lesson work without errors, and Play ends by itself', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#/lessons/steps-skips');
    const play = page.locator('.lesson-play').first();
    await expect(play).toHaveText('Play');
    await play.click();
    // it sounds for a few seconds, or ends at once when the piano sounds cannot be loaded
    await expect(play).toHaveText('Play', { timeout: 40000 });
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    await page.goto('/#/lessons/finding-notes');
    await page.locator('.lk-key[data-note="E4"]').first().click();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('does not scroll sideways', async ({ page }) => {
    for (const route of ['#/lessons', '#/lessons/time-signature', '#/lessons/five-finger-position', '#/lessons/octaves']) {
      await page.goto(`/${route}`);
      await expect(page.locator('#lessonsView')).toBeVisible();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, route).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('Lessons in Persian', () => {
  test('are right-to-left, with Persian digits, and the pictures stay left-to-right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/lessons/note-names');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.lesson-title')).toHaveText('نام نت‌ها');
    await expect(page.locator('.lesson-where-n')).toHaveText('درس ۵ از ۱۲');
    await expect(page.locator('.lesson-staff').first()).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('.lesson-staff .note-label').first()).toHaveText('دو');
    await expect(page.locator('.lesson-next')).toContainText('درس بعدی');
  });

  test('the list is in Persian', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/lessons');
    await expect(page.locator('#lessonsView h2')).toHaveText('درس‌ها');
    await expect(page.locator('.course-continue')).toHaveText('شروع نخستین درس');
    await expect(page.locator('.lesson-card[data-lesson="staff"]')).toContainText('حامل');
  });

  test('the keyboard pictures show the finger numbers in Persian digits', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/lessons/five-finger-position');
    await expect(page.locator('.lk .lk-mark').first()).toHaveText('۱');
    await expect(page.locator('.lk').first()).toHaveAttribute('dir', 'ltr');
  });
});
