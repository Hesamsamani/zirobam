import { test, expect, type Page } from '@playwright/test';

interface Asked {
  stage: number;
  kind: string;
  notes: string[];
  answer: string | null;
}

/** Opens ear training, with every stage open when `allStages` is set. */
async function openEar(page: Page, options: { allStages?: boolean; locale?: 'fa' } = {}) {
  await page.addInitScript(
    ([all, locale]) => {
      if (all) localStorage.setItem('earStats.v1', JSON.stringify({ version: 1, pitches: {}, recent: {}, maxStage: 5 }));
      if (locale) localStorage.setItem('ui.locale', locale);
    },
    [options.allStages ?? false, options.locale ?? ''] as const,
  );
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="ear"]').click();
  await expect(page.locator('#earView')).toBeVisible();
}
/** What is asked now: the screen keeps it in window.__earQuestion for these tests. */
const asked = (page: Page) => page.evaluate(() => (window as unknown as { __earQuestion?: Asked }).__earQuestion ?? null);

test.describe('Ear training', () => {
  test('opens from the menu with stage 1, and the other stages locked', async ({ page }) => {
    await openEar(page);
    await expect(page.locator('#earView .view-title')).toHaveText('Ear training');
    await expect(page.locator('.ear-stage')).toHaveCount(5);
    await expect(page.locator('.ear-stage[data-stage="1"]')).toBeEnabled();
    await expect(page.locator('.ear-stage[data-stage="2"]')).toBeDisabled();
    await expect(page.locator('.ear-prompt')).toHaveText('Which note is higher?');
    await expect(page.locator('.ear-choice')).toHaveText(['The first', 'The second']);
  });

  test('plays the notes from the app\'s own piano files and counts a right answer', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openEar(page);
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('.ear-hear').click();
    expect((await samples).status()).toBe(200);
    await expect(page.locator('.ear-hear')).toHaveText('Hear it again');
    const question = await asked(page);
    await page.locator(`.ear-choice[data-choice="${question!.answer}"]`).click();
    await expect(page.locator('.ear-feedback')).toHaveText('Right!');
    await expect(page.locator('.ear-progress')).toContainText('1 of 20, 100% right');
    expect(errors).toEqual([]);
  });

  test('says what the right answer was after a wrong one', async ({ page }) => {
    await openEar(page);
    const question = await asked(page);
    const wrong = question!.answer === 'first' ? 'second' : 'first';
    await page.locator(`.ear-choice[data-choice="${wrong}"]`).click();
    await expect(page.locator('.ear-feedback')).toContainText('Not quite. It was:');
    await expect(page.locator('.ear-progress')).toContainText('1 of 20, 0% right');
    await expect(page.locator('.ear-next')).toBeVisible();
  });

  test('Next asks a new question and plays it', async ({ page }) => {
    await openEar(page);
    const first = await asked(page);
    await page.locator(`.ear-choice[data-choice="${first!.answer}"]`).click();
    await page.locator('.ear-next').click();
    await expect(page.locator('.ear-feedback')).toHaveText('');
    await expect(page.locator('.ear-hear')).toHaveText('Hear it again'); // it played by itself
    const second = await asked(page);
    expect(second!.notes.join()).not.toBe(first!.notes.join());
  });

  test('answering 20 questions right opens the next stage', async ({ page }) => {
    test.setTimeout(120000);
    await openEar(page);
    for (let i = 0; i < 20; i++) {
      const question = await asked(page);
      await page.locator(`.ear-choice[data-choice="${question!.answer}"]`).click();
      if (i < 19) await page.locator('.ear-next').click();
    }
    await expect(page.locator('.ear-stage[data-stage="2"]')).toBeEnabled();
    await expect(page.locator('.ear-progress')).toContainText('Stage 2 is open!');
    await page.locator('.ear-stage[data-stage="2"]').click();
    await expect(page.locator('.ear-prompt')).toHaveText('How far apart are the two notes?');
    await expect(page.locator('.ear-choice')).toHaveCount(5);
  });

  test('right answers earn XP and show on the progress screen', async ({ page }) => {
    await openEar(page);
    const question = await asked(page);
    await page.locator(`.ear-choice[data-choice="${question!.answer}"]`).click();
    await page.goto('#/progress');
    await expect(page.locator('#progressView')).toContainText('Ear training answers');
    await expect(page.locator('#progressView .pv-stat', { hasText: 'Ear training answers' })).toContainText('1');
  });

  test('stage 5: play a melody back on the keys', async ({ page }) => {
    await openEar(page, { allStages: true });
    await page.locator('.ear-stage[data-stage="5"]').click();
    await expect(page.locator('.ear-keyboard .lk')).toBeVisible();
    for (let i = 0; i < 30; i++) {
      const question = await asked(page);
      for (const note of question!.notes) await page.locator(`.ear-keyboard .lk-key[data-note="${note}"]`).click();
      await expect(page.locator('.ear-feedback')).toHaveText('Right!');
      if (question!.kind === 'playMelody') break;
      await page.locator('.ear-next').click();
    }
    expect((await asked(page))!.kind).toBe('playMelody');
  });

  test('is in Persian too', async ({ page }) => {
    await openEar(page, { locale: 'fa' });
    await expect(page.locator('#earView .view-title')).toHaveText('تمرین گوش');
    await expect(page.locator('.ear-prompt')).toHaveText('کدام نت بالاتر است؟');
    await expect(page.locator('.ear-choice')).toHaveText(['اولی', 'دومی']);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('fits the screen without scrolling sideways', async ({ page }) => {
    await openEar(page, { allStages: true });
    await page.locator('.ear-stage[data-stage="5"]').click();
    await expect(page.locator('.ear-keyboard .lk')).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
