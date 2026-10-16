import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogView, type CatalogViewDeps } from '../catalog/catalogView';
import type { CatalogSong } from '../catalog/types';
import { setLocale } from '../i18n';

const song = (over: Partial<CatalogSong> & Pick<CatalogSong, 'title' | 'artist'>): CatalogSong => ({
  id: `${over.artist}-${over.title}`.toLowerCase().replace(/\W+/g, '-'),
  level: 2,
  category: 'pop',
  ...over,
});

const SONGS: CatalogSong[] = [
  song({ title: 'Let It Be', artist: 'The Beatles', year: 1970, level: 2 }),
  song({ title: 'Hey Jude', artist: 'The Beatles', year: 1968, level: 2 }),
  song({ title: 'Imagine', artist: 'John Lennon', year: 1971, level: 1 }),
  song({ title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, level: 4 }),
  song({ title: 'Pol', titleFa: 'پل', artist: 'Googoosh', artistFa: 'گوگوش', level: 3, category: 'persian' }),
  song({ title: 'Für Elise', artist: 'Ludwig van Beethoven', artistFa: 'بتهوون', year: 1810, level: 3, category: 'classical' }),
  song({ title: 'Ode to Joy', artist: 'Ludwig van Beethoven', year: 1824, level: 1, category: 'classical', builtIn: 'ode-to-joy' }),
  song({ title: 'Nuvole Bianche', artist: 'Ludovico Einaudi', year: 2004, level: 3, category: 'modern' }),
];

function setup(overrides: Partial<CatalogViewDeps> = {}, query = '') {
  const deps: CatalogViewDeps = {
    load: vi.fn(async () => SONGS),
    getQuery: vi.fn(() => query),
    setQuery: vi.fn(),
    onBack: vi.fn(),
    playBuiltIn: vi.fn(),
    chooseFile: vi.fn(),
    pageSize: 50,
    ...overrides,
  };
  const view = new CatalogView(deps);
  document.body.appendChild(view.element);
  return { view, deps };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const titles = (view: CatalogView) => Array.from(view.element.querySelectorAll('.catalog-title')).map((el) => el.textContent);
const q = <T extends Element>(view: CatalogView, selector: string) => view.element.querySelector(selector) as T;

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CatalogView', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    setLocale('en');
  });

  it('belongs to the library screen and has a back button, a title and a subtitle', async () => {
    const { view, deps } = setup();
    await view.activate();
    expect(view.element.id).toBe('catalogView');
    expect(view.element.dataset.views).toBe('catalog');
    expect(q(view, 'h2').textContent).toBe('Song library');
    q<HTMLButtonElement>(view, '.back-btn').click();
    expect(deps.onBack).toHaveBeenCalledOnce();
    expect(q(view, '.view-subtitle').textContent).toContain('8 songs by 6 artists');
  });

  it('says it is loading, then shows the songs', async () => {
    let finish: (songs: CatalogSong[]) => void = () => {};
    const { view } = setup({ load: () => new Promise((resolve) => (finish = resolve)) });
    const pending = view.activate();
    expect(q(view, '.catalog-loading')).not.toBeNull();
    expect(q(view, '.catalog-list').getAttribute('aria-busy')).toBe('true');
    finish(SONGS);
    await pending;
    expect(q(view, '.catalog-loading')).toBeNull();
    expect(titles(view)).toHaveLength(SONGS.length);
  });

  it('shows a message and a Try again button when the library cannot be loaded', async () => {
    const load = vi.fn<() => Promise<CatalogSong[]>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(SONGS);
    const { view } = setup({ load });
    await view.activate();
    expect(q(view, '.catalog-error').textContent).toContain('could not be loaded');
    q<HTMLButtonElement>(view, '.catalog-retry').click();
    await flush();
    expect(q(view, '.catalog-error')).toBeNull();
    expect(titles(view)).toHaveLength(SONGS.length);
  });

  it('lists the songs by artist at first, with the artist, year and level of each', async () => {
    const { view } = setup();
    await view.activate();
    expect(titles(view)[0]).toBe('Pol'); // Googoosh sorts first
    const row = q<HTMLElement>(view, '[data-song$="let-it-be"]');
    expect(row.querySelector('.catalog-artist')!.textContent).toBe('The Beatles');
    expect(row.textContent).toContain('1970');
    expect(row.querySelector('.catalog-level')!.getAttribute('data-level')).toBe('2');
    expect(row.querySelector('.level-name')!.textContent).toBe('Easy');
    expect(row.querySelectorAll('.pips i.on')).toHaveLength(2);
    expect(row.querySelectorAll('.pips i')).toHaveLength(4);
  });

  it('tells how many songs there are, and speaks it politely', async () => {
    const { view } = setup();
    await view.activate();
    const status = q(view, '.catalog-count');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('8 songs');
    type(q(view, '#catalogSearch'), 'imagine');
    expect(status.textContent).toBe('1 song');
  });

  it('searches as you type, in the title or the artist, and keeps the address up to date', async () => {
    const { view, deps } = setup();
    await view.activate();
    type(q(view, '#catalogSearch'), 'beatles');
    expect(titles(view).sort()).toEqual(['Hey Jude', 'Let It Be']);
    expect(deps.setQuery).toHaveBeenLastCalledWith('q=beatles');
    type(q(view, '#catalogSearch'), '');
    expect(deps.setQuery).toHaveBeenLastCalledWith('');
  });

  it('finds Persian titles and artists', async () => {
    const { view } = setup();
    await view.activate();
    type(q(view, '#catalogSearch'), 'گوگوش');
    expect(titles(view)).toEqual(['Pol']);
    type(q(view, '#catalogSearch'), 'پل');
    expect(titles(view)).toEqual(['Pol']);
  });

  it('filters by artist with the artist box, which suggests the artists', async () => {
    const { view, deps } = setup();
    await view.activate();
    const options = Array.from(view.element.querySelectorAll('#catalogArtists option')).map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain('Queen');
    expect(options).toContain('Ludwig van Beethoven');
    expect(options).toHaveLength(6);
    type(q(view, '#catalogArtist'), 'queen');
    expect(titles(view)).toEqual(['Bohemian Rhapsody']);
    expect(deps.setQuery).toHaveBeenLastCalledWith('artist=queen');
  });

  it('filters by the artist of a row when its name is pressed', async () => {
    const { view } = setup();
    await view.activate();
    q<HTMLButtonElement>(view, '[data-song$="let-it-be"] .catalog-artist').click();
    expect(titles(view).sort()).toEqual(['Hey Jude', 'Let It Be']);
    expect(q<HTMLInputElement>(view, '#catalogArtist').value).toBe('The Beatles');
  });

  it('filters by kind of music with the chips, one at a time', async () => {
    const { view, deps } = setup();
    await view.activate();
    const chip = (cat: string) => q<HTMLButtonElement>(view, `.chip[data-cat="${cat}"]`);
    expect(chip('all').getAttribute('aria-pressed')).toBe('true');
    chip('classical').click();
    expect(titles(view).sort()).toEqual(['Für Elise', 'Ode to Joy']);
    expect(chip('classical').getAttribute('aria-pressed')).toBe('true');
    expect(chip('all').getAttribute('aria-pressed')).toBe('false');
    expect(deps.setQuery).toHaveBeenLastCalledWith('cat=classical');
    chip('all').click();
    expect(titles(view)).toHaveLength(8);
  });

  it('filters by one or more levels with the level chips', async () => {
    const { view, deps } = setup();
    await view.activate();
    const level = (n: number) => q<HTMLButtonElement>(view, `.chip[data-level="${n}"]`);
    level(1).click();
    expect(titles(view).sort()).toEqual(['Imagine', 'Ode to Joy']);
    level(4).click();
    expect(titles(view).sort()).toEqual(['Bohemian Rhapsody', 'Imagine', 'Ode to Joy']);
    expect(level(4).getAttribute('aria-pressed')).toBe('true');
    expect(deps.setQuery).toHaveBeenLastCalledWith('level=1%2C4');
    level(1).click();
    expect(titles(view)).toEqual(['Bohemian Rhapsody']);
  });

  it('sorts', async () => {
    const { view, deps } = setup();
    await view.activate();
    const sort = q<HTMLSelectElement>(view, '#catalogSort');
    sort.value = 'easiest';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    expect(view.element.querySelector('.catalog-level')!.getAttribute('data-level')).toBe('1');
    expect(deps.setQuery).toHaveBeenLastCalledWith('sort=easiest');
    sort.value = 'newest';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    expect(titles(view)[0]).toBe('Nuvole Bianche');
  });

  it('starts from the filter in the address', async () => {
    const { view } = setup({}, 'artist=Beethoven&level=1&cat=classical&sort=title&q=ode');
    await view.activate();
    expect(q<HTMLInputElement>(view, '#catalogSearch').value).toBe('ode');
    expect(q<HTMLInputElement>(view, '#catalogArtist').value).toBe('Beethoven');
    expect(q<HTMLSelectElement>(view, '#catalogSort').value).toBe('title');
    expect(q<HTMLButtonElement>(view, '.chip[data-cat="classical"]').getAttribute('aria-pressed')).toBe('true');
    expect(q<HTMLButtonElement>(view, '.chip[data-level="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(titles(view)).toEqual(['Ode to Joy']);
  });

  it('shows a page at a time and loads more on request', async () => {
    const { view } = setup({ pageSize: 3 });
    await view.activate();
    expect(titles(view)).toHaveLength(3);
    expect(q(view, '.catalog-showing').textContent).toBe('Showing 3 of 8');
    const more = q<HTMLButtonElement>(view, '.catalog-more');
    expect(more.textContent).toBe('Show 3 more');
    more.click();
    expect(titles(view)).toHaveLength(6);
    q<HTMLButtonElement>(view, '.catalog-more').click();
    expect(titles(view)).toHaveLength(8);
    expect(q(view, '.catalog-more')).toBeNull();
    expect(q(view, '.catalog-showing')).toBeNull();
  });

  it('goes back to the first page when the filter changes', async () => {
    const { view } = setup({ pageSize: 3 });
    await view.activate();
    q<HTMLButtonElement>(view, '.catalog-more').click();
    type(q(view, '#catalogSearch'), 'e');
    expect(titles(view).length).toBeLessThanOrEqual(3);
  });

  it('says so when nothing matches and offers to clear the filters', async () => {
    const { view, deps } = setup();
    await view.activate();
    type(q(view, '#catalogSearch'), 'zzzz');
    expect(q(view, '.catalog-empty').textContent).toContain('No song matches');
    q<HTMLButtonElement>(view, '.catalog-empty .catalog-clear').click();
    expect(q<HTMLInputElement>(view, '#catalogSearch').value).toBe('');
    expect(titles(view)).toHaveLength(8);
    expect(deps.setQuery).toHaveBeenLastCalledWith('');
  });

  it('has a Clear filters button next to the count only when a filter is on', async () => {
    const { view } = setup();
    await view.activate();
    expect(q(view, '.catalog-status .catalog-clear')).toBeNull();
    q<HTMLButtonElement>(view, '.chip[data-level="1"]').click();
    expect(q(view, '.catalog-status .catalog-clear')).not.toBeNull();
  });

  it('plays a built-in song in the app, and offers it only for those songs', async () => {
    const { view, deps } = setup();
    await view.activate();
    const row = q<HTMLElement>(view, '[data-song$="ode-to-joy"]');
    expect(row.querySelector('.catalog-inapp')!.textContent).toBe('In the app');
    const play = row.querySelector<HTMLButtonElement>('.catalog-play')!;
    expect(play.textContent).toBe('Play in the app');
    play.click();
    expect(deps.playBuiltIn).toHaveBeenCalledWith('ode-to-joy');
    expect(q(view, '[data-song$="let-it-be"] .catalog-play')).toBeNull();
    expect(q(view, '[data-song$="let-it-be"] .catalog-inapp')).toBeNull();
  });

  it('links to the sheet music and a place to listen, in a new tab, safely', async () => {
    const { view } = setup();
    await view.activate();
    const row = q<HTMLElement>(view, '[data-song$="let-it-be"]');
    const sheet = row.querySelector<HTMLAnchorElement>('.catalog-sheet')!;
    const listen = row.querySelector<HTMLAnchorElement>('.catalog-listen')!;
    expect(new URL(sheet.href).hostname).toBe('musescore.com');
    expect(new URL(listen.href).hostname).toBe('www.youtube.com');
    for (const link of [sheet, listen]) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
    }
    expect(sheet.getAttribute('aria-label')).toBe('Sheet music for Let It Be (opens in a new tab)');
    const classical = q<HTMLElement>(view, '[data-song$="elise"]').querySelector<HTMLAnchorElement>('.catalog-sheet')!;
    expect(new URL(classical.href).hostname).toBe('imslp.org');
  });

  it('opens the file picker for a song of your own', async () => {
    const { view, deps } = setup();
    await view.activate();
    q<HTMLButtonElement>(view, '.catalog-own').click();
    expect(deps.chooseFile).toHaveBeenCalledOnce();
  });

  it('explains how the library works, in a box that starts closed and remembers that it was opened', async () => {
    const { view } = setup();
    await view.activate();
    const note = q<HTMLDetailsElement>(view, '.catalog-note');
    expect(note.open).toBe(false);
    expect(note.textContent).toContain('MusicXML');
    expect(note.textContent).toContain('estimates');
    note.open = true;
    note.dispatchEvent(new Event('toggle'));
    document.body.replaceChildren();
    const again = setup().view;
    expect(q<HTMLDetailsElement>(again, '.catalog-note').open).toBe(true);
  });

  it('shows the Persian name of a Persian song next to its other name', async () => {
    const { view } = setup();
    await view.activate();
    const row = q<HTMLElement>(view, '[data-song$="pol"]');
    expect(row.querySelector('.catalog-title')!.textContent).toBe('Pol');
    expect(row.querySelector('.catalog-alt')!.textContent).toBe('پل');
  });

  describe('in Persian', () => {
    it('shows Persian names first, Persian digits and Persian labels', async () => {
      setLocale('fa');
      const { view } = setup();
      await view.activate();
      expect(q(view, 'h2').textContent).toBe('کتابخانه‌ی آهنگ‌ها');
      expect(q(view, '.catalog-count').textContent).toBe('۸ آهنگ');
      const row = q<HTMLElement>(view, '[data-song$="pol"]');
      expect(row.querySelector('.catalog-title')!.textContent).toBe('پل');
      expect(row.querySelector('.catalog-alt')!.textContent).toBe('Pol');
      expect(row.querySelector('.catalog-artist')!.textContent).toBe('گوگوش');
      expect(row.querySelector('.level-name')!.textContent).toBe('متوسط');
      expect(q<HTMLElement>(view, '[data-song$="let-it-be"]').textContent).toContain('۱۹۷۰');
    });

    it('keeps the pips and the search box left to right where they must be', async () => {
      setLocale('fa');
      const { view } = setup();
      await view.activate();
      expect(q(view, '#catalogSearch').getAttribute('dir')).toBe('auto');
      expect(q(view, '.pips').getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('writes everything again in the new language, keeping the filters', async () => {
    const { view } = setup();
    await view.activate();
    q<HTMLButtonElement>(view, '.chip[data-level="1"]').click();
    setLocale('fa');
    view.refresh();
    expect(q(view, 'h2').textContent).toBe('کتابخانه‌ی آهنگ‌ها');
    expect(q<HTMLButtonElement>(view, '.chip[data-level="1"]').getAttribute('aria-pressed')).toBe('true');
    expect(titles(view)).toHaveLength(2);
  });

  it('reads the address again when it is opened again', async () => {
    let query = '';
    const { view } = setup({ getQuery: () => query });
    await view.activate();
    query = 'artist=Queen';
    await view.activate();
    expect(titles(view)).toEqual(['Bohemian Rhapsody']);
  });
});
