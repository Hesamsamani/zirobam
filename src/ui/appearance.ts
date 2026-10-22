import { storageGet, storageSet } from '../core/safeStorage';

/**
 * How the app looks: a theme (dark, light, or whatever the device uses) and an accent colour.
 *
 * The page only ever carries the resolved theme, `<html data-theme="dark|light">`, and the accent,
 * `<html data-accent="brass|violet|...">`; the style sheet (`src/styles/tokens.css`) has one block for each. A small
 * script in the `<head>` of `index.html` sets both before the first paint, from the same two keys, so a stored choice
 * does not flash the other theme. Both keys start with `ui.`, so a backup keeps them.
 */

export type ThemeChoice = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';

export const THEME_CHOICES: readonly ThemeChoice[] = ['dark', 'light', 'system'];
/** Teal, red and green are not offered: they mean quarter tone, wrong and right in this app. */
export const ACCENTS = ['brass', 'violet', 'blue', 'rose', 'copper', 'silver'] as const;
export type Accent = (typeof ACCENTS)[number];

export const THEME_KEY = 'ui.theme';
export const ACCENT_KEY = 'ui.accent';

/** The colour of the browser's own bar (the address bar of a phone) in each theme: the colour of the page. */
export const THEME_COLOR: Readonly<Record<Theme, string>> = { dark: '#1a1a1a', light: '#e2e7ec' };

const LIGHT_QUERY = '(prefers-color-scheme: light)';

export interface AppearanceState {
  choice: ThemeChoice;
  /** What is on the screen: the choice, or the device's theme when the choice is "system". */
  theme: Theme;
  accent: Accent;
}

export interface AppearanceDeps {
  doc?: Document;
  get?(key: string): string | null;
  set?(key: string, value: string): void;
  matchMedia?(query: string): MediaQueryList;
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

export function isAccent(value: unknown): value is Accent {
  return typeof value === 'string' && (ACCENTS as readonly string[]).includes(value);
}

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): Theme {
  return choice === 'system' ? (prefersLight ? 'light' : 'dark') : choice;
}

export class Appearance {
  private readonly doc: Document;
  private readonly store: (key: string, value: string) => void;
  private readonly query: MediaQueryList | null;
  private readonly listeners = new Set<(state: AppearanceState) => void>();
  private choiceNow: ThemeChoice = 'dark';
  private themeNow: Theme = 'dark';
  private accentNow: Accent = 'brass';
  private watching = false;
  private readonly onDevice = (): void => {
    if (this.choiceNow === 'system' && this.refreshTheme()) this.emit();
  };

  constructor(deps: AppearanceDeps = {}) {
    this.doc = deps.doc ?? document;
    this.store = deps.set ?? storageSet;
    const matchMedia = deps.matchMedia ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined);
    this.query = matchMedia ? matchMedia(LIGHT_QUERY) : null;
    const read = deps.get ?? storageGet;
    let storedTheme: string | null = null;
    let storedAccent: string | null = null;
    try {
      storedTheme = read(THEME_KEY);
      storedAccent = read(ACCENT_KEY);
    } catch {
      // nothing kept: the defaults
    }
    if (isThemeChoice(storedTheme)) this.choiceNow = storedTheme;
    if (isAccent(storedAccent)) this.accentNow = storedAccent;
    this.themeNow = resolveTheme(this.choiceNow, this.query?.matches ?? false);
    this.watch();
    this.apply();
  }

  choice(): ThemeChoice {
    return this.choiceNow;
  }

  theme(): Theme {
    return this.themeNow;
  }

  accent(): Accent {
    return this.accentNow;
  }

  setTheme(choice: ThemeChoice): void {
    if (!isThemeChoice(choice) || choice === this.choiceNow) return;
    this.choiceNow = choice;
    this.keep(THEME_KEY, choice);
    this.watch();
    this.refreshTheme();
    this.emit();
  }

  setAccent(accent: Accent): void {
    if (!isAccent(accent) || accent === this.accentNow) return;
    this.accentNow = accent;
    this.keep(ACCENT_KEY, accent);
    this.apply();
    this.emit();
  }

  /** Flips what is on the screen, dark to light or light to dark; from then on the choice is that theme, not the device's. */
  toggleTheme(): Theme {
    const next: Theme = this.themeNow === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  /** Calls `listener` whenever the choice, the theme on the screen or the accent changes. Returns the way to stop. */
  onChange(listener: (state: AppearanceState) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private keep(key: string, value: string): void {
    try {
      this.store(key, value);
    } catch {
      // not remembered
    }
  }

  /** Looks at the device again; true if the theme on the screen changed. */
  private refreshTheme(): boolean {
    const theme = resolveTheme(this.choiceNow, this.query?.matches ?? false);
    if (theme === this.themeNow) return false;
    this.themeNow = theme;
    this.apply();
    return true;
  }

  /** Listens to the device only while the choice is "system". */
  private watch(): void {
    const wanted = this.choiceNow === 'system' && this.query !== null;
    if (wanted && !this.watching) this.query!.addEventListener('change', this.onDevice);
    if (!wanted && this.watching) this.query!.removeEventListener('change', this.onDevice);
    this.watching = wanted;
  }

  private apply(): void {
    const html = this.doc.documentElement;
    html.dataset.theme = this.themeNow;
    html.dataset.accent = this.accentNow;
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[this.themeNow]);
  }

  private emit(): void {
    const state: AppearanceState = { choice: this.choiceNow, theme: this.themeNow, accent: this.accentNow };
    for (const listener of [...this.listeners]) listener(state);
  }
}
