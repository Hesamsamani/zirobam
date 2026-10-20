import { test, expect, type Page } from '@playwright/test';

// The dialog module is not used by a screen yet, so the tests load it from the dev server and open one by hand.
// This checks the real <dialog>.showModal() path, which jsdom (the unit tests) does not have.

async function openTestDialog(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await expect(page.locator('#mainMenu')).toBeVisible();
  await page.evaluate(async () => {
    const url = '/sightreading/src/ui/dialog.ts';
    const { openDialog } = await import(/* @vite-ignore */ url);
    const opener = document.createElement('button');
    opener.id = 'testOpener';
    opener.textContent = 'Open';
    document.body.append(opener);
    opener.focus();
    const body = document.createElement('div');
    for (const label of ['First', 'Second']) {
      const b = document.createElement('button');
      b.textContent = label;
      body.append(b);
    }
    // enough text that the body has to scroll on a phone
    for (let i = 0; i < 30; i++) body.append(Object.assign(document.createElement('p'), { textContent: 'Some content that makes the dialog taller. '.repeat(3) }));
    (window as unknown as { __closed: number }).__closed = 0;
    openDialog({ title: 'Chord details', body, onClose: () => ((window as unknown as { __closed: number }).__closed += 1) });
  });
  await expect(page.locator('dialog.app-dialog')).toBeVisible();
}

const inside = (page: Page) => page.evaluate(() => document.querySelector('dialog')!.contains(document.activeElement));
const closedCount = (page: Page) => page.evaluate(() => (window as unknown as { __closed: number }).__closed);

test.describe('Dialog', () => {
  test('opens as a modal, is named by its heading and holds the focus', async ({ page }) => {
    await openTestDialog(page);
    const dialog = page.locator('dialog.app-dialog');
    expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);
    await expect(dialog).toHaveAttribute('aria-labelledby', /appDialogTitle\d+/);
    await expect(dialog.getByRole('heading', { name: 'Chord details' })).toBeVisible();
    // the first control of the content has the focus
    await expect(dialog.getByRole('button', { name: 'First' })).toBeFocused();
  });

  test('Tab and Shift+Tab never leave the dialog', async ({ page }) => {
    await openTestDialog(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await inside(page)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await inside(page)).toBe(true);
    }
  });

  test('Escape closes it, once, and the focus goes back to the opener', async ({ page }) => {
    await openTestDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.app-dialog')).toHaveCount(0);
    await expect(page.locator('#testOpener')).toBeFocused();
    expect(await closedCount(page)).toBe(1);
  });

  test('the Close button closes it', async ({ page }) => {
    await openTestDialog(page);
    await page.locator('.app-dialog-close').click();
    await expect(page.locator('dialog.app-dialog')).toHaveCount(0);
    await expect(page.locator('#testOpener')).toBeFocused();
    expect(await closedCount(page)).toBe(1);
  });

  test('a click on the backdrop closes it, a click inside does not', async ({ page }) => {
    await openTestDialog(page);
    await page.locator('.app-dialog-title').click();
    await expect(page.locator('dialog.app-dialog')).toHaveCount(1);
    await page.mouse.click(4, 4);
    await expect(page.locator('dialog.app-dialog')).toHaveCount(0);
    expect(await closedCount(page)).toBe(1);
  });

  test('fits the screen: the Close button is on it and the body scrolls instead of the page', async ({ page }) => {
    await openTestDialog(page);
    // measure the resting place, not the slide-in
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const viewport = page.viewportSize()!;
    const dialog = (await page.locator('dialog.app-dialog').boundingBox())!;
    const close = (await page.locator('.app-dialog-close').boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(close.x).toBeGreaterThanOrEqual(0);
    expect(close.x + close.width).toBeLessThanOrEqual(viewport.width + 1);
    // 44 px target
    expect(close.height).toBeGreaterThanOrEqual(43.5);
    const scrolls = await page.locator('.app-dialog-body').evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolls).toBe(true);
  });

  test('in Persian the Close button is in Persian and the dialog is right-to-left', async ({ page }) => {
    await openTestDialog(page, 'fa');
    await expect(page.locator('.app-dialog-close')).toHaveText('بستن');
    expect(await page.locator('dialog.app-dialog').evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  });
});
