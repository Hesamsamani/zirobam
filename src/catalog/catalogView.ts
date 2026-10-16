import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, getLocale, t, usesPersianDigits, type MessageKey } from '../i18n';
import { createBackButton } from '../menu/backButton';
import { artistList, filterSongs, filterToQuery, queryToFilter, sortSongs } from './filter';
import { listenUrl, sheetMusicUrl } from './links';
import {
  CATEGORIES,
  DEFAULT_FILTER,
  LEVELS,
  SORT_KEYS,
  type CatalogFilter,
  type CatalogSong,
  type Category,
  type Level,
  type SortKey,
} from './types';

export interface CatalogViewDeps {
  /** The whole library; the lists load the first time and are kept. */
  load(): Promise<CatalogSong[]>;
  /** The filter part of the address, for example `artist=Queen&level=2`. */
  getQuery(): string;
  /** Writes the filter into the address without adding a step to the history. */
  setQuery(query: string): void;
  onBack(): void;
  /** Opens a song that has its notes inside the app. */
  playBuiltIn(songId: string): void;
  /** Opens the file picker for a MusicXML file of the student's own. */
  chooseFile(): void;
  /** How many songs one page shows. */
  pageSize?: number;
}

const NOTE_KEY = 'ui.catalogNote';
const PAGE_SIZE = 60;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(usesPersianDigits() ? 'fa-IR' : 'en').format(n);
}

/** Four pips, as many filled as the level, with the name of the level beside them. */
function levelBadge(level: Level, className: string): HTMLElement {
  const badge = make('span', className);
  badge.dataset.level = String(level);
  const pips = make('span', 'pips');
  pips.setAttribute('aria-hidden', 'true');
  for (const n of LEVELS) pips.appendChild(make('i', n <= level ? 'on' : ''));
  badge.append(pips, make('span', 'level-name', t(`catalog.level.${level}` as MessageKey)));
  return badge;
}

/** The song library: search, filters and a list with where to find each song's notes. */
export class CatalogView {
  readonly element: HTMLElement;
  private readonly deps: CatalogViewDeps;
  private readonly pageSize: number;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly ownFile: HTMLButtonElement;
  private readonly note: HTMLDetailsElement;
  private readonly noteTitle: HTMLElement;
  private readonly noteBody: HTMLElement;
  private readonly noteLevels: HTMLElement;
  private readonly searchLabel: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly artistLabel: HTMLElement;
  private readonly artist: HTMLInputElement;
  private readonly artistOptions: HTMLDataListElement;
  private readonly sortLabel: HTMLElement;
  private readonly sort: HTMLSelectElement;
  private readonly kindsLabel: HTMLElement;
  private readonly kinds: HTMLElement;
  private readonly levelsLabel: HTMLElement;
  private readonly levels: HTMLElement;
  private readonly status: HTMLElement;
  private readonly count: HTMLElement;
  private readonly results: HTMLElement;

  private songs: CatalogSong[] | null = null;
  private state: 'idle' | 'loading' | 'error' | 'ready' = 'idle';
  private filter: CatalogFilter = { ...DEFAULT_FILTER, levels: [] };
  private matches: CatalogSong[] = [];
  private shown = 0;
  private list: HTMLElement | null = null;

  constructor(deps: CatalogViewDeps) {
    this.deps = deps;
    this.pageSize = deps.pageSize ?? PAGE_SIZE;
    this.element = make('section', 'catalog-view');
    this.element.id = 'catalogView';
    this.element.dataset.views = 'catalog';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    this.ownFile = make('button', 'catalog-own');
    this.ownFile.type = 'button';
    this.ownFile.addEventListener('click', () => this.deps.chooseFile());
    header.append(createBackButton(deps.onBack), this.title, this.subtitle, this.ownFile);

    this.note = make('details', 'catalog-note');
    this.note.open = storageGet(NOTE_KEY) === '1'; // closed until the student opens it, so the list stays in view
    this.note.addEventListener('toggle', () => storageSet(NOTE_KEY, this.note.open ? '1' : '0'));
    this.noteTitle = make('summary', 'catalog-note-title');
    this.noteBody = make('p', 'catalog-note-body');
    this.noteLevels = make('p', 'catalog-note-levels');
    this.note.append(this.noteTitle, this.noteBody, this.noteLevels);

    // the filters
    const form = make('form', 'catalog-filters');
    form.addEventListener('submit', (event) => event.preventDefault());
    form.setAttribute('role', 'search');

    this.search = make('input', 'catalog-input');
    this.search.id = 'catalogSearch';
    this.search.type = 'search';
    this.search.autocomplete = 'off';
    this.search.setAttribute('dir', 'auto');
    this.search.addEventListener('input', () => this.changeFilter({ text: this.search.value }));
    this.searchLabel = this.field('catalogSearch', this.search);

    this.artist = make('input', 'catalog-input');
    this.artist.id = 'catalogArtist';
    this.artist.type = 'search';
    this.artist.autocomplete = 'off';
    this.artist.setAttribute('dir', 'auto');
    this.artist.setAttribute('list', 'catalogArtists');
    this.artist.addEventListener('input', () => this.changeFilter({ artist: this.artist.value }));
    this.artistOptions = make('datalist');
    this.artistOptions.id = 'catalogArtists';
    this.artistLabel = this.field('catalogArtist', this.artist);

    this.sort = make('select', 'catalog-input');
    this.sort.id = 'catalogSort';
    for (const key of SORT_KEYS) this.sort.appendChild(make('option')).setAttribute('value', key);
    this.sort.addEventListener('change', () => this.changeFilter({ sort: this.sort.value as SortKey }));
    this.sortLabel = this.field('catalogSort', this.sort);

    const fields = make('div', 'catalog-fields');
    fields.append(this.searchLabel.parentElement!, this.artistLabel.parentElement!, this.sortLabel.parentElement!, this.artistOptions);

    this.kindsLabel = make('span', 'catalog-group-label');
    this.kinds = make('div', 'catalog-chips');
    this.kinds.setAttribute('role', 'group');
    for (const cat of ['all', ...CATEGORIES] as const) {
      const chip = make('button', 'chip');
      chip.type = 'button';
      chip.dataset.cat = cat;
      chip.addEventListener('click', () => this.changeFilter({ category: cat }));
      this.kinds.appendChild(chip);
    }
    const kindsGroup = make('div', 'catalog-group');
    kindsGroup.append(this.kindsLabel, this.kinds);

    this.levelsLabel = make('span', 'catalog-group-label');
    this.levels = make('div', 'catalog-chips');
    this.levels.setAttribute('role', 'group');
    for (const level of LEVELS) {
      const chip = make('button', 'chip chip-level');
      chip.type = 'button';
      chip.dataset.level = String(level);
      chip.addEventListener('click', () => {
        const on = this.filter.levels.includes(level);
        this.changeFilter({ levels: on ? this.filter.levels.filter((n) => n !== level) : [...this.filter.levels, level].sort() });
      });
      this.levels.appendChild(chip);
    }
    const levelsGroup = make('div', 'catalog-group');
    levelsGroup.append(this.levelsLabel, this.levels);

    form.append(fields, kindsGroup, levelsGroup);

    this.status = make('div', 'catalog-status');
    this.count = make('p', 'catalog-count');
    this.count.setAttribute('aria-live', 'polite');
    this.results = make('div', 'catalog-results');

    this.element.append(header, this.note, form, this.status, this.results);
    this.refresh();
  }

  /** A labelled box. The label is returned; its parent is the whole field. */
  private field(id: string, control: HTMLElement): HTMLElement {
    const wrap = make('div', 'catalog-field');
    const label = make('label', 'catalog-label');
    label.htmlFor = id;
    wrap.append(label, control);
    return label;
  }

  /** Opens the library: reads the filter from the address and loads the lists the first time. */
  async activate(): Promise<void> {
    this.filter = queryToFilter(this.deps.getQuery());
    this.shown = this.pageSize;
    if (this.songs) {
      this.state = 'ready';
      this.refresh();
      return;
    }
    this.state = 'loading';
    this.refresh();
    try {
      this.songs = await this.deps.load();
      this.state = 'ready';
    } catch {
      this.state = 'error';
    }
    this.refresh();
  }

  /** Writes the screen again: after the language changed, a filter changed or the songs arrived. */
  refresh(): void {
    this.title.textContent = t('catalog.title');
    this.ownFile.textContent = t('catalog.ownFile');
    this.noteTitle.textContent = t('catalog.noteTitle');
    this.noteBody.textContent = t('catalog.noteBody');
    this.noteLevels.textContent = t('catalog.noteLevels');
    this.searchLabel.textContent = t('catalog.search');
    this.search.placeholder = t('catalog.searchPlaceholder');
    this.artistLabel.textContent = t('catalog.artist');
    this.artist.placeholder = t('catalog.artistPlaceholder');
    this.sortLabel.textContent = t('catalog.sort');
    this.kindsLabel.textContent = t('catalog.kinds');
    this.kinds.setAttribute('aria-label', t('catalog.kinds'));
    this.levelsLabel.textContent = t('catalog.levels');
    this.levels.setAttribute('aria-label', t('catalog.levels'));

    for (const option of Array.from(this.sort.options)) option.textContent = t(`catalog.sort.${option.value}` as MessageKey);
    this.syncControls();

    for (const chip of Array.from(this.kinds.querySelectorAll<HTMLButtonElement>('.chip'))) {
      const cat = chip.dataset.cat as Category | 'all';
      chip.textContent = t(`catalog.cat.${cat}` as MessageKey);
      chip.setAttribute('aria-pressed', String(this.filter.category === cat));
    }
    for (const chip of Array.from(this.levels.querySelectorAll<HTMLButtonElement>('.chip'))) {
      const level = Number(chip.dataset.level) as Level;
      chip.replaceChildren(levelBadge(level, 'chip-badge'));
      chip.setAttribute('aria-pressed', String(this.filter.levels.includes(level)));
    }

    const songs = this.songs;
    this.subtitle.textContent = songs
      ? t('catalog.subtitle', { songs: formatCount(songs.length), artists: formatCount(new Set(songs.map((s) => s.artist)).size) })
      : '';
    if (songs) this.fillArtists(songs);
    this.renderResults();
  }

  private syncControls(): void {
    if (this.search.value !== this.filter.text) this.search.value = this.filter.text;
    if (this.artist.value !== this.filter.artist) this.artist.value = this.filter.artist;
    this.sort.value = this.filter.sort;
  }

  private fillArtists(songs: readonly CatalogSong[]): void {
    const fa = getLocale() === 'fa';
    this.artistOptions.replaceChildren(
      ...artistList(songs)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((artist) => {
          const option = make('option');
          option.value = fa && artist.nameFa ? artist.nameFa : artist.name;
          option.label = formatCount(artist.count);
          return option;
        })
    );
  }

  private changeFilter(change: Partial<CatalogFilter>): void {
    this.filter = { ...this.filter, ...change };
    this.shown = this.pageSize;
    this.deps.setQuery(filterToQuery(this.filter));
    this.refresh();
  }

  private isFiltered(): boolean {
    const f = this.filter;
    return Boolean(f.text || f.artist || f.levels.length > 0 || f.category !== 'all');
  }

  private clearFilters(): void {
    this.changeFilter({ text: '', artist: '', levels: [], category: 'all' });
  }

  // ----- the list -----

  private renderResults(): void {
    this.list = null;
    this.status.replaceChildren();

    if (this.state === 'loading' || this.state === 'idle') {
      const loading = make('p', 'catalog-loading', t('catalog.loading'));
      loading.setAttribute('role', 'status');
      const list = make('ul', 'catalog-list');
      list.setAttribute('aria-busy', 'true');
      this.results.replaceChildren(loading, list);
      return;
    }

    if (this.state === 'error' || !this.songs) {
      const error = make('div', 'catalog-error');
      error.setAttribute('role', 'alert');
      const retry = make('button', 'catalog-retry', t('catalog.retry'));
      retry.type = 'button';
      retry.addEventListener('click', () => void this.activate());
      error.append(make('p', '', t('catalog.loadFailed')), retry);
      this.results.replaceChildren(error);
      return;
    }

    this.matches = sortSongs(filterSongs(this.songs, this.filter), this.filter.sort, getLocale());
    const n = this.matches.length;
    this.count.textContent = n === 1 ? t('catalog.countOne') : t('catalog.count', { n: formatCount(n) });
    this.status.appendChild(this.count);
    if (this.isFiltered()) this.status.appendChild(this.clearButton());

    if (n === 0) {
      const empty = make('div', 'catalog-empty');
      empty.append(make('p', '', t('catalog.empty')), this.clearButton());
      this.results.replaceChildren(empty);
      return;
    }

    const list = make('ul', 'catalog-list');
    this.list = list;
    this.results.replaceChildren(list);
    this.appendRows(0, Math.min(this.shown, n));
    this.renderMore();
  }

  private clearButton(): HTMLButtonElement {
    const button = make('button', 'catalog-clear', t('catalog.clear'));
    button.type = 'button';
    button.addEventListener('click', () => this.clearFilters());
    return button;
  }

  private appendRows(from: number, to: number): void {
    const rows = document.createDocumentFragment();
    for (const song of this.matches.slice(from, to)) rows.appendChild(this.buildRow(song));
    this.list?.appendChild(rows);
  }

  /** "Showing 60 of 1,200" and a button for the next page, or nothing when everything is shown. */
  private renderMore(): void {
    this.results.querySelector('.catalog-footer')?.remove();
    const total = this.matches.length;
    const shown = Math.min(this.shown, total);
    if (shown >= total) return;
    const footer = make('div', 'catalog-footer');
    footer.appendChild(make('p', 'catalog-showing', t('catalog.showing', { shown: formatCount(shown), total: formatCount(total) })));
    const next = Math.min(this.pageSize, total - shown);
    const more = make('button', 'catalog-more', t('catalog.more', { n: formatCount(next) }));
    more.type = 'button';
    more.addEventListener('click', () => {
      const before = Math.min(this.shown, this.matches.length);
      this.shown += this.pageSize;
      this.appendRows(before, Math.min(this.shown, this.matches.length));
      this.renderMore();
    });
    footer.appendChild(more);
    this.results.appendChild(footer);
  }

  private buildRow(song: CatalogSong): HTMLLIElement {
    const fa = getLocale() === 'fa';
    const name = fa && song.titleFa ? song.titleFa : song.title;
    const other = fa ? (song.titleFa ? song.title : undefined) : song.titleFa;
    const artistName = fa && song.artistFa ? song.artistFa : song.artist;

    const row = make('li', 'catalog-row');
    row.dataset.song = song.id;

    const main = make('div', 'catalog-main');
    const title = make('span', 'catalog-title', name);
    title.setAttribute('dir', 'auto');
    main.appendChild(title);
    if (other) {
      const alt = make('span', 'catalog-alt', other);
      alt.setAttribute('dir', 'auto');
      main.appendChild(alt);
    }
    const byline = make('span', 'catalog-byline');
    const artist = make('button', 'catalog-artist', artistName);
    artist.type = 'button';
    artist.setAttribute('dir', 'auto');
    artist.setAttribute('aria-label', t('catalog.onlyArtist', { artist: artistName }));
    artist.addEventListener('click', () => this.changeFilter({ artist: artistName }));
    byline.appendChild(artist);
    if (song.year) byline.appendChild(make('span', 'catalog-year', formatNumber(song.year)));
    byline.appendChild(make('span', 'catalog-kind', t(`catalog.cat.${song.category}` as MessageKey)));
    main.appendChild(byline);

    const level = levelBadge(song.level, 'catalog-level');
    level.setAttribute('title', t('catalog.levelOf', { level: t(`catalog.level.${song.level}` as MessageKey) }));

    const actions = make('div', 'catalog-actions');
    if (song.builtIn) {
      const builtIn = song.builtIn;
      actions.appendChild(make('span', 'catalog-inapp', t('catalog.inApp')));
      const play = make('button', 'catalog-play', t('catalog.play'));
      play.type = 'button';
      play.setAttribute('aria-label', t('catalog.playFor', { title: name }));
      play.addEventListener('click', () => this.deps.playBuiltIn(builtIn));
      actions.appendChild(play);
    }
    actions.append(
      this.link('catalog-sheet', t('catalog.sheet'), sheetMusicUrl(song), t('catalog.sheetFor', { title: name })),
      this.link('catalog-listen', t('catalog.listen'), listenUrl(song), t('catalog.listenTo', { title: name }))
    );

    row.append(level, main, actions);
    return row;
  }

  private link(className: string, text: string, href: string, label: string): HTMLAnchorElement {
    const a = make('a', className, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', label);
    return a;
  }
}
