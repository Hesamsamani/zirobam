import { test, expect, type Page } from '@playwright/test';

async function openMenu(page: Page, locale?: 'fa'): Promise<void> {
  if (locale) {
    await page.addInitScript((value) => {
      if (!localStorage.getItem('ui.locale')) localStorage.setItem('ui.locale', value);
    }, locale);
  }
  await page.goto('/');
  await expect(page.locator('#mainMenu')).toBeVisible();
}

const tile = (page: Page, id: string) => page.locator(`#mainMenu [data-tile="${id}"]`);

test.describe('Main menu', () => {
  test('is the first screen and hides the exercise', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('#mainMenu h1')).toHaveText('Music Notes Trainer');
    await expect(page.locator('#mainMenu .menu-tile')).toHaveCount(6);
    await expect(page.locator('#musicStand')).toBeHidden();
    await expect(page.locator('#controlBar')).toBeHidden();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'home');
  });

  test('does not scroll sideways', async ({ page }) => {
    await openMenu(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the levels tile opens the exercise at the right size, and Home comes back', async ({ page }, testInfo) => {
    await openMenu(page);
    await tile(page, 'levels').click();
    await expect(page).toHaveURL(/#\/levels$/);
    await expect(page.locator('#controlBar')).toBeVisible();
    await expect(page.locator('#notation svg').first()).toBeVisible();
    await expect(page.locator('#mainMenu')).toBeHidden();
    if (testInfo.project.name === 'chromium') {
      // the score is drawn after the screen is visible, so it uses the real width
      const width = await page.locator('#notation svg').first().evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeGreaterThan(900);
    }
    await page.locator('#homeButton').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#controlBar')).toBeHidden();
    await expect(page).toHaveURL(/#\/$/);
  });

  test('the browser Back button returns to the menu', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'levels').click();
    await expect(page.locator('#controlBar')).toBeVisible();
    await page.goBack();
    await expect(page.locator('#mainMenu')).toBeVisible();
  });

  test('the Continue card says where you left off and opens it', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('.menu-resume-title')).toHaveText('Level 1a');
    await expect(page.locator('.menu-resume-detail')).not.toBeEmpty();
    await page.locator('.menu-resume').click();
    await expect(page).toHaveURL(/#\/levels$/);
    await expect(page.locator('#controlBar')).toBeVisible();
  });

  test('after starting a song, Continue opens that song at its step', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'songs').click();
    await page.locator('#songsView [data-song="frere-jacques"]').click();
    await page.locator('.pp-measure[data-measure="3"]').click();
    await page.locator('#homeButton').click();
    await expect(page.locator('.menu-resume-title')).toHaveText('Frère Jacques');
    await expect(page.locator('.menu-resume-detail')).toContainText('Measure 3');
    await page.locator('.menu-resume').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-where')).toHaveText('Measure 3');
  });

  test('the levels tile shows the current level', async ({ page }) => {
    await openMenu(page);
    await expect(tile(page, 'levels')).toContainText('1a');
  });

  test('the learn tile opens the lessons, and Close goes back to the menu', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'learn').click();
    await expect(page.locator('#learnView')).toBeVisible();
    await expect(page).toHaveURL(/#\/learn$/);
    await page.locator('#learnView .learn-header .learn-text-btn').last().click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#learnView')).toBeHidden();
  });

  test('the book button in the exercise opens Learn, and Close returns to the exercise', async ({ page }) => {
    await page.goto('/#/levels');
    await page.waitForSelector('#notation svg');
    await page.locator('#learnToggle').click();
    await expect(page.locator('#learnView')).toBeVisible();
    await page.locator('#learnView .learn-header .learn-text-btn').last().click();
    await expect(page).toHaveURL(/#\/levels$/);
    await expect(page.locator('#learnView')).toBeHidden();
    await expect(page.locator('#notation svg').first()).toBeVisible();
  });

  test('the settings tile opens the options panel and keeps it open', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'settings').click();
    await expect(page.locator('#optionsPanel')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('#optionsPanel')).toBeVisible();
    await page.selectOption('#languageSelect', 'fa');
    await expect(page.locator('#mainMenu h1')).toHaveText('مربی نت‌خوانی');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('Songs', () => {
  test('lists the built-in songs and starts one in practice mode', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'songs').click();
    await expect(page.locator('#songsView')).toBeVisible();
    expect(await page.locator('#songsView .song-card').count()).toBeGreaterThanOrEqual(23);
    await expect(page.locator('#songsView .song-group-title')).toHaveText(['Beginner', 'Easy', 'Intermediate', 'Exercises']);

    await page.locator('#songsView [data-song="twinkle"]').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('#practiceInfo')).toBeVisible();
    await expect(page.locator('.score-title h1')).toContainText('Twinkle');
    await expect(page.locator('#notation svg .note').first()).toBeVisible();
    await expect(page.locator('#songsView')).toBeHidden();
  });

  test('returning to levels from practice mode follows the address', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'songs').click();
    await page.locator('#songsView [data-song="mary-lamb"]').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await page.locator('#optionsToggle').click();
    await page.locator('#exitPracticeMode').click();
    await expect(page).toHaveURL(/#\/levels$/);
    await expect(page.locator('#practiceInfo')).toBeHidden();
  });

  test('the levels tile leaves practice mode', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'songs').click();
    await page.locator('#songsView [data-song="mary-lamb"]').click();
    await page.locator('#homeButton').click();
    await tile(page, 'levels').click();
    await expect(page).toHaveURL(/#\/levels$/);
    await expect(page.locator('#practiceInfo')).toBeHidden();
    await expect(page.locator('#levelDisplay')).toBeVisible();
  });

  test('the options list offers the same songs in groups', async ({ page }) => {
    await page.goto('/#/levels');
    await page.waitForSelector('#notation svg');
    await page.locator('#optionsToggle').click();
    expect(await page.locator('#songSelect option').count()).toBeGreaterThanOrEqual(24);
    await expect(page.locator('#songSelect optgroup')).toHaveCount(4);
    await page.locator('#songSelect').selectOption('frere-jacques');
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.score-title h1')).toHaveText('Frère Jacques');
  });

  test('the address #/practice without a song leads to the song list', async ({ page }) => {
    await page.goto('/#/practice');
    await expect(page.locator('#songsView')).toBeVisible();
    await expect(page).toHaveURL(/#\/songs$/);
  });

  test('the back button returns to the menu', async ({ page }) => {
    await openMenu(page);
    await tile(page, 'songs').click();
    await page.locator('#songsView .back-btn').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
  });
});

test.describe('Screens and playback', () => {
  test('leaving the exercise stops it', async ({ page }) => {
    await page.goto('/#/levels');
    await page.waitForSelector('#notation svg');
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).toHaveClass(/playing/, { timeout: 30000 });
    await page.locator('#homeButton').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
  });

  test('Space does nothing on the menu', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    await expect(page.locator('#playPause')).not.toHaveClass(/playing/);
    await expect(page.locator('#playPause')).not.toHaveAttribute('aria-busy', 'true');
  });

  test('computer keys play the piano on the exercise screen but stay silent on the menu', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.down('a');
    await expect(page.locator('.piano-key.pressed')).toHaveCount(0);
    await page.keyboard.up('a');

    // the same key does light the piano once the exercise screen is open (so the check above can fail)
    await tile(page, 'levels').click();
    await page.keyboard.down('a');
    await expect(page.locator('.piano-key[data-note="C4"]')).toHaveClass(/pressed/);
    await page.keyboard.up('a');

    // and it is silent again after going home
    await page.locator('#homeButton').click();
    await page.keyboard.down('a');
    await expect(page.locator('.piano-key.pressed')).toHaveCount(0);
    await page.keyboard.up('a');
  });
});

test.describe('Main menu in Persian', () => {
  test('is right-to-left with Persian titles and digits', async ({ page }) => {
    await openMenu(page, 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#mainMenu h1')).toHaveText('مربی نت‌خوانی');
    await expect(tile(page, 'learn')).toContainText('یادگیری نت‌ها');
    await expect(tile(page, 'songs')).toContainText('آهنگ‌ها');
    await expect(tile(page, 'settings')).toContainText('تنظیمات');
    await expect(tile(page, 'levels')).toContainText('۱a');
  });

  test('the song list is in Persian too', async ({ page }) => {
    await openMenu(page, 'fa');
    await tile(page, 'songs').click();
    await expect(page.locator('#songsView h2')).toHaveText('آهنگ‌ها');
    await expect(page.locator('#songsView h3').first()).toHaveText('مبتدی');
    await expect(page.locator('#songsView .back-btn')).toContainText('بازگشت به منو');
  });

  test('the notation keeps its left-to-right direction', async ({ page }) => {
    await openMenu(page, 'fa');
    await tile(page, 'levels').click();
    await expect(page.locator('#notation svg').first()).toBeVisible();
    expect(await page.locator('#notation').evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  });
});
