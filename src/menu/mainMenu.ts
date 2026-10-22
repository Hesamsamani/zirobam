import { formatNumber, t, type MessageKey } from '../i18n';
import type { View } from '../app/router';
import { makeBrandMark } from '../ui/brandMark';
import { makeIcon } from '../ui/icons';

export type TileId = 'lessons' | 'learn' | 'ear' | 'scales' | 'chords' | 'rhythm' | 'persian' | 'generator' | 'tuner' | 'catalog' | 'levels' | 'songs' | 'xylophone' | 'metronome' | 'progress' | 'settings';

export interface MenuTile {
  id: TileId;
  /** Paths are the main ways to practise; tools are the extras. */
  group: 'path' | 'tool';
  title: MessageKey;
  desc: MessageKey;
  /** A screen to open, or an action that opens a panel instead. */
  target: { view: View } | { action: 'settings' | 'metronome' };
}

/** The tiles of the home screen, in reading order. */
export const MENU_TILES: readonly MenuTile[] = [
  { id: 'lessons', group: 'path', title: 'menu.lessons.title', desc: 'menu.lessons.desc', target: { view: 'lessons' } },
  { id: 'learn', group: 'path', title: 'menu.learn.title', desc: 'menu.learn.desc', target: { view: 'learn' } },
  { id: 'ear', group: 'path', title: 'menu.ear.title', desc: 'menu.ear.desc', target: { view: 'ear' } },
  { id: 'scales', group: 'path', title: 'menu.scales.title', desc: 'menu.scales.desc', target: { view: 'scales' } },
  { id: 'chords', group: 'path', title: 'menu.chords.title', desc: 'menu.chords.desc', target: { view: 'chords' } },
  { id: 'rhythm', group: 'path', title: 'menu.rhythm.title', desc: 'menu.rhythm.desc', target: { view: 'rhythm' } },
  { id: 'persian', group: 'path', title: 'menu.persian.title', desc: 'menu.persian.desc', target: { view: 'persian' } },
  { id: 'levels', group: 'path', title: 'menu.levels.title', desc: 'menu.levels.desc', target: { view: 'levels' } },
  { id: 'songs', group: 'path', title: 'menu.songs.title', desc: 'menu.songs.desc', target: { view: 'songs' } },
  { id: 'catalog', group: 'tool', title: 'menu.catalog.title', desc: 'menu.catalog.desc', target: { view: 'catalog' } },
  { id: 'tuner', group: 'tool', title: 'menu.tuner.title', desc: 'menu.tuner.desc', target: { view: 'tuner' } },
  { id: 'generator', group: 'tool', title: 'menu.generator.title', desc: 'menu.generator.desc', target: { view: 'generator' } },
  { id: 'xylophone', group: 'tool', title: 'menu.xylophone.title', desc: 'menu.xylophone.desc', target: { view: 'xylophone' } },
  { id: 'metronome', group: 'tool', title: 'menu.metronome.title', desc: 'menu.metronome.desc', target: { action: 'metronome' } },
  { id: 'progress', group: 'tool', title: 'menu.progress.title', desc: 'menu.progress.desc', target: { view: 'progress' } },
  { id: 'settings', group: 'tool', title: 'menu.settings.title', desc: 'menu.settings.desc', target: { action: 'settings' } },
];

export interface ResumeInfo {
  /** The screen the Continue card opens. */
  view: View;
  /** What you were doing, for example "Level 3b" or a song's name. */
  title: string;
  /** One line about where you are. */
  detail: string;
}

export interface MainMenuDeps {
  navigate(view: View): void;
  openSettings(): void;
  /** Opens the floating metronome window. Runs straight from the click, as browsers require. */
  openMetronome(): void;
  /** The player's current level as it should be shown, for example "3b" or "۳b". */
  levelLabel(): string;
  /** How many of the lessons were read. */
  lessonsProgress?(): { read: number; total: number };
  /** Where the player left off. */
  resume(): ResumeInfo;
  /** How far the plan of today is, for the card at the top. Without this there is no card. */
  today?(): { done: number; total: number; minutes: number };
  /** Shown under the subtitle: the rank, the daily goal and the streak. */
  extra?: HTMLElement;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const REPOSITORY = 'https://github.com/Hesamsamani/zirobam';
const PIANO_LICENCE = 'https://creativecommons.org/licenses/by/3.0/';

function link(href: string): HTMLAnchorElement {
  const a = make('a', '');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

/** The home screen: a welcome (the mark, the name, a line about the app, the rank), the plan of the day and where you left off, the ways to learn and practise, the extra tools, and the credits. */
export class MainMenu {
  readonly element: HTMLElement;
  private readonly deps: MainMenuDeps;
  private readonly title: HTMLElement;
  private readonly tagline: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly sourceLink: HTMLAnchorElement;
  private readonly pianoLink: HTMLAnchorElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly resumeTitle: HTMLElement;
  private readonly resumeDetail: HTMLElement;
  private readonly resumeGo: HTMLElement;
  private todayCard: HTMLButtonElement | null = null;
  private todayTitle: HTMLElement | null = null;
  private todayDetail: HTMLElement | null = null;
  private readonly tiles = new Map<TileId, { title: HTMLElement; desc: HTMLElement }>();
  private resumeView: View = 'levels';

  constructor(deps: MainMenuDeps) {
    this.deps = deps;
    this.element = make('section', 'main-menu');
    this.element.id = 'mainMenu';
    this.element.dataset.views = 'home';

    // The welcome: the mark on a staff, the name, a line about the app, and the rank
    const header = make('header', 'menu-header');
    const mark = make('span', 'menu-mark');
    mark.append(makeBrandMark(document));
    this.title = make('h1', 'menu-title');
    this.tagline = make('p', 'menu-tagline');
    header.append(mark, this.title, this.tagline);
    if (deps.extra) header.appendChild(deps.extra);
    this.subtitle = make('p', 'menu-subtitle');

    // The sheet of music: continue where you stopped
    this.resumeButton = make('button', 'menu-resume');
    this.resumeButton.type = 'button';
    this.resumeButton.dataset.tile = 'resume';
    const text = make('span', 'menu-resume-text');
    this.resumeTitle = make('span', 'menu-resume-title');
    this.resumeDetail = make('span', 'menu-resume-detail');
    text.append(this.resumeTitle, this.resumeDetail);
    this.resumeGo = make('span', 'menu-resume-go');
    this.resumeButton.append(text, this.resumeGo);
    this.resumeButton.addEventListener('click', () => this.deps.navigate(this.resumeView));

    const paths = make('div', 'menu-paths');
    const tools = make('div', 'menu-tools');
    for (const def of MENU_TILES) (def.group === 'path' ? paths : tools).appendChild(this.buildTile(def));

    if (deps.today) {
      const card = make('button', 'menu-today');
      card.type = 'button';
      card.dataset.tile = 'today';
      const text = make('span', 'menu-today-text');
      const todayTitle = make('span', 'menu-today-title');
      const todayDetail = make('span', 'menu-today-detail');
      text.append(todayTitle, todayDetail);
      const go = make('span', 'menu-today-go');
      card.append(text, go);
      card.addEventListener('click', () => this.deps.navigate('today'));
      this.todayCard = card;
      this.todayTitle = todayTitle;
      this.todayDetail = todayDetail;
    }

    // The plan of the day and where you left off, side by side where there is room
    const cards = make('div', 'menu-cards');
    cards.append(...(this.todayCard ? [this.todayCard] : []), this.resumeButton);

    const credits = make('p', 'menu-credits');
    this.sourceLink = link(REPOSITORY);
    this.pianoLink = link(PIANO_LICENCE);
    credits.append(this.sourceLink, this.pianoLink);

    this.element.append(header, cards, this.subtitle, paths, tools, credits);
    this.refresh();
  }

  private buildTile(def: MenuTile): HTMLButtonElement {
    const button = make('button', `menu-tile menu-${def.group}`);
    button.type = 'button';
    button.dataset.tile = def.id;

    const iconHolder = make('span', 'menu-tile-icon');
    iconHolder.setAttribute('aria-hidden', 'true');
    iconHolder.appendChild(makeIcon(def.id));
    const title = make('span', 'menu-tile-title');
    const desc = make('span', 'menu-tile-desc');
    button.append(iconHolder, title, desc);
    this.tiles.set(def.id, { title, desc });

    // the Settings panel closes on a click outside it, but not on a click of a button that controls it
    if ('action' in def.target && def.target.action === 'settings') {
      button.setAttribute('aria-controls', 'optionsPanel');
      button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', () => {
      if ('view' in def.target) {
        this.deps.navigate(def.target.view);
      } else if (def.target.action === 'metronome') {
        this.deps.openMetronome();
      } else {
        this.deps.openSettings();
      }
    });
    return button;
  }

  /** Writes the texts again, after the language, the note names, the level or the song changed. */
  refresh(): void {
    this.title.textContent = t('menu.title');
    this.tagline.textContent = t('menu.tagline');
    this.subtitle.textContent = t('menu.subtitle');
    this.sourceLink.textContent = t('menu.credits.source');
    this.pianoLink.textContent = t('menu.credits.piano');
    for (const def of MENU_TILES) {
      const parts = this.tiles.get(def.id)!;
      parts.title.textContent = t(def.title);
      const lessons = this.deps.lessonsProgress?.() ?? { read: 0, total: 0 };
      parts.desc.textContent = t(def.desc, { level: this.deps.levelLabel(), read: lessons.read, total: lessons.total });
    }
    const resume = this.deps.resume();
    this.resumeView = resume.view;
    this.resumeTitle.textContent = resume.title;
    this.resumeDetail.textContent = resume.detail;
    this.resumeGo.textContent = t('menu.resume.go');
    const today = this.deps.today?.();
    if (today && this.todayCard && this.todayTitle && this.todayDetail) {
      this.todayTitle.textContent = `${t('menu.today.title')}: ${t('menu.today.progress', { done: formatNumber(today.done), total: formatNumber(today.total) })}`;
      this.todayDetail.textContent = t('menu.today.detail', { minutes: formatNumber(today.minutes) });
      this.todayCard.querySelector('.menu-today-go')!.textContent = t('menu.today.go');
    }
  }
}
