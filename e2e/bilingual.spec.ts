import { test, expect } from '@playwright/test';

test.describe('Bilingual interface and practice without MIDI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/levels');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#notation svg', { timeout: 15000 });
  });

  test('switches to Persian: right-to-left text, left-to-right notation', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#languageSelect', 'fa');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.score-title h1')).toHaveText('نت‌خوانی');
    await expect(page.locator('#lessonInfo')).toContainText('نت گرد');
    const direction = await page.locator('#notation').evaluate((el) => getComputedStyle(el).direction);
    expect(direction).toBe('ltr');
  });

  test('remembers the language after a reload', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#languageSelect', 'fa');
    await page.reload();
    await page.waitForSelector('#notation svg', { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('note names follow the chosen system', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#noteNameSystem', 'solfege');
    await expect(page.locator('#lessonInfo')).toContainText('Do and Sol');
  });

  test('on-screen piano and computer keyboard light the keys', async ({ page }) => {
    await page.locator('#pianoToggle').click();
    await expect(page.locator('#pianoDock')).toBeVisible();

    const e4 = page.locator('.piano-key[data-note="E4"]');
    await e4.dispatchEvent('pointerdown');
    await expect(e4).toHaveClass(/pressed/);
    await e4.dispatchEvent('pointerup');
    await expect(e4).not.toHaveClass(/pressed/);

    await page.keyboard.down('a');
    await expect(page.locator('.piano-key[data-note="C4"]')).toHaveClass(/pressed/);
    await page.keyboard.up('a');
  });

  test('shows note names under the notes', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.locator('#showNoteNames').evaluate((el: HTMLInputElement) => el.click());
    await expect(page.locator('#notation text.note-label').first()).toBeVisible();
  });

  test('Name the note: opens on the quiz, answered by clicking', async ({ page }) => {
    await page.locator('#learnToggle').click();
    const view = page.locator('#learnView');
    await expect(view).toHaveAttribute('data-panel', 'quiz');

    const pitch = await view.getAttribute('data-pitch');
    await page.locator(`.learn-answer[data-letter="${pitch![0]}"]`).click();
    await expect(view).toHaveAttribute('data-result', 'correct');
  });
});
