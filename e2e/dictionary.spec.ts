import { test, expect, type Page } from '@playwright/test';

async function openAddress(page: Page, hash: string, locale?: 'fa') {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto(`/#/scales/${hash}`);
  await expect(page.locator('#scalesView')).toBeVisible();
  await expect(page.locator('#scalesView .sc-staff svg .note').first()).toBeVisible();
}

async function openPicker(page: Page) {
  const toggle = page.locator('#scalesView .dict-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

test.describe('Scale and chord dictionary', () => {
  test('an address names a Persian mode: koron on the staff, on the keys and in the stairs, with its disclaimer', async ({ page }) => {
    await openAddress(page, 'd-shur');
    await expect(page.locator('#scalesView .dict-scale-title')).toHaveText('D Shur');
    await expect(page.locator('#scalesView .sc-notes')).toHaveText('Notes: D E koron F G A B♭ C D');
    await expect(page.locator('#scalesView .dict-persian')).toContainText('teaching model');
    await expect(page.locator('#scalesView .dict-persian')).toContainText('not been checked');
    // the koron sign is drawn (SMuFL E460), not only written
    const koronGlyphs = await page.evaluate(
      () => [...document.querySelectorAll('#scalesView .sc-staff svg .accid use')].filter((u) => (u.getAttribute('xlink:href') ?? u.getAttribute('href') ?? '').includes('E460')).length,
    );
    expect(koronGlyphs).toBe(1);
    await expect(page.locator('#scalesView .dict-step[data-quarter="true"]')).toHaveCount(1);
    await expect(page.locator('#scalesView .sc-keys .lk-key.lk-quarter')).toHaveAttribute('data-note', 'E4');
    // E koron is played on the key of its letter
    await expect(page.locator('#scalesView .sc-keys .lk-key.marked')).toHaveCount(8);
  });

  test('the stairs are as wide as the gaps: a three-quarter step is narrower than a whole tone and wider than a half', async ({ page }) => {
    await openAddress(page, 'd-shur');
    const widths = await page.locator('#scalesView .dict-step').evaluateAll((steps) => steps.map((s) => (s as HTMLElement).getBoundingClientRect().width));
    // D (¾) E koron (¾) F (1) G (1) A (½) B♭ (1) C (1)
    expect(widths[2]).toBeGreaterThan(widths[0]);
    expect(widths[4]).toBeLessThan(widths[0]);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThan(2);
  });

  test('changing the root writes it into the address, and the address survives a reload', async ({ page }) => {
    await openAddress(page, 'c-major');
    await openPicker(page);
    await page.locator('#scalesView .sc-roots [data-root="1"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/scales/db-major');
    await page.reload();
    await expect(page.locator('#scalesView .sc-notes')).toHaveText('Notes: D♭ E♭ F G♭ A♭ B♭ C D♭');
  });

  test('searching in Persian finds a dastgah', async ({ page }) => {
    await openAddress(page, 'c-major');
    await openPicker(page);
    await page.locator('#scalesView .dict-search').fill('شور');
    await expect(page.locator('#scalesView .dict-scales [data-type="shur"]')).toBeVisible();
    await page.locator('#scalesView .dict-scales [data-type="shur"]').click();
    await expect(page.locator('#scalesView .dict-scale-title')).toContainText('Shur');
  });

  test('searching "C Dorian" chooses both the root and the scale', async ({ page }) => {
    await openAddress(page, 'c-major');
    await openPicker(page);
    await page.locator('#scalesView .dict-search').fill('C Dorian');
    await page.locator('#scalesView .dict-scales [data-type="dorian"]').click();
    await expect(page.locator('#scalesView .sc-notes')).toHaveText('Notes: C D E♭ F G A B♭ C');
  });

  test('chords: the main chords filter keeps degrees 1, 4 and 5', async ({ page }) => {
    await openAddress(page, 'c-major');
    await page.locator('#scalesView .sc-tab[data-tab="chords"]').click();
    await page.locator('#scalesView .dict-families [data-family="triad"]').click();
    await expect(page.locator('#scalesView .dict-card')).toHaveCount(7);
    await page.locator('#scalesView .dict-primary').click();
    await expect(page.locator('#scalesView .dict-card')).toHaveCount(3);
    await expect(page.locator('#scalesView .dict-card .dict-card-symbol')).toHaveText(['C', 'F', 'G']);
  });

  test('chords of a Persian mode come only from its piano notes, and say why a quarter tone has none', async ({ page }) => {
    await openAddress(page, 'd-shur');
    await page.locator('#scalesView .sc-tab[data-tab="chords"]').click();
    await page.locator('#scalesView .dict-families [data-family="triad"]').click();
    await expect(page.locator('#scalesView .dict-chords-quarter')).toContainText('Quarter tones in this mode');
    const symbols = await page.locator('#scalesView .dict-card .dict-card-symbol').allTextContents();
    expect(symbols).toEqual(['Dm', 'F', 'Gm', 'B♭']);
  });

  test('Persian: panels flip, the staff, the keys and the stairs stay left to right', async ({ page }) => {
    await openAddress(page, 'ek-segah', 'fa');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    expect(await page.locator('#scalesView .sc-staff').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('#scalesView .sc-keys').getAttribute('dir')).toBe('ltr');
    expect(await page.locator('#scalesView .dict-stairs').getAttribute('dir')).toBe('ltr');
    await expect(page.locator('#scalesView .dict-persian')).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });

  test('a stair step plays its note without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openAddress(page, 'd-shur');
    const samples = page.waitForResponse((r) => r.url().includes('/samples/salamander/'));
    await page.locator('#scalesView .dict-step').nth(1).click();
    expect((await samples).status()).toBe(200);
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });
});
