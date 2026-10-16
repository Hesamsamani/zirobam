import { t, type MessageKey } from '../i18n';
import type { View } from '../app/router';

export type TileId = 'lessons' | 'learn' | 'catalog' | 'levels' | 'songs' | 'xylophone' | 'metronome' | 'progress' | 'settings';

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
  { id: 'levels', group: 'path', title: 'menu.levels.title', desc: 'menu.levels.desc', target: { view: 'levels' } },
  { id: 'songs', group: 'path', title: 'menu.songs.title', desc: 'menu.songs.desc', target: { view: 'songs' } },
  { id: 'catalog', group: 'tool', title: 'menu.catalog.title', desc: 'menu.catalog.desc', target: { view: 'catalog' } },
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
  /** Shown under the subtitle: the rank, the daily goal and the streak. */
  extra?: HTMLElement;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Line icons, 24 by 24, drawn with the current text colour. */
const ICONS: Readonly<Record<TileId, string>> = {
  lessons: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H12v15h6.5a1.5 1.5 0 0 1 1.5 1.5z',
  learn: 'M12 3a9 9 0 1 0 .01 0M12 7.5a4.5 4.5 0 1 0 .01 0M12 12h.01',
  levels: 'M3 6h18M3 9.5h18M3 13h18M3 16.5h18M3 20h18M12.2 16.2a2.2 1.6 -20 1 0 .01 0M14.3 15.6V5',
  songs: 'M9 17.5V6l10-2v11.5M9 17.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0zM19 15.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z',
  catalog: 'M4 6h10M4 11h10M4 16h6M18.2 17.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM18.2 17.2V8l3 1',
  xylophone: 'M3.2 4h3.2v16H3.2zM8.6 4h3.2v13H8.6zM14 4h3.2v10H14zM19.4 4h1.8v7h-1.8z',
  metronome: 'M8 22h8l-2-16h-4zM12 6l4-3M12 14.5h.01',
  progress: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  settings: 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 7a2 2 0 1 0 .01 0M9 12a2 2 0 1 0 .01 0M17 17a2 2 0 1 0 .01 0',
};

function icon(id: TileId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[id]);
  svg.appendChild(path);
  return svg;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The home screen: where you left off, the ways to learn and practise, and the extra tools. */
export class MainMenu {
  readonly element: HTMLElement;
  private readonly deps: MainMenuDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly resumeTitle: HTMLElement;
  private readonly resumeDetail: HTMLElement;
  private readonly resumeGo: HTMLElement;
  private readonly tiles = new Map<TileId, { title: HTMLElement; desc: HTMLElement }>();
  private resumeView: View = 'levels';

  constructor(deps: MainMenuDeps) {
    this.deps = deps;
    this.element = make('section', 'main-menu');
    this.element.id = 'mainMenu';
    this.element.dataset.views = 'home';

    const header = make('header', 'menu-header');
    this.title = make('h1', 'menu-title');
    this.subtitle = make('p', 'menu-subtitle');
    header.append(this.title, this.subtitle);
    if (deps.extra) header.appendChild(deps.extra);

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

    this.element.append(header, this.resumeButton, paths, tools);
    this.refresh();
  }

  private buildTile(def: MenuTile): HTMLButtonElement {
    const button = make('button', `menu-tile menu-${def.group}`);
    button.type = 'button';
    button.dataset.tile = def.id;

    const iconHolder = make('span', 'menu-tile-icon');
    iconHolder.setAttribute('aria-hidden', 'true');
    iconHolder.appendChild(icon(def.id));
    const title = make('span', 'menu-tile-title');
    const desc = make('span', 'menu-tile-desc');
    button.append(iconHolder, title, desc);
    this.tiles.set(def.id, { title, desc });

    button.addEventListener('click', (event) => {
      if ('view' in def.target) {
        this.deps.navigate(def.target.view);
      } else if (def.target.action === 'metronome') {
        this.deps.openMetronome();
      } else {
        // The page closes the options panel on any click outside it; this click is the one that opens it
        event.stopPropagation();
        this.deps.openSettings();
      }
    });
    return button;
  }

  /** Writes the texts again, after the language, the note names, the level or the song changed. */
  refresh(): void {
    this.title.textContent = t('menu.title');
    this.subtitle.textContent = t('menu.subtitle');
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
  }
}
