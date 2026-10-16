/** The screens of the app. `levels` and `practice` share the music stand; `learn` opens inside it too. */
export const VIEWS = ['home', 'levels', 'practice', 'songs', 'learn', 'lessons', 'catalog', 'xylophone', 'progress', 'maker', 'ear', 'scales'] as const;
export type View = (typeof VIEWS)[number];

export function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** Screens whose address can end in a name (`#/lessons/note-values`, `#/maker/maker-lk3j2a`). */
const NAMED_VIEWS: readonly View[] = ['lessons', 'maker'];
/** Screens that keep their filters in a query after the address (`#/catalog?artist=...`). */
const QUERY_VIEWS: readonly View[] = ['catalog'];

export interface RouteLocation {
  view: View;
  param: string | null;
}

/** The screen and the optional name in an address. `#/` and anything unknown mean the home screen. */
export function parseLocation(hash: string): RouteLocation {
  const home: RouteLocation = { view: 'home', param: null };
  const [path, ...query] = hash.split('?');
  const match = /^#\/?([a-z]*)(?:\/([a-z0-9-]+))?$/.exec(path);
  const name = match?.[1] ?? '';
  const param = match?.[2] ?? null;
  if (!isView(name)) return home;
  if (param && !NAMED_VIEWS.includes(name)) return home;
  if (query.length > 0 && !QUERY_VIEWS.includes(name)) return home;
  return { view: name, param };
}

/** The filter in an address like `#/catalog?artist=Queen`: everything after the first question mark. */
export function hashQuery(hash: string): string {
  const at = hash.indexOf('?');
  return at < 0 ? '' : hash.slice(at + 1);
}

export function parseRoute(hash: string): View {
  return parseLocation(hash).view;
}

export function formatRoute(view: View, param: string | null = null): string {
  if (view === 'home') return '#/';
  return param ? `#/${view}/${param}` : `#/${view}`;
}

/** What the router needs from `window`; a small fake stands in for it in tests. */
export interface RouterWindow {
  location: { hash: string };
  addEventListener(type: 'hashchange', listener: () => void): void;
  removeEventListener(type: 'hashchange', listener: () => void): void;
}

/** Keeps the current screen in the address (`#/levels`), so the Back button and reloads work. */
export class Router {
  private readonly win: RouterWindow;
  private readonly listeners = new Set<(view: View, param: string | null) => void>();
  private last: string | null = null;
  private started = false;

  constructor(win: RouterWindow = window) {
    this.win = win;
  }

  current(): View {
    return parseLocation(this.win.location.hash).view;
  }

  /** The name that follows the screen in the address, for example the lesson. */
  param(): string | null {
    return parseLocation(this.win.location.hash).param;
  }

  navigate(view: View, param: string | null = null): void {
    const target = formatRoute(view, param);
    const here = parseLocation(this.win.location.hash);
    if (here.view !== view || here.param !== param) this.win.location.hash = target;
    this.emit();
  }

  onChange(listener: (view: View, param: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Tells the listeners which screen to show first, then follows the address. */
  start(): void {
    if (!this.started) {
      this.started = true;
      this.win.addEventListener('hashchange', this.handleHashChange);
    }
    this.emit();
  }

  stop(): void {
    this.started = false;
    this.win.removeEventListener('hashchange', this.handleHashChange);
  }

  private readonly handleHashChange = (): void => this.emit();

  /** Only a real change of screen (or of its name) is announced, so navigate() followed by the browser's hashchange fires once. */
  private emit(): void {
    const { view, param } = parseLocation(this.win.location.hash);
    const key = formatRoute(view, param);
    if (key === this.last) return;
    this.last = key;
    for (const listener of [...this.listeners]) listener(view, param);
  }
}
