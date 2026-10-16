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

const rows = (page: Page) => page.locator('#catalogView .catalog-row');

async function openLibrary(page: Page, hash = '#/catalog'): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.locator('#catalogView')).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

test.describe('Song library', () => {
  test('the menu tile opens it, and Back returns to the menu', async ({ page }) => {
    await openMenu(page);
    await page.locator('#mainMenu [data-tile="catalog"]').click();
    await expect(page).toHaveURL(/#\/catalog$/);
    await expect(page.locator('#catalogView h2')).toHaveText('Song library');
    await expect(rows(page).first()).toBeVisible();
    await page.locator('#catalogView .back-btn').click();
    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#catalogView')).toBeHidden();
  });

  test('has thousands of songs from hundreds of artists', async ({ page }) => {
    await openLibrary(page);
    const subtitle = await page.locator('#catalogView .view-subtitle').textContent();
    const [songs, artists] = [...subtitle!.matchAll(/([\d,]+) (?:songs|artists)/g)].map((m) => Number(m[1].replace(/,/g, '')));
    expect(songs).toBeGreaterThan(1000);
    expect(artists).toBeGreaterThan(150);
    const options = await page.locator('#catalogArtists option').count();
    expect(options).toBeGreaterThan(150);
  });

  test('shows a page of songs and loads more', async ({ page }) => {
    await openLibrary(page);
    await expect(rows(page)).toHaveCount(60);
    await expect(page.locator('.catalog-showing')).toContainText('Showing 60 of');
    await page.locator('.catalog-more').click();
    await expect(rows(page)).toHaveCount(120);
  });

  test('searches by title and by artist as you type', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#catalogSearch').fill('bohemian');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Bohemian Rhapsody');
    await page.locator('#catalogSearch').fill('beethoven');
    expect(await rows(page).count()).toBeGreaterThan(10);
    await expect(page).toHaveURL(/#\/catalog\?q=beethoven$/);
  });

  test('filters by artist, and the artist name of a row does the same', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#catalogArtist').fill('Queen');
    await expect(rows(page).first().locator('.catalog-artist')).toHaveText('Queen');
    const count = await rows(page).count();
    expect(count).toBeGreaterThan(15);
    for (const artist of await rows(page).locator('.catalog-artist').allTextContents()) expect(artist).toBe('Queen');

    await page.locator('#catalogArtist').fill('');
    await page.locator('#catalogSearch').fill('imagine');
    await rows(page).first().locator('.catalog-artist').click();
    await expect(page.locator('#catalogArtist')).not.toHaveValue('');
  });

  test('filters by level and by kind of music', async ({ page }) => {
    await openLibrary(page);
    await page.locator('.chip[data-level="1"]').click();
    await expect(page.locator('.chip[data-level="1"]')).toHaveAttribute('aria-pressed', 'true');
    for (const level of await rows(page).locator('.catalog-level').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.level))) {
      expect(level).toBe('1');
    }
    await page.locator('.chip[data-cat="classical"]').click();
    expect(await rows(page).count()).toBeGreaterThan(5);
    for (const kind of await rows(page).locator('.catalog-kind').allTextContents()) expect(kind).toBe('Classical and traditional');
    await expect(page).toHaveURL(/#\/catalog\?level=1&cat=classical$/);
  });

  test('sorts the easiest songs first', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#catalogSort').selectOption('easiest');
    const levels = await rows(page).locator('.catalog-level').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.level)));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
  });

  test('a filter in the address is applied, can be shared and survives a reload', async ({ page }) => {
    await openLibrary(page, '#/catalog?artist=Queen&level=4&sort=title');
    await expect(page.locator('#catalogArtist')).toHaveValue('Queen');
    await expect(page.locator('.chip[data-level="4"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#catalogSort')).toHaveValue('title');
    const first = await rows(page).count();
    expect(first).toBeGreaterThan(0);
    await page.reload();
    await expect(rows(page)).toHaveCount(first);
  });

  test('changing the filter does not add steps to the Back button', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('#mainMenu [data-tile="catalog"]').click();
    await expect(rows(page).first()).toBeVisible();
    await page.locator('#catalogSearch').fill('a');
    await page.locator('#catalogSearch').fill('ab');
    await page.locator('.chip[data-level="2"]').click();
    await page.goBack();
    await expect(page.locator('#mainMenu')).toBeVisible();
  });

  test('says so when nothing matches, and Clear filters brings the songs back', async ({ page }) => {
    await openLibrary(page);
    await page.locator('#catalogSearch').fill('qqqqqqqq');
    await expect(page.locator('.catalog-empty')).toContainText('No song matches');
    await page.locator('.catalog-empty .catalog-clear').click();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.locator('#catalogSearch')).toHaveValue('');
  });

  test('plays a built-in song in the app', async ({ page }) => {
    await openLibrary(page, '#/catalog?q=ode+to+joy');
    const row = page.locator('.catalog-row', { hasText: 'Beethoven' }).filter({ has: page.locator('.catalog-play') }).first();
    await expect(row.locator('.catalog-inapp')).toHaveText('In the app');
    await row.locator('.catalog-play').click();
    await expect(page).toHaveURL(/#\/practice$/);
    await expect(page.locator('.pp-song')).toBeVisible();
  });

  test('links to sheet music and a place to listen, opening in a new tab', async ({ page }) => {
    await openLibrary(page, '#/catalog?q=let+it+be');
    const row = rows(page).first();
    const sheet = row.locator('.catalog-sheet');
    await expect(sheet).toHaveAttribute('href', /^https:\/\/musescore\.com\/sheetmusic\?text=/);
    await expect(sheet).toHaveAttribute('target', '_blank');
    await expect(sheet).toHaveAttribute('rel', /noopener/);
    await expect(row.locator('.catalog-listen')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/results\?search_query=/);

    await openLibrary(page, '#/catalog?cat=classical&q=fur+elise');
    await expect(rows(page).first().locator('.catalog-sheet')).toHaveAttribute('href', /^https:\/\/imslp\.org\//);
  });

  test('"Practise from my file" opens the file picker', async ({ page }) => {
    await openLibrary(page);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.catalog-own').click();
    const picker = await chooser;
    expect(picker.isMultiple()).toBe(false);
  });

  test('does not scroll sideways', async ({ page }) => {
    await openLibrary(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Song library in Persian', () => {
  test('is right-to-left with Persian labels, and finds Persian songs by their Persian names', async ({ page }) => {
    await openMenu(page, 'fa');
    await page.locator('#mainMenu [data-tile="catalog"]').click();
    await expect(page.locator('#catalogView h2')).toHaveText('کتابخانه‌ی آهنگ‌ها');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(rows(page).first()).toBeVisible();
    await page.locator('.chip[data-cat="persian"]').click();
    await expect(page.locator('.catalog-count')).toContainText('آهنگ');
    await page.locator('#catalogSearch').fill('گوگوش');
    expect(await rows(page).count()).toBeGreaterThan(5);
    await expect(rows(page).first().locator('.catalog-artist')).toHaveText('گوگوش');
    await page.locator('#catalogSearch').fill('پل');
    await expect(rows(page).first()).toContainText('پل');
  });

  test('keeps the level bars left to right', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await openLibrary(page);
    await expect(page.locator('.catalog-row .pips').first()).toHaveCSS('direction', 'ltr');
  });
});
