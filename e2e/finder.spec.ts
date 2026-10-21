import { test, expect } from '@playwright/test';

test.describe('Scale finder and circle of fifths', () => {
  test('finds the scales that hold the chosen notes and opens one', async ({ page }) => {
    await page.goto('/#/scales/c-major');
    await expect(page.locator('#scalesView')).toBeVisible();
    await page.locator('#scalesView .sc-tab[data-tab="find"]').click();
    await expect(page.locator('#scalesView .dict-finder')).toBeVisible();
    for (const pc of [2, 5, 9]) await page.locator(`#scalesView .fd-notes [data-pc="${pc}"]`).click();
    await expect(page.locator('#scalesView .fd-result').first()).toBeVisible();
    const names = await page.locator('#scalesView .fd-result-name').allTextContents();
    expect(names).toContain('D Natural minor');
    await page.locator('#scalesView .fd-result[data-scale="natural-minor"][data-root="2"]').click();
    await expect(page.locator('#scalesView .dict-scale-title')).toHaveText('D Natural minor');
    await expect(page.locator('#scalesView .sc-notes')).toHaveText('Notes: D E F G A B♭ C D');
  });

  test('the circle of fifths has twenty-four keys, and G major opens its scale', async ({ page }) => {
    await page.goto('/#/scales/c-major');
    await page.locator('#scalesView .sc-tab[data-tab="find"]').click();
    await expect(page.locator('#scalesView .circle-key')).toHaveCount(24);
    await page.locator('#scalesView .circle-major[data-root="7"]').click();
    await expect(page.locator('#scalesView .dict-scale-title')).toHaveText('G Major');
    expect(await page.evaluate(() => location.hash)).toBe('#/scales/g-major');
  });

  test('fits the screen without scrolling sideways, in Persian too', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/scales/c-major');
    await page.locator('#scalesView .sc-tab[data-tab="find"]').click();
    await expect(page.locator('#scalesView .circle')).toBeVisible();
    expect(await page.locator('#scalesView .circle').getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
