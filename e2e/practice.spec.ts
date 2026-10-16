import { test, expect, type Page } from '@playwright/test';

const KEY_FOR: Record<string, string> = {
  C4: 'KeyA', D4: 'KeyS', E4: 'KeyD', F4: 'KeyF', G4: 'KeyG', A4: 'KeyH', B4: 'KeyJ', C5: 'KeyK', D5: 'KeyL',
};

async function openSong(page: Page, songId = 'mary-lamb', locale?: 'fa'): Promise<void> {
  if (locale) {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
    }, locale);
  }
  await page.goto('/');
  await page.locator('#mainMenu [data-tile="songs"]').click();
  await page.locator(`#songsView [data-song="${songId}"]`).click();
  await expect(page.locator('.pp-measure').first()).toBeVisible();
}

const measure = (page: Page, n: number) => page.locator(`.pp-measure[data-measure="${n}"]`);

test.describe('Practice steps', () => {
  test('show a map with one box per measure and the first step', async ({ page }) => {
    await openSong(page);
    await expect(page.locator('.pp-measure')).toHaveCount(8);
    await expect(page.locator('.pp-type')).toHaveText('Learning');
    await expect(page.locator('.pp-where')).toHaveText('Measure 1');
    await expect(page.locator('.pp-count')).toContainText('Step 1 of');
    await expect(measure(page, 1)).toHaveAttribute('data-state', 'current');
    await expect(measure(page, 2)).toHaveAttribute('data-state', 'todo');
    await expect(page.locator('.pp-bracket')).toHaveCount(1);
    await expect(page.locator('.pp-status')).toHaveText('Play this measure on its own, without a mistake.');
    await expect(page.locator('.pp-prev')).toBeDisabled();
  });

  test('the old slider is gone and nothing overlaps the step title', async ({ page }) => {
    await openSong(page);
    await expect(page.locator('#practiceProgressContainer')).toHaveCount(0);
    const title = await page.locator('.pp-title').boundingBox();
    const steps = await page.locator('.pp-steps').boundingBox();
    // the title block and the step buttons never share the same area
    const overlap = title!.x < steps!.x + steps!.width && steps!.x < title!.x + title!.width &&
      title!.y < steps!.y + steps!.height && steps!.y < title!.y + title!.height;
    expect(overlap).toBe(false);
  });

  test('the next and previous buttons move one step at a time', async ({ page }) => {
    await openSong(page);
    await page.locator('.pp-next').click();
    await expect(page.locator('.pp-type')).toHaveText('Connecting');
    await expect(page.locator('.pp-where')).toHaveText('Measures 1-2');
    await expect(page.locator('.pp-bracket')).toHaveAttribute('data-type', 'pair');
    await expect(page.locator('.pp-prev')).toBeEnabled();
    await page.locator('.pp-prev').click();
    await expect(page.locator('.pp-where')).toHaveText('Measure 1');
  });

  test('the last step has no next button, and it covers the whole piece', async ({ page }) => {
    await openSong(page);
    const total = Number((await page.locator('.pp-count').textContent())!.match(/of (\d+)/)![1]);
    for (let i = 1; i < total; i++) await page.locator('.pp-next').click();
    await expect(page.locator('.pp-next')).toBeDisabled();
    await expect(page.locator('.pp-where')).toHaveText('Measures 1-8');
    await expect(page.locator('.pp-bracket')).toHaveAttribute('data-type', 'consolidate');
    await expect(page.locator('.pp-measure[data-state="current"]')).toHaveCount(8);
  });

  test('pressing a measure jumps to the step that teaches it, and earlier measures show as done', async ({ page }) => {
    await openSong(page);
    await measure(page, 5).click();
    await expect(page.locator('.pp-where')).toHaveText('Measure 5');
    await expect(measure(page, 5)).toHaveAttribute('data-state', 'current');
    await expect(measure(page, 1)).toHaveAttribute('data-state', 'done');
    await expect(measure(page, 4)).toHaveAttribute('data-state', 'done');
    await expect(measure(page, 6)).toHaveAttribute('data-state', 'todo');
    // the score shows that measure
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
  });

  test('the map works from the keyboard', async ({ page }) => {
    await openSong(page);
    await measure(page, 1).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(measure(page, 3)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pp-where')).toHaveText('Measure 3');
    await page.keyboard.press('End');
    await expect(measure(page, 8)).toBeFocused();
  });

  test('keep the place after a reload', async ({ page }) => {
    await openSong(page);
    await measure(page, 4).click();
    await expect(page.locator('.pp-where')).toHaveText('Measure 4');
    await page.goto('/#/practice');
    await expect(page.locator('.pp-where')).toHaveText('Measure 4');
  });

  test('fit the screen without scrolling sideways', async ({ page }) => {
    await openSong(page, 'minuet-g');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await page.locator('.practice-panel').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  });
});

test.describe('Practice feedback', () => {
  test('playing nothing repeats the step and says how many notes were missed', async ({ page }) => {
    await openSong(page);
    await page.locator('#bpm').fill('200');
    await page.locator('#bpm').blur();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-attempt')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.pp-attempt')).toHaveText('Attempt 2');
    await expect(page.locator('.pp-status')).toHaveAttribute('data-tone', 'retry');
    await expect(page.locator('.pp-status')).toContainText('Not yet');
    await expect(page.locator('.pp-status')).toContainText('Missed: 4');
    await expect(page.locator('.pp-where')).toHaveText('Measure 1'); // still the same step
    await page.locator('#playPause').click();
  });

  test('a clean run moves on and says what comes next', async ({ page }) => {
    await openSong(page);
    await page.evaluate((keys) => {
      document.addEventListener('trainer:beat', (e) => {
        const pitches = (e as CustomEvent).detail.pitches as string[];
        setTimeout(() => {
          for (const pitch of pitches) {
            const code = (keys as Record<string, string>)[pitch];
            if (!code) continue;
            document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 60);
          }
        }, 40);
      });
    }, KEY_FOR);
    await page.locator('#bpm').fill('200');
    await page.locator('#bpm').blur();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-status')).toHaveAttribute('data-tone', 'good', { timeout: 60000 });
    await expect(page.locator('.pp-status')).toContainText('Clean run. Next: Measures 1-2');
    await expect(page.locator('.pp-where')).toHaveText('Measures 1-2');
    await expect(page.locator('.pp-attempt')).toBeHidden();
    await page.locator('#playPause').click();
  });

  test('moving to another step starts counting attempts again', async ({ page }) => {
    await openSong(page);
    await page.locator('#bpm').fill('200');
    await page.locator('#bpm').blur();
    await page.locator('#playPause').click();
    await expect(page.locator('.pp-attempt')).toBeVisible({ timeout: 60000 });
    await page.locator('.pp-next').click(); // also stops the playback
    await expect(page.locator('.pp-attempt')).toBeHidden();
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
  });
});

test.describe('Practice steps in Persian', () => {
  test('use Persian words and digits, a translated title, and a left-to-right map', async ({ page }) => {
    await openSong(page, 'mary-lamb', 'fa');
    await expect(page.locator('.pp-type')).toHaveText('یادگیری');
    await expect(page.locator('.pp-where')).toHaveText('میزان ۱');
    await expect(measure(page, 3)).toHaveText('۳');
    await expect(page.locator('.score-title h1')).not.toHaveText(/Mary Had/);
    await expect(page.locator('.score-title h1')).toContainText('مری');
    expect(await page.locator('.pp-map').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    const first = await measure(page, 1).boundingBox();
    const last = await measure(page, 8).boundingBox();
    expect(first!.x).toBeLessThan(last!.x);
    await expect(page.locator('.pp-status')).toContainText('همین میزان');
  });
});
