import { test, expect, type Page } from '@playwright/test';

async function openHome(page: Page, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto('/');
  await expect(page.locator('#mainMenu')).toBeVisible();
}

test.describe('Today', () => {
  test('the home screen has a card for the plan of the day, above Continue, that opens it', async ({ page }) => {
    await openHome(page);
    const card = page.locator('#mainMenu .menu-today');
    await expect(card).toBeVisible();
    await expect(card.locator('.menu-today-title')).toHaveText(/^Today: 0 of \d done$/);
    await expect(page.locator('#mainMenu .menu-tile')).toHaveCount(16); // the card is not a tile
    await card.click();
    await expect(page.locator('#todayView')).toBeVisible();
    await expect(page.locator('#todayView .td-block[data-kind="levels"]')).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe('#/today');
  });

  test('a block starts its screen', async ({ page }) => {
    await openHome(page);
    await page.locator('#mainMenu .menu-today').click();
    await page.locator('#todayView .td-block[data-kind="levels"] .td-start').click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'levels');
  });

  test('ticking every block off pays 15 XP once, earns the badge and keeps the plan after a reload', async ({ page }) => {
    await openHome(page);
    await page.locator('#mainMenu .menu-today').click();
    const blocks = page.locator('#todayView .td-block');
    const count = await blocks.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < count; i++) await page.locator('#todayView .td-block .td-done').nth(i).click();
    await expect(page.locator('#todayView .td-all')).toHaveText('All done for today. Well done!');
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('game.v1')!));
    expect(state.badges['today-first']).toBeTruthy();
    expect(state.xp).toBe(15);
    await page.reload();
    await expect(page.locator('#todayView .td-progress')).toHaveText(`${count} of ${count} done`);
    // taking a block off and putting it back does not pay again
    await page.locator('#todayView .td-block .td-done').first().click();
    await page.locator('#todayView .td-block .td-done').first().click();
    const again = await page.evaluate(() => JSON.parse(localStorage.getItem('game.v1')!));
    expect(again.xp).toBe(15);
  });

  test('is in Persian and fits the screen', async ({ page }) => {
    await openHome(page, 'fa');
    await expect(page.locator('#mainMenu .menu-today-title')).toContainText('امروز');
    await page.locator('#mainMenu .menu-today').click();
    await expect(page.locator('#todayView .view-title')).toHaveText('امروز');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
