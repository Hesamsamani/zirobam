import { test, expect, type Page } from '@playwright/test';

/** Picture-in-Picture is removed so the in-page panel (the fallback) is what these tests drive. */
async function openApp(page: Page, path = '/', locale?: 'fa'): Promise<void> {
  await page.addInitScript((value) => {
    delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture;
    if (value && !localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
  }, locale ?? null);
  await page.goto(path);
}

async function openMetronome(page: Page): Promise<void> {
  await page.locator('#mainMenu [data-tile="metronome"]').click();
  await expect(page.locator('.metro-float')).toBeVisible();
}

const panel = (page: Page) => page.locator('.metro-float .metro-panel');
const bpmText = (page: Page) => panel(page).locator('.metro-bpm');

test.describe('Floating metronome', () => {
  test('opens from the menu as a small panel that shows the exercise tempo', async ({ page }) => {
    await openApp(page);
    await openMetronome(page);
    await expect(bpmText(page)).toHaveText('30');
    await expect(panel(page).locator('[data-action="toggle"]')).toHaveText('Start');
    const box = await page.locator('.metro-float').boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  });

  test('shares the tempo with the exercise in both directions', async ({ page }) => {
    await openApp(page);
    await openMetronome(page);
    await panel(page).locator('[data-action="faster"]').click();
    await panel(page).locator('[data-action="faster"]').click();
    await expect(bpmText(page)).toHaveText('32');

    // on a phone the floating panel can cover the tile, so press it directly
    await page.locator('#mainMenu [data-tile="levels"]').evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('#bpm')).toHaveValue('32');
    await expect(page.locator('.metro-float')).toBeVisible(); // the window stays open on every screen

    await page.locator('#bpm').fill('90');
    await page.locator('#bpm').blur();
    await expect(bpmText(page)).toHaveText('90');
  });

  test('runs as a metronome of its own and lights the beat dots', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openApp(page);
    await openMetronome(page);
    await panel(page).locator('.metro-slider').evaluate((el: HTMLInputElement) => {
      el.value = '200';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await panel(page).locator('[data-action="toggle"]').click();
    await expect(panel(page)).toHaveAttribute('data-running', 'true');
    await expect(panel(page).locator('[data-action="toggle"]')).toHaveText('Stop');
    await expect(panel(page).locator('.metro-dot[data-on="true"]')).toHaveCount(1, { timeout: 10000 });
    await expect(panel(page).locator('.metro-dot').first()).toHaveClass(/accent/);

    // the lit dot moves from beat to beat
    const seen = new Set<number>();
    for (let i = 0; i < 30 && seen.size < 3; i++) {
      seen.add(await panel(page).locator('.metro-dot').evaluateAll((dots) => dots.findIndex((d) => (d as HTMLElement).dataset.on === 'true')));
      await page.waitForTimeout(100);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);

    await panel(page).locator('[data-action="toggle"]').click();
    await expect(panel(page)).toHaveAttribute('data-running', 'false');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the bar length changes the number of dots', async ({ page }) => {
    await openApp(page);
    await openMetronome(page);
    await expect(panel(page).locator('.metro-dot')).toHaveCount(4);
    await panel(page).locator('[data-beats="3"]').click();
    await expect(panel(page).locator('.metro-dot')).toHaveCount(3);
    await panel(page).locator('[data-beats="6"]').click();
    await expect(panel(page).locator('.metro-dot')).toHaveCount(6);
  });

  test('tap tempo sets the tempo from the taps', async ({ page }) => {
    await openApp(page);
    await openMetronome(page);
    const tap = panel(page).locator('[data-action="tap"]');
    for (let i = 0; i < 4; i++) {
      await tap.click();
      await page.waitForTimeout(500);
    }
    const bpm = Number(await bpmText(page).textContent());
    // taps 500 ms apart plus click overhead: somewhere around 100 BPM
    expect(bpm).toBeGreaterThan(70);
    expect(bpm).toBeLessThan(135);
  });

  test('can be dragged and closed, and the control-bar button opens it again', async ({ page }) => {
    await openApp(page, '/#/levels');
    await page.locator('#metronomePopout').click();
    const box = page.locator('.metro-float');
    await expect(box).toBeVisible();
    await expect(page.locator('#metronomePopout')).toHaveAttribute('aria-pressed', 'true');

    const before = await box.boundingBox();
    const bar = await page.locator('.metro-float-bar').boundingBox();
    await page.mouse.move(bar!.x + 20, bar!.y + 10);
    await page.mouse.down();
    await page.mouse.move(bar!.x - 40, bar!.y + 60, { steps: 4 });
    await page.mouse.up();
    const after = await box.boundingBox();
    expect(Math.abs(after!.x - before!.x) + Math.abs(after!.y - before!.y)).toBeGreaterThan(20);

    await page.locator('.metro-float-close').click();
    await expect(box).toHaveCount(0);
    await expect(page.locator('#metronomePopout')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#metronomePopout').click();
    await expect(page.locator('.metro-float')).toBeVisible();
  });
});

test.describe('Floating metronome and the exercise', () => {
  test('follows the exercise while it plays and gives the controls back afterwards', async ({ page }) => {
    await openApp(page, '/#/levels');
    await page.waitForSelector('#notation svg');
    await page.locator('#metronomePopout').click();
    await panel(page).locator('[data-action="toggle"]').click();
    await expect(panel(page)).toHaveAttribute('data-running', 'true');

    await page.locator('#bpm').fill('150');
    await page.locator('#bpm').blur();
    await page.locator('#playPause').click();
    await expect(panel(page)).toHaveAttribute('data-following', 'true', { timeout: 30000 });
    await expect(panel(page)).toHaveAttribute('data-running', 'false'); // its own metronome stopped
    await expect(panel(page).locator('.metro-status')).toHaveText('Following the exercise');
    await expect(panel(page).locator('[data-action="toggle"]')).toBeDisabled();
    await expect(panel(page).locator('[data-action="faster"]')).toBeDisabled();
    await expect(bpmText(page)).toHaveText('150');

    // the dots follow the exercise's count-off and beats
    await expect(panel(page).locator('.metro-dot[data-on="true"]')).toHaveCount(1, { timeout: 10000 });

    await page.locator('#playPause').click();
    await expect(panel(page)).toHaveAttribute('data-following', 'false');
    await expect(panel(page).locator('[data-action="toggle"]')).toBeEnabled();
  });

  test('the exercise metronome volume slider and the window volume are linked', async ({ page }) => {
    await openApp(page, '/#/levels');
    await page.locator('#metronomePopout').click();
    await panel(page).locator('.metro-volume').evaluate((el: HTMLInputElement) => {
      el.value = '80';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#metronomeVolume')).toHaveValue('80');
  });
});

test.describe('Floating metronome in Persian', () => {
  test('is right-to-left with Persian text and digits', async ({ page }) => {
    await openApp(page, '/', 'fa');
    await openMetronome(page);
    await expect(panel(page).locator('.metro-status')).toBeEmpty();
    await expect(page.locator('.metro-float')).toHaveAttribute('aria-label', 'مترونوم');
    await expect(panel(page).locator('[data-action="toggle"]')).toHaveText('شروع');
    await expect(bpmText(page)).toHaveText('۳۰');
    await expect(panel(page).locator('[data-beats="4"]')).toHaveText('۴');
  });
});
