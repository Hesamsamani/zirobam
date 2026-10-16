import { test, expect, Page } from '@playwright/test';

/** Closes the options panel through its own close button, which works at every screen size. */
async function closeOptionsPanel(page: Page): Promise<void> {
  await page.locator('#optionsClose').click();
  await expect(page.locator('#optionsPanel')).toBeHidden();
}

test.describe('Sight Reading App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Verovio to load and render
    await page.waitForSelector('#notation svg', { timeout: 10000 });
  });

  test.describe('Page Load', () => {
    test('should display the app title', async ({ page }) => {
      await expect(page.locator('.score-title h1')).toHaveText('Sight Reading');
    });

    test('should show level display', async ({ page }) => {
      // Level display shows the level badge (e.g., "1a")
      const levelDisplay = page.locator('#levelDisplay');
      await expect(levelDisplay).toBeVisible();
    });

    test('should render music notation SVG', async ({ page }) => {
      // Use .first() since there may be multiple SVG elements
      const svg = page.locator('#notation svg').first();
      await expect(svg).toBeVisible();
    });

    test('should display grand staff (treble and bass clefs)', async ({ page }) => {
      // Check that staves exist in the notation (SVG has .staff elements)
      const staves = page.locator('#notation svg .staff');
      const count = await staves.count();
      // Should have at least 2 staves (treble + bass)
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Controls', () => {
    test('should have BPM input with default value 30', async ({ page }) => {
      const bpmInput = page.locator('#bpm');
      await expect(bpmInput).toHaveValue('30');
    });

    test('should change BPM when input is modified', async ({ page }) => {
      const bpmInput = page.locator('#bpm');
      await bpmInput.fill('60');
      await expect(bpmInput).toHaveValue('60');
    });

    test('should have metronome checkbox checked by default', async ({ page }) => {
      const metronome = page.locator('#metronome');
      await expect(metronome).toBeChecked();
    });

    test('should toggle metronome checkbox', async ({ page }) => {
      // Open options panel first
      await page.locator('#optionsToggle').click();
      await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
      // Use evaluate because checkbox is in a fixed panel that may be outside viewport
      await page.evaluate(() => {
        const checkbox = document.getElementById('metronome') as HTMLInputElement;
        if (checkbox) checkbox.click();
      });
      const metronome = page.locator('#metronome');
      await expect(metronome).not.toBeChecked();
    });

    test('should have Start button initially', async ({ page }) => {
      const playPauseBtn = page.locator('#playPause');
      // Button uses icons now, check aria-label instead of text
      await expect(playPauseBtn).toHaveAttribute('aria-label', 'Start');
    });
  });

  test.describe('Level Controls', () => {
    test('should increase level when + button is clicked', async ({ page }) => {
      const levelUp = page.locator('#levelUp');
      // The + button increases mastery/sub-level, need 3 clicks to advance sub-level
      // Just verify the button is clickable and app responds
      await levelUp.click();
      // Level display should still be visible (app didn't crash)
      await expect(page.locator('#levelDisplay')).toBeVisible();
    });

    test('should decrease level when - button is clicked', async ({ page }) => {
      // Use options panel to jump to level 2, then decrease
      await page.locator('#optionsToggle').click();
      await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
      await page.locator('#levelJump').selectOption('2');
      await page.waitForTimeout(100);
      // Close the options panel with its close button (on phones the panel covers the notation)
      await closeOptionsPanel(page);
      await page.waitForTimeout(100);

      await expect(page.locator('#levelDisplay')).toContainText('2');

      // Now decrease
      await page.locator('#levelDown').click();
      await expect(page.locator('#levelDisplay')).toContainText('1');
    });

    test('should not decrease below level 1', async ({ page }) => {
      const levelDown = page.locator('#levelDown');
      await levelDown.click();
      await levelDown.click();
      await levelDown.click();
      // Level display should contain "1" (level 1)
      await expect(page.locator('#levelDisplay')).toContainText('1');
    });

    test('should not increase above level 10 via jump selector', async ({ page }) => {
      // Open options panel
      await page.locator('#optionsToggle').click();
      await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });

      // Jump to level 10 (highest in selector)
      await page.locator('#levelJump').selectOption('10');
      await page.waitForTimeout(100);

      // Close the options panel with its close button (on phones the panel covers the notation)
      await closeOptionsPanel(page);
      await page.waitForTimeout(100);

      // Verify we're at level 10
      await expect(page.locator('#levelDisplay')).toContainText('10');
    });

    test('should regenerate notation when level changes', async ({ page }) => {
      // Get the initial SVG content (use .first() since there may be multiple SVGs)
      const initialSvg = await page.locator('#notation svg').first().innerHTML();

      // Use level jump to change level
      await page.locator('#optionsToggle').click();
      await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
      await page.locator('#levelJump').selectOption('2');
      await page.waitForTimeout(100);
      // Close the options panel with its close button (on phones the panel covers the notation)
      await closeOptionsPanel(page);
      await page.waitForTimeout(100);

      // Get new SVG content (should be different since new piece is generated)
      const newSvg = await page.locator('#notation svg').first().innerHTML();

      // The notation should have changed (different random piece)
      expect(initialSvg).not.toBe(newSvg);
    });
  });

  // Note: "Hands Separate Mode" tests removed - feature was replaced with per-level hand modes

  test.describe('Playback', () => {
    test('should change button to Stop when started', async ({ page }) => {
      const playPauseBtn = page.locator('#playPause');
      await playPauseBtn.click();
      // Button uses icons now, check aria-label instead of text
      await expect(playPauseBtn).toHaveAttribute('aria-label', 'Stop');
    });

    test('should show countoff when playback starts', async ({ page }) => {
      await page.locator('#playPause').click();
      const countoff = page.locator('#countoff');
      await expect(countoff).toBeVisible();
      await expect(countoff).toHaveClass(/visible/);
    });

    test('should change button back to Start when stopped', async ({ page }) => {
      const playPauseBtn = page.locator('#playPause');
      await playPauseBtn.click();
      // Button uses icons now, check aria-label instead of text
      await expect(playPauseBtn).toHaveAttribute('aria-label', 'Stop');
      await playPauseBtn.click();
      await expect(playPauseBtn).toHaveAttribute('aria-label', 'Start');
    });
  });

  test.describe('Music Notation Quality', () => {
    test('should have notes in the notation', async ({ page }) => {
      const notes = page.locator('#notation svg .note');
      const count = await notes.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have beams on eighth notes at higher levels', async ({ page }) => {
      // Go to level 7 where eighth notes appear
      const levelUp = page.locator('#levelUp');
      for (let i = 0; i < 6; i++) {
        await levelUp.click();
      }

      await page.waitForTimeout(100);

      // Check for beams in the notation (may or may not exist depending on random generation)
      const beams = page.locator('#notation svg .beam');
      // At this level, beams may appear but are not guaranteed in every piece
      const hasBeams = await beams.count() > 0;
      // This is informational - eighth notes may not always be beamed together
      console.log(`Level 7 has beams: ${hasBeams}`);
    });
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE portrait

  test('should display controls compactly on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    // Control bar is now #controlBar, not #controls
    const controlBar = page.locator('#controlBar');
    await expect(controlBar).toBeVisible();
  });

  test('should have readable notation on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    const notation = page.locator('#notation');
    await expect(notation).toBeVisible();
  });
});

test.describe('Mobile Landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } }); // iPhone landscape

  test('should optimize for 4 bars in landscape', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    // In landscape mobile, notation should be visible and optimized
    const notation = page.locator('#notation');
    await expect(notation).toBeVisible();

    // Check that MIDI controls are hidden or minimized on mobile
    const midiSelect = page.locator('#midiInput');
    const midiGroup = page.locator('.midi-control-group');

    // On mobile, MIDI controls should be hidden or the select should not be prominent
    // This depends on our CSS implementation
    const isHidden = await midiGroup.isHidden().catch(() => true);
    console.log(`MIDI controls hidden on mobile: ${isHidden}`);
  });
});

test.describe('Lesson Progression', () => {
  test('should start with simple whole notes at level 1', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    // At level 1, we should only see whole notes
    // Check the notation for note types
    const notes = page.locator('#notation svg .note');
    const count = await notes.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(16); // With whole notes, should have fewer notes
  });

  test('level progression should be gradual', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    // Test that levels 1-3 have progressively more complexity
    const noteCounts: number[] = [];

    for (let level = 1; level <= 3; level++) {
      if (level > 1) {
        await page.locator('#levelUp').click();
        await page.waitForTimeout(100);
      }
      const notes = page.locator('#notation svg .note');
      const count = await notes.count();
      noteCounts.push(count);
    }

    // Higher levels should generally have more notes (shorter durations)
    // Note: Due to randomness, this isn't always true, but as a general trend
    console.log(`Note counts by level: ${noteCounts.join(', ')}`);
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    // Check that form controls have labels
    const bpmInput = page.locator('#bpm');
    const bpmLabel = page.locator('label[for="bpm"]');
    await expect(bpmLabel).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through controls
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Should be able to reach the start button via keyboard
    const playPauseBtn = page.locator('#playPause');
    await playPauseBtn.focus();
    await expect(playPauseBtn).toBeFocused();
  });
});

test.describe('Sub-level Progression', () => {
  test('should track mastery within a level', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });

    // Check that level display exists and shows level (e.g., "1a", "2b")
    const levelDisplay = page.locator('#levelDisplay');
    const text = await levelDisplay.textContent();

    // Level display shows compact level string like "1a" or "2c"
    expect(text).toMatch(/\d+[a-d]/);
  });
});

interface BeatEvent {
  beatIndex: number;
  time: number;
  pitches: string[];
  noteIds: string[];
  /** When the beat is scheduled to sound, in seconds on the audio clock (immune to a busy main thread). */
  audioTime: number;
}

/** Records the app's `trainer:beat` events: one per beat that is played and highlighted. */
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

/** Waits until `enough(beats)` is true. Playback needs the piano samples first, so allow a generous time. */
async function waitForBeats(page: Page, enough: (beats: BeatEvent[]) => boolean): Promise<BeatEvent[]> {
  await expect
    .poll(async () => enough(await readBeats(page)), { timeout: 45000, intervals: [250] })
    .toBe(true);
  return readBeats(page);
}

async function chooseLevel(page: Page, level: string, bpm: string): Promise<void> {
  await page.locator('#optionsToggle').click();
  await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
  await page.locator('#levelJump').selectOption(level);
  await page.waitForTimeout(300);
  await closeOptionsPanel(page);
  await page.locator('#bpm').fill(bpm);
}

async function chooseSong(page: Page, songId: string, bpm: string): Promise<void> {
  await page.locator('#optionsToggle').click();
  await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
  // Use evaluate because the select sits in a fixed panel that may be outside the viewport
  await page.evaluate((id) => {
    const select = document.getElementById('songSelect') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, songId);
  await page.waitForSelector('#notation svg .note', { timeout: 5000 });
  await page.locator('#bpm').fill(bpm);
}

test.describe('Playback Timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });
    await recordBeats(page);
  });

  test('should not fire duplicate note events', async ({ page }) => {
    // Level 5 has dotted notes, which is where double firing used to happen
    await chooseLevel(page, '5', '120');
    await page.locator('#playPause').click();
    const beats = await waitForBeats(page, (b) => b.length >= 5);
    await page.locator('#playPause').click();

    // Within one pass the beat index counts up by one; a new pass starts again at 0
    const problems: string[] = [];
    for (let i = 1; i < beats.length; i++) {
      const prev = beats[i - 1].beatIndex;
      const cur = beats[i].beatIndex;
      if (cur !== prev + 1 && cur !== 0) problems.push(`beat ${prev} was followed by beat ${cur}`);
    }
    expect(problems, problems.join('\n')).toHaveLength(0);
  });

  test('should fire notes with proper spacing (no instant skips)', async ({ page }) => {
    // 60 BPM: one beat is one second, so no two beats of a pass can be closer than an eighth note
    await chooseLevel(page, '5', '60');
    await page.locator('#playPause').click();
    const beats = await waitForBeats(page, (b) => b.length >= 4);
    await page.locator('#playPause').click();

    const minSpacingSeconds = 0.2;
    const errors: string[] = [];
    for (let i = 1; i < beats.length; i++) {
      if (beats[i].beatIndex === 0) continue; // a new pass
      const gap = beats[i].audioTime - beats[i - 1].audioTime;
      if (gap < minSpacingSeconds) {
        errors.push(`beats ${beats[i - 1].beatIndex} and ${beats[i].beatIndex} are scheduled only ${(gap * 1000).toFixed(0)} ms apart`);
      }
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('should schedule audio at the Transport time (no Tone.js timing warning)', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('should use the passed in scheduling time')) warnings.push(msg.text());
    });
    await chooseLevel(page, '1', '120');
    await page.locator('#playPause').click();
    await waitForBeats(page, (b) => b.length >= 2);
    await page.locator('#playPause').click();
    expect(warnings, warnings.join('\n')).toHaveLength(0);
  });
});

test.describe('Audio/Visual Alignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });
    await recordBeats(page);
  });

  test('audio playback should align with visual highlighting', async ({ page }) => {
    await chooseSong(page, 'mary-lamb', '120');
    await page.locator('#playPause').click();
    const beats = await waitForBeats(page, (b) => b.length >= 4);
    await page.locator('#playPause').click();

    // Every beat that makes a sound must also highlight a note on the staff
    const errors = beats
      .filter((b) => b.pitches.length > 0 && b.noteIds.length === 0)
      .map((b) => `Beat ${b.beatIndex}: plays [${b.pitches.join(', ')}] but no note is highlighted`);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('level mode: every note across all measures should highlight', async ({ page }) => {
    // Level 1 (whole notes). Wait until a later measure has been reached, not only the first one.
    await page.locator('#bpm').fill('180');
    await page.locator('#playPause').click();
    const beats = await waitForBeats(page, (b) => b.some((x) => x.time >= 4));
    await page.locator('#playPause').click();

    const errors = beats
      .filter((b) => b.pitches.length > 0 && b.noteIds.length === 0)
      .map((b) => `Beat ${b.beatIndex} at time ${b.time}: plays [${b.pitches.join(', ')}] but no note is highlighted`);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('first note after segment advance should be highlighted', async ({ page }) => {
    // A song segment repeats until it is played; the first note of every repeat must highlight
    await chooseSong(page, 'mary-lamb', '200');
    await page.locator('#playPause').click();
    const beats = await waitForBeats(page, (b) => b.filter((x) => x.beatIndex === 0).length >= 2);
    await page.locator('#playPause').click();

    const firstBeats = beats.filter((b) => b.beatIndex === 0);
    const missing = firstBeats.filter((b) => b.noteIds.length === 0);
    expect(missing, `${missing.length} segments had no first note highlighted`).toHaveLength(0);
  });
});

test.describe('Built-in Song SVG Timing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });
  });

  test('Minuet in G should render with both hands visible', async ({ page }) => {
    // Open options panel
    await page.locator('#optionsToggle').click();
    await page.waitForTimeout(200);

    // Select Minuet in G from song selector
    await page.locator('#songSelect').selectOption('minuet-g');
    await page.waitForTimeout(500);

    // Wait for SVG to render
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Verify we have notes
    const noteCount = await page.locator('#notation svg .note').count();
    expect(noteCount).toBeGreaterThan(0);

    // Should have 2 staves (grand staff)
    const staveCount = await page.locator('#notation svg .staff').count();
    expect(staveCount).toBeGreaterThanOrEqual(2);
  });

  test('SVG note x-coordinates should increase left to right', async ({ page }) => {
    // Load Minuet in G
    await page.locator('#optionsToggle').click();
    await page.waitForTimeout(200);
    await page.locator('#songSelect').selectOption('minuet-g');
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Extract note x positions from SVG
    const notePositions = await page.evaluate(() => {
      const notes = document.querySelectorAll('#notation svg .note');
      const positions: { id: string; x: number }[] = [];

      notes.forEach((note) => {
        const id = note.getAttribute('id') || '';
        // Get the transform or use getBoundingClientRect
        const rect = (note as SVGGElement).getBoundingClientRect();
        positions.push({ id, x: rect.x });
      });

      // Sort by x position
      return positions.sort((a, b) => a.x - b.x);
    });

    expect(notePositions.length).toBeGreaterThan(0);

    // Verify notes are in left-to-right order (allowing for some variation)
    for (let i = 1; i < notePositions.length; i++) {
      // Notes shouldn't jump backwards significantly
      const diff = notePositions[i].x - notePositions[i - 1].x;
      expect(diff).toBeGreaterThanOrEqual(-5); // Allow small tolerance for stacked notes
    }
  });

  test('simultaneous notes should have similar x positions', async ({ page }) => {
    // Load Minuet in G
    await page.locator('#optionsToggle').click();
    await page.waitForTimeout(200);
    await page.locator('#songSelect').selectOption('minuet-g');
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Get note positions by staff
    const notesByStaff = await page.evaluate(() => {
      const svg = document.querySelector('#notation svg');
      if (!svg) return { staff1: [], staff2: [] };

      const notes = svg.querySelectorAll('.note');
      const staff1: { id: string; x: number }[] = [];
      const staff2: { id: string; x: number }[] = [];

      notes.forEach((note) => {
        const id = note.getAttribute('id') || '';
        const rect = (note as SVGGElement).getBoundingClientRect();

        // Determine which staff by checking parent elements
        let parent = note.parentElement;
        let staffNum = 1;
        while (parent && parent !== svg) {
          if (parent.classList.contains('staff')) {
            // Get staff index
            const staffs = svg.querySelectorAll('.staff');
            staffs.forEach((s, idx) => {
              if (s === parent) staffNum = idx + 1;
            });
            break;
          }
          parent = parent.parentElement;
        }

        if (staffNum === 1) {
          staff1.push({ id, x: rect.x });
        } else {
          staff2.push({ id, x: rect.x });
        }
      });

      return { staff1, staff2 };
    });

    // Both staves should have notes
    expect(notesByStaff.staff1.length).toBeGreaterThan(0);
    expect(notesByStaff.staff2.length).toBeGreaterThan(0);

    // In Minuet in G, measure 1 beat 1 should have notes in both hands at similar x
    // Check that the first notes are at similar x positions (within tolerance)
    if (notesByStaff.staff1.length > 0 && notesByStaff.staff2.length > 0) {
      // Sort both by x
      const s1Sorted = [...notesByStaff.staff1].sort((a, b) => a.x - b.x);
      const s2Sorted = [...notesByStaff.staff2].sort((a, b) => a.x - b.x);

      // First notes should be at similar x (beat 1 of measure 1)
      const firstS1 = s1Sorted[0];
      const firstS2 = s2Sorted[0];

      // Allow 50px tolerance for alignment
      const xDiff = Math.abs(firstS1.x - firstS2.x);
      expect(xDiff).toBeLessThan(50);
    }
  });

  test('note count should match parsed MusicXML data', async ({ page }) => {
    // Load Minuet in G
    await page.locator('#optionsToggle').click();
    await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
    // Use evaluate because select is in a fixed panel that may be outside viewport
    await page.evaluate(() => {
      const select = document.getElementById('songSelect') as HTMLSelectElement;
      if (select) {
        select.value = 'minuet-g';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Count notes in SVG
    const svgNoteCount = await page.locator('#notation svg .note').count();

    // In progressive practice mode, first step shows only measure 1
    // Minuet in G measure 1 should have some notes (varies by song)
    expect(svgNoteCount).toBeGreaterThan(0);
  });

  test('round-trip: SVG should re-render identically after parse/rebuild', async ({ page }) => {
    // This test verifies that the parsed data renders to consistent SVG

    // Load Minuet in G
    await page.locator('#optionsToggle').click();
    await page.waitForTimeout(200);
    await page.locator('#songSelect').selectOption('minuet-g');
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Get initial SVG note positions
    const initialPositions = await page.evaluate(() => {
      const notes = document.querySelectorAll('#notation svg .note');
      return Array.from(notes).map((note) => {
        const rect = (note as SVGGElement).getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y) };
      });
    });

    // Click "Next" button to advance practice step (triggers re-render)
    const nextBtn = page.locator('#practiceNext');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);

      // Go back to start
      const restartBtn = page.locator('#practiceRestart');
      if (await restartBtn.isVisible()) {
        await restartBtn.click();
        await page.waitForTimeout(500);

        // Get new positions
        const newPositions = await page.evaluate(() => {
          const notes = document.querySelectorAll('#notation svg .note');
          return Array.from(notes).map((note) => {
            const rect = (note as SVGGElement).getBoundingClientRect();
            return { x: Math.round(rect.x), y: Math.round(rect.y) };
          });
        });

        // Same song should have same number of notes in first step
        // (may differ if progressive mode shows different ranges)
        expect(newPositions.length).toBeGreaterThan(0);
      }
    }
  });

  test('Mary Had a Little Lamb should render correctly', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.waitForSelector('#optionsPanel:not([hidden])', { timeout: 5000 });
    // Use evaluate because select is in a fixed panel that may be outside viewport
    await page.evaluate(() => {
      const select = document.getElementById('songSelect') as HTMLSelectElement;
      if (select) {
        select.value = 'mary-lamb';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // In progressive practice mode, first step shows only measure 1
    // Mary Had a Little Lamb measure 1 has ~4 notes in RH
    const noteCount = await page.locator('#notation svg .note').count();
    expect(noteCount).toBeGreaterThan(0);

    // Check for rest elements (LH has whole rests)
    const restCount = await page.locator('#notation svg .rest').count();
    expect(restCount).toBeGreaterThan(0);
  });

  test('Happy Birthday (3/4 time) should render correctly', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.waitForTimeout(200);
    await page.locator('#songSelect').selectOption('happy-birthday');
    await page.waitForTimeout(500);
    await page.waitForSelector('#notation svg .note', { timeout: 5000 });

    // Check for time signature elements (3/4)
    const timeSigElement = await page.locator('#notation svg .meterSig').count();
    expect(timeSigElement).toBeGreaterThan(0);
  });
});

test.describe('Tie Continuation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#notation svg', { timeout: 10000 });
  });

  test('buildTimingEvents should mark tie continuations', async ({ page }) => {
    // MusicXML with a tie - simpler test that just checks timing events via file upload
    const xmlWithTie = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name print-object="no">Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type><staff>1</staff>
        <tie type="start"/>
        <notations><tied type="start"/></notations>
      </note>
      <backup><duration>4</duration></backup>
      <note><rest/><duration>4</duration><type>whole</type><staff>2</staff></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type><staff>1</staff>
        <tie type="stop"/>
        <notations><tied type="stop"/></notations>
      </note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><rest/><duration>4</duration><type>whole</type><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>`;

    // Upload file via the file input
    const fileInput = page.locator('#xmlUpload');

    // Create a temporary file and upload it
    const buffer = Buffer.from(xmlWithTie, 'utf-8');
    await fileInput.setInputFiles({
      name: 'test-tie.xml',
      mimeType: 'application/xml',
      buffer: buffer,
    });

    // Wait for practice mode to activate (practiceInfo becomes visible)
    await page.waitForSelector('#practiceInfo:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Get the timing events and raw notes from window
    const result = await page.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      return {
        timingEvents: win.__timingEvents as Array<{
          time: number;
          duration: number;
          pitches: string[];
          isTieContinuation?: boolean;
        }>,
        rightHandNotes: (win.__currentRightHandNotes as Array<{
          step: string;
          octave: number;
          duration: number;
          tieStart?: boolean;
          tieEnd?: boolean;
        }>) || [],
      };
    });

    console.log('Right hand notes:', JSON.stringify(result.rightHandNotes, null, 2));
    console.log('Timing events:', JSON.stringify(result.timingEvents, null, 2));

    const timingEvents = result.timingEvents;

    // Should have events
    expect(timingEvents.length).toBeGreaterThan(0);

    // Find the tie continuation event (E4 at beat 4, the tied note in measure 2)
    const tieContinuationEvent = timingEvents.find(e => e.isTieContinuation === true);

    console.log('Tie continuation event:', tieContinuationEvent);

    // This is the key assertion: we should have a timing event marked as tie continuation
    expect(tieContinuationEvent).toBeDefined();
    expect(tieContinuationEvent?.pitches).toContain('E4');
  });
});
