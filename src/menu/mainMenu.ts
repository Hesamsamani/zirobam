import { t, type MessageKey } from '../i18n';
import type { View } from '../app/router';

export type TileId = 'learn' | 'levels' | 'songs' | 'xylophone' | 'metronome' | 'settings';

export interface MenuTile {
  id: TileId;
  icon: string;
  title: MessageKey;
  desc: MessageKey;
  /** A screen to open, or an action that opens a panel instead. */
  target: { view: View } | { action: 'settings' | 'metronome' };
}

/** The tiles of the home screen, in reading order. */
export const MENU_TILES: readonly MenuTile[] = [
  { id: 'learn', icon: '📖', title: 'menu.learn.title', desc: 'menu.learn.desc', target: { view: 'learn' } },
  { id: 'levels', icon: '🎼', title: 'menu.levels.title', desc: 'menu.levels.desc', target: { view: 'levels' } },
  { id: 'songs', icon: '🎵', title: 'menu.songs.title', desc: 'menu.songs.desc', target: { view: 'songs' } },
  { id: 'xylophone', icon: '🎶', title: 'menu.xylophone.title', desc: 'menu.xylophone.desc', target: { view: 'xylophone' } },
  { id: 'metronome', icon: '⏱️', title: 'menu.metronome.title', desc: 'menu.metronome.desc', target: { action: 'metronome' } },
  { id: 'settings', icon: '⚙️', title: 'menu.settings.title', desc: 'menu.settings.desc', target: { action: 'settings' } },
];

export interface MainMenuDeps {
  navigate(view: View): void;
  openSettings(): void;
  /** Opens the floating metronome window. Runs straight from the click, as browsers require. */
  openMetronome(): void;
  /** The player's current level as it should be shown, for example "3b" or "۳b". */
  levelLabel(): string;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The home screen: what to practise today. */
export class MainMenu {
  readonly element: HTMLElement;
  private readonly deps: MainMenuDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly tiles = new Map<TileId, { title: HTMLElement; desc: HTMLElement }>();

  constructor(deps: MainMenuDeps) {
    this.deps = deps;
    this.element = make('section', 'main-menu');
    this.element.id = 'mainMenu';
    this.element.dataset.views = 'home';

    const header = make('header', 'menu-header');
    this.title = make('h1', 'menu-title');
    this.subtitle = make('p', 'menu-subtitle');
    header.append(this.title, this.subtitle);

    const grid = make('div', 'menu-grid');
    for (const def of MENU_TILES) grid.appendChild(this.buildTile(def));

    this.element.append(header, grid);
    this.refresh();
  }

  private buildTile(def: MenuTile): HTMLButtonElement {
    const button = make('button', 'menu-tile');
    button.type = 'button';
    button.dataset.tile = def.id;

    const icon = make('span', 'menu-tile-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = def.icon;
    const title = make('span', 'menu-tile-title');
    const desc = make('span', 'menu-tile-desc');
    button.append(icon, title, desc);
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

  /** Writes the texts again, after the language, the note names or the level changed. */
  refresh(): void {
    this.title.textContent = t('menu.title');
    this.subtitle.textContent = t('menu.subtitle');
    for (const def of MENU_TILES) {
      const parts = this.tiles.get(def.id)!;
      parts.title.textContent = t(def.title);
      parts.desc.textContent = t(def.desc, { level: this.deps.levelLabel() });
    }
  }
}
