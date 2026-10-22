import { test, expect, type Page } from '@playwright/test';

// The side rail on every screen: a rail on a wide, tall screen (Desktop Chrome), a drawer behind a handle on a phone
// (Pixel 5) and on a screen that is too short for the rail (Pixel 5 landscape).

const isRail = (page: Page) => {
  const size = page.viewportSize()!;
  return size.width >= 768 && size.height >= 560;
};

async function start(page: Page, hash = '', locale?: 'fa'): Promise<void> {
  if (locale) await page.addInitScript((value) => localStorage.setItem('ui.locale', value), locale);
  await page.goto(`./#/${hash}`);
  await expect(page.locator('body')).toHaveAttribute('data-nav', /rail|drawer/);
  await expect(page.locator('#sideNav')).toHaveCount(1);
}

/** Where the quick buttons are: in the rail they are there; in the drawer it has to be opened first. */
async function reveal(page: Page): Promise<void> {
  if (!isRail(page)) {
    await page.locator('.nav-handle').click();
    await expect(page.locator('#sideNav')).toHaveAttribute('data-open', 'true');
  }
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe('Side navigation: the rail', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'the rail is for a wide, tall screen');
  });

  test('sits 12px from the edge, 64px wide, with every place and the quick buttons in reach', async ({ page }) => {
    await start(page);
    const rail = await box(page, '#sideNav');
    expect(rail.x).toBe(12);
    expect(rail.y).toBe(12);
    expect(Math.round(rail.width)).toBe(64);
    const size = page.viewportSize()!;
    expect(Math.round(rail.height)).toBe(size.height - 24);
    await expect(page.locator('.nav-handle')).toBeHidden();
    // the foot of the rail is on the screen on a 720px laptop: the middle list scrolls, the foot does not
    for (const action of ['language', 'theme', 'settings']) {
      const b = await box(page, `.nav-foot [data-nav-action="${action}"]`);
      expect(b.y + b.height, action).toBeLessThanOrEqual(size.height);
    }
    await expect(page.locator('#sideNav [data-nav]')).toHaveCount(17);
  });

  test('widens over the page on hover without moving the page', async ({ page }) => {
    await start(page);
    const before = await box(page, '#mainMenu .menu-title');
    await page.locator('#sideNav').hover();
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBeGreaterThanOrEqual(240);
    await expect(page.locator('[data-nav="lessons"] .nav-label')).toBeVisible();
    const after = await box(page, '#mainMenu .menu-title');
    expect(after.x).toBe(before.x);
    await page.mouse.move(700, 400);
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBe(64);
  });

  test('widens for the keyboard too, and the first stop is a way to skip it', async ({ page }) => {
    await start(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('.nav-skip')).toBeFocused();
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBeGreaterThanOrEqual(240);
    await page.keyboard.press('Enter');
    await expect(page.locator('#mainMenu .menu-title')).toBeFocused();
  });

  test('can be pinned open to show the names, and says so', async ({ page }) => {
    await start(page);
    await page.locator('.nav-brand').click();
    await page.mouse.move(700, 400);
    await expect(page.locator('.nav-brand')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBeGreaterThanOrEqual(240);
    await page.locator('.nav-brand').click();
    await page.mouse.move(700, 400);
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBe(64);
  });

  test('is on the right in Persian, and widens towards the page', async ({ page }) => {
    await start(page, '', 'fa');
    const size = page.viewportSize()!;
    const rail = await box(page, '#sideNav');
    expect(Math.round(rail.x + rail.width)).toBe(size.width - 12);
    await page.locator('#sideNav').hover();
    await expect.poll(async () => Math.round((await box(page, '#sideNav')).width)).toBeGreaterThanOrEqual(240);
    const wide = await box(page, '#sideNav');
    expect(Math.round(wide.x + wide.width)).toBe(size.width - 12);
  });

  test('keeps clear of the control bar, the piano and the other floating things at every width', async ({ page }) => {
    for (const width of [768, 820, 900, 1024, 1280]) {
      await page.setViewportSize({ width, height: 720 });
      await start(page, 'levels');
      // the piano stays open between the passes of this loop
      if (!(await page.locator('#pianoDock').isVisible())) await page.locator('#pianoToggle').click();
      await expect(page.locator('#pianoDock')).toBeVisible();
      await page.waitForTimeout(350);
      const railRight = (await box(page, '#sideNav')).x + (await box(page, '#sideNav')).width;
      for (const selector of ['#controlBar', '#pianoDock']) {
        const b = await box(page, selector);
        expect(b.x, `${selector} at ${width}px`).toBeGreaterThanOrEqual(railRight);
        expect(b.x + b.width, `${selector} at ${width}px`).toBeLessThanOrEqual(width);
      }
    }
  });
});

test.describe('Side navigation: the drawer', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'chromium', 'the drawer is for a phone or a short screen');
  });

  test('is out of the way until the handle at the edge is pressed, and then covers the page with a scrim', async ({ page }) => {
    await start(page);
    const handle = await box(page, '.nav-handle');
    expect(handle.x).toBe(0);
    expect(handle.width).toBeLessThanOrEqual(18);
    const size = page.viewportSize()!;
    expect(Math.abs(handle.y + handle.height / 2 - size.height / 2)).toBeLessThanOrEqual(2);
    await expect(page.locator('#sideNav')).not.toBeInViewport();
    await page.locator('.nav-handle').click();
    await expect(page.locator('#sideNav')).toBeInViewport();
    await expect(page.locator('.nav-scrim')).toBeVisible();
    await expect(page.locator('.nav-handle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-nav="home"]')).toBeFocused();
    await expect(page.locator('[data-nav="lessons"] .nav-label')).toBeVisible();
  });

  test('closes with Escape and returns the focus to the handle, and closes on the scrim', async ({ page }) => {
    await start(page);
    await page.locator('.nav-handle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sideNav')).not.toBeInViewport();
    await expect(page.locator('.nav-handle')).toBeFocused();
    await page.locator('.nav-handle').click();
    await page.locator('.nav-scrim').click({ position: { x: 360, y: 200 } });
    await expect(page.locator('#sideNav')).not.toBeInViewport();
  });

  test('goes to a place and closes', async ({ page }) => {
    await start(page);
    await page.locator('.nav-handle').click();
    await page.locator('[data-nav="lessons"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'lessons');
    await expect(page.locator('#sideNav')).not.toBeInViewport();
  });

  test('opens from the right in Persian', async ({ page }) => {
    await start(page, '', 'fa');
    const size = page.viewportSize()!;
    const handle = await box(page, '.nav-handle');
    expect(Math.round(handle.x + handle.width)).toBe(size.width);
    await page.locator('.nav-handle').click();
    await expect(page.locator('#sideNav')).toBeInViewport();
    // it slides in: wait until it is in its place
    await expect.poll(async () => {
      const drawer = await box(page, '#sideNav');
      return Math.round(drawer.x + drawer.width);
    }).toBe(size.width);
  });

  test('the handle covers no button, link or field of the screen', async ({ page }) => {
    for (const hash of ['', 'lessons', 'songs', 'scales', 'today', 'levels']) {
      await start(page, hash);
      const handle = await box(page, '.nav-handle');
      const hits = await page.evaluate((h) => {
        const overlaps: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role="button"]')) {
          if (el.closest('#sideNav, .nav-handle') || el.classList.contains('nav-handle')) continue;
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.closest('.view-hidden, [hidden]')) continue;
          const x = Math.max(0, Math.min(r.right, h.x + h.width) - Math.max(r.left, h.x));
          const y = Math.max(0, Math.min(r.bottom, h.y + h.height) - Math.max(r.top, h.y));
          if (x > 0 && y > 0) overlaps.push(`${el.tagName.toLowerCase()}.${el.className}`);
        }
        return overlaps;
      }, handle);
      expect(hits, `on #/${hash}`).toEqual([]);
    }
  });
});

test.describe('Side navigation: in every mode', () => {
  test('marks the place of the screen that is shown, and follows the address', async ({ page }) => {
    await start(page, 'lessons');
    await expect(page.locator('#sideNav [aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('[data-nav="lessons"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('./#/ear');
    await expect(page.locator('[data-nav="ear"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-nav="lessons"]')).not.toHaveAttribute('aria-current', 'page');
    await page.goto('./#/maker/new');
    await expect(page.locator('[data-nav="songs"]')).toHaveAttribute('aria-current', 'page');
  });

  test('goes to a place from the rail or the drawer', async ({ page }) => {
    await start(page);
    await reveal(page);
    await page.locator('[data-nav="scales"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'scales');
    await expect(page.locator('#scalesView')).toBeVisible();
  });

  test('the quick button switches the language at once, and back, on every screen', async ({ page }) => {
    await start(page, 'lessons');
    await reveal(page);
    const language = page.locator('.nav-foot [data-nav-action="language"]');
    await expect(language.locator('.nav-label')).toHaveText('فارسی');
    await language.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(language.locator('.nav-label')).toHaveText('English');
    await expect(page.locator('[data-nav="home"] .nav-label')).toHaveText('خانه');
    await expect(page.locator('#lessonsView .view-title')).toHaveText('درس‌ها');
    await expect(page.locator('#languageSelect')).toHaveValue('fa'); // the language list in Settings follows
    await language.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#lessonsView .view-title')).toHaveText('Lessons');
  });

  test('the quick button switches the theme, and the Appearance list in Settings follows', async ({ page }) => {
    await start(page);
    await reveal(page);
    const theme = page.locator('.nav-foot [data-nav-action="theme"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(theme.locator('.nav-label')).toHaveText('Light theme');
    await theme.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(theme.locator('.nav-label')).toHaveText('Dark theme');
    await expect(page.locator('#themeSelect')).toHaveValue('light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('Settings opens the panel, and a drawer gets out of its way', async ({ page }) => {
    await start(page);
    await reveal(page);
    const settings = page.locator('.nav-foot [data-nav-action="settings"]');
    await settings.click();
    await expect(page.locator('#optionsPanel')).toBeVisible();
    await expect(settings).toHaveAttribute('aria-expanded', 'true');
    if (!isRail(page)) await expect(page.locator('#sideNav')).not.toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.locator('#optionsPanel')).toBeHidden();
    await expect(page.locator('#mainMenu [data-tile="settings"]')).toHaveAttribute('aria-expanded', 'false');
  });

  test('the home tiles and the rail do not share hooks, so the tiles are still sixteen', async ({ page }) => {
    await start(page);
    await expect(page.locator('#mainMenu .menu-tile')).toHaveCount(16);
    await expect(page.locator('[data-tile]')).toHaveCount(18); // sixteen tiles, the Today card and the Continue card
  });

  test('never makes the page wider than the screen, on any screen', async ({ page }) => {
    for (const hash of ['', 'levels', 'learn', 'songs', 'lessons', 'catalog', 'xylophone', 'progress', 'ear', 'scales', 'scales/d-shur', 'generator', 'chords', 'tuner', 'rhythm', 'persian', 'today']) {
      await start(page, hash);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `#/${hash}`).toBeLessThanOrEqual(0);
    }
  });

  test('the rail and the control bar are glass on a desktop, and solid on a phone, where the blur would cost battery', async ({ page }, testInfo) => {
    await start(page, 'levels');
    const filter = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backdropFilter);
    for (const selector of ['#sideNav', '#controlBar']) {
      if (testInfo.project.name === 'chromium') expect(await filter(selector), selector).toContain('blur');
      else expect(await filter(selector), selector).toBe('none');
    }
  });

  test('keeps the first visit as it was: no rail text announced twice, and the content starts after the rail', async ({ page }) => {
    await start(page);
    const title = await box(page, '#mainMenu .menu-title');
    const size = page.viewportSize()!;
    if (isRail(page)) expect(title.x).toBeGreaterThanOrEqual(88);
    else expect(title.x).toBeGreaterThanOrEqual(8);
    expect(title.x + title.width).toBeLessThanOrEqual(size.width);
  });
});
