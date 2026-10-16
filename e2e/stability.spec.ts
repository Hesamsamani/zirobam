import { test, expect, type Page } from '@playwright/test';

/** Regression tests for bugs found in the 2026-10-16 bug hunt (docs/bug-hunt-2026-10-16.md). */

interface BeatEvent {
  beatIndex: number;
}

async function recordBeats(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __beats: unknown[] };
    w.__beats = [];
    document.addEventListener('trainer:beat', (e) => w.__beats.push((e as CustomEvent).detail));
  });
}

async function readBeats(page: Page): Promise<BeatEvent[]> {
  return page.evaluate(() => (window as unknown as { __beats: BeatEvent[] }).__beats);
}

async function openApp(page: Page): Promise<void> {
  await page.goto('/#/levels');
  await page.waitForSelector('#notation svg', { timeout: 10000 });
}

test.describe('Startup', () => {
  test('the app still starts when the browser blocks storage', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Storage is blocked', 'SecurityError');
        },
      });
    });
    await page.goto('/#/levels');
    await expect(page.locator('#notation svg').first()).toBeVisible({ timeout: 10000 });
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});

test.describe('Tempo field', () => {
  test('keeps the tempo inside the supported range', async ({ page }) => {
    await openApp(page);
    const bpm = page.locator('#bpm');
    await bpm.fill('5000');
    await bpm.blur();
    await expect(bpm).toHaveValue('200');
    await bpm.fill('3');
    await bpm.blur();
    await expect(bpm).toHaveValue('20');
  });
});

test.describe('Level picker', () => {
  test('offers every level of the curriculum (20)', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#levelJump option')).toHaveCount(20);
  });

  test('shows the saved level when it is above 18', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sightreading-progress',
        JSON.stringify({ level: 20, subLevel: 1, repetitions: 0, currentBpm: 60, bpmMastery: 0 })
      );
    });
    await openApp(page);
    await expect(page.locator('#levelJump')).toHaveValue('20');
    await expect(page.locator('#levelDisplay')).toContainText('20');
  });
});

test.describe('Keyboard', () => {
  test('Space does not start the exercise while the Learn view is open', async ({ page }) => {
    await openApp(page);
    await page.locator('#learnToggle').click();
    await expect(page.locator('#learnView')).toBeVisible();
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
  });

  test('Space on the focused Start button toggles playback once', async ({ page }) => {
    await openApp(page);
    await page.locator('#playPause').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#playPause')).toHaveClass(/playing/, { timeout: 30000 });
    await page.waitForTimeout(1000);
    await expect(page.locator('#playPause')).toHaveClass(/playing/);
    await page.keyboard.press('Space');
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
  });
});

test.describe('Starting playback', () => {
  test('pressing the button again while the sounds load cancels the start', async ({ page }) => {
    await page.route('**/audio/salamander/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await openApp(page);
    await recordBeats(page);
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).toHaveAttribute('aria-busy', 'true');
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).not.toHaveAttribute('aria-busy', 'true');
    await page.waitForTimeout(8000);
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
    expect(await readBeats(page)).toHaveLength(0);
  });

  test('the exercise still runs, silently, when the piano sounds cannot be loaded', async ({ page }) => {
    await page.route('**/audio/salamander/**', (route) => route.abort());
    await openApp(page);
    await recordBeats(page);
    await page.locator('#bpm').fill('200');
    await page.locator('#playPause').click();
    await expect
      .poll(async () => (await readBeats(page)).length, { timeout: 30000, intervals: [250] })
      .toBeGreaterThan(0);
    await expect(page.locator('#notice')).toContainText(/sound/i);
  });
});

test.describe('Levels mode', () => {
  test('does not count a piece as passed when no note was played', async ({ page }) => {
    await openApp(page);
    await recordBeats(page);
    await page.locator('#bpm').fill('200');
    await page.locator('#playPause').click();
    // The piece plays to the end without any input, then a new piece starts from beat 0 again
    await expect
      .poll(async () => (await readBeats(page)).filter((b) => b.beatIndex === 0).length, {
        timeout: 60000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(2);
    await page.locator('#playPause').click();
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('sightreading-progress') ?? '{}'));
    expect(progress.repetitions ?? 0).toBe(0);
    await expect(page.locator('#levelDisplay')).toContainText('1a');
  });
});

test.describe('Uploads', () => {
  test('a bad file shows a message in the page, not a blocking alert', async ({ page }) => {
    let dialogs = 0;
    page.on('dialog', (dialog) => {
      dialogs++;
      void dialog.dismiss();
    });
    await openApp(page);
    await page.locator('#xmlUpload').setInputFiles({
      name: 'bad.musicxml',
      mimeType: 'text/xml',
      buffer: Buffer.from('this is not music'),
    });
    await expect(page.locator('#notice')).toBeVisible();
    await expect(page.locator('#notice')).toContainText(/MusicXML/);
    expect(dialogs).toBe(0);
    // still in the normal exercise screen
    await expect(page.locator('#exitPracticeMode')).toBeHidden();
    await expect(page.locator('#playPause')).toBeVisible();
  });
});

test.describe('Levels mode, played correctly', () => {
  test('a piece that is played note for note counts toward the next sub-level', async ({ page }) => {
    await openApp(page);
    // Play every note of the piece on the computer keyboard (A S D F G H J K L = C4..D5), just after it is highlighted
    await page.evaluate(() => {
      const codeFor: Record<string, string> = {
        C4: 'KeyA', D4: 'KeyS', E4: 'KeyD', F4: 'KeyF', G4: 'KeyG', A4: 'KeyH', B4: 'KeyJ', C5: 'KeyK', D5: 'KeyL',
      };
      document.addEventListener('trainer:beat', (e) => {
        const pitches = (e as CustomEvent).detail.pitches as string[];
        setTimeout(() => {
          for (const pitch of pitches) {
            const code = codeFor[pitch];
            if (!code) continue;
            document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 80);
          }
        }, 60);
      });
    });
    await page.locator('#bpm').fill('200');
    await page.locator('#playPause').click();
    await expect
      .poll(
        async () =>
          page.evaluate(() => JSON.parse(localStorage.getItem('sightreading-progress') ?? '{}').repetitions ?? 0),
        { timeout: 90000, intervals: [500] }
      )
      .toBeGreaterThanOrEqual(1);
    await page.locator('#playPause').click();
  });
});
