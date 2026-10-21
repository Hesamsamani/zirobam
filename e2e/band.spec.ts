import { test, expect } from '@playwright/test';

test.describe('Backing band', () => {
  test('plays the progression with drums, bass and chords from synths and the app\'s own piano, marks the bar and stops', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/#/generator?t=band&s=c-major&style=funk&bars=4&seed=5&bpm=140');
    await expect(page.locator('#generatorView')).toBeVisible();
    await expect(page.locator('.gen-band')).toBeVisible();
    await expect(page.locator('.gen-line')).toHaveCount(0);
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('.gen-play').click();
    expect((await samples).status()).toBe(200);
    await expect(page.locator('.gen-play')).toHaveText('Stop');
    // the loop goes round: the marked bar moves and the chord is named
    await expect(page.locator('.gen-bar[data-current="true"]')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.band-now')).toContainText('Now: ', { timeout: 8000 });
    await page.locator('.gen-group-band-parts [data-part="drums"]').click();
    await page.locator('.gen-group-band-transpose [data-transpose="up"]').click();
    await expect(page.locator('.band-transpose-value')).toHaveText('+1');
    await expect(page.locator('.gen-play')).toHaveText('Stop');
    await page.locator('.gen-play').click();
    await expect(page.locator('.gen-play')).toHaveText('Play');
    expect(errors).toEqual([]);
  });

  test('stops when the screen is left', async ({ page }) => {
    await page.goto('/#/generator?t=band&s=c-major&style=pop&bars=4&seed=2');
    await page.locator('.gen-play').click();
    await expect(page.locator('.gen-play')).toHaveText('Stop');
    await page.goto('/#/');
    await page.goto('/#/generator?t=band&s=c-major&style=pop&bars=4&seed=2');
    await expect(page.locator('.gen-play')).toHaveText('Play');
  });
});
