import { test, expect, type Page } from '@playwright/test';

/** A mistake log with a few days of slips, as the app writes it (the day keys are local dates). */
async function withSlips(page: Page) {
  await page.addInitScript(() => {
    const day = (ago: number): string => {
      const d = new Date();
      d.setDate(d.getDate() - ago);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const data = {
      version: 1,
      days: {
        [day(0)]: { notes: { G4: [10, 8], Bb3: [6, 3], C4: [10, 0] }, chords: { Cmaj7: [5, 3] }, rhythm: { hits: 10, early: 1, late: 6, missed: 1 } },
        [day(8)]: { notes: { G4: [10, 5] }, chords: {}, rhythm: { hits: 0, early: 0, late: 0, missed: 0 } },
      },
    };
    localStorage.setItem('mistakes.v1', JSON.stringify(data));
  });
}

test.describe('Mistake heat map', () => {
  test('says there is nothing yet on a new device', async ({ page }) => {
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .heatmap .hm-empty')).toBeVisible();
  });

  test('shows the keys that are missed, the worst notes and chords, the rhythm and the weeks', async ({ page }) => {
    await withSlips(page);
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .hm-keys .lk-key.lk-heat')).toHaveCount(2);
    await expect(page.locator('#progressView .hm-keys .lk-key[data-note="G4"]')).toHaveAttribute('data-heat', '4');
    await expect(page.locator('#progressView .hm-keys .lk-key[data-note="A#3"]')).toHaveAttribute('data-heat', '3');
    const slips = await page.locator('#progressView .hm-slip').allTextContents();
    expect(slips[0]).toBe('G4: missed 13 of 20 (65%)');
    expect(slips.some((s) => s.startsWith('Cmaj7'))).toBe(true);
    await expect(page.locator('#progressView .hm-rhythm')).toBeVisible();
    await expect(page.locator('#progressView .heatmap')).toContainText('You tend to tap late.');
    await expect(page.locator('#progressView .hm-dot')).toHaveCount(2);
  });

  test('is in Persian, with the keys left to right, and fits the screen', async ({ page }) => {
    await withSlips(page);
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .hm-title')).toHaveText('کجا اشتباه می‌کنید');
    expect(await page.locator('#progressView .hm-keys .lk').getAttribute('dir')).toBe('ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
