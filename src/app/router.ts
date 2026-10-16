/** The screens of the app. `levels` and `practice` share the music stand; `learn` opens inside it too. */
export const VIEWS = ['home', 'levels', 'practice', 'songs', 'learn', 'xylophone', 'progress'] as const;
export type View = (typeof VIEWS)[number];

export function isView(value: string): value is View {
  return (VIEWS as readonly string[]).includes(value);
}

/** `#/` and anything unknown mean the home screen. */
export function parseRoute(hash: string): View {
  const match = /^#\/?([a-z]*)$/.exec(hash);
  const name = match?.[1] ?? '';
  return isView(name) ? name : 'home';
}

export function formatRoute(view: View): string {
  return view === 'home' ? '#/' : `#/${view}`;
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
  private readonly listeners = new Set<(view: View) => void>();
  private last: View | null = null;
  private started = false;

  constructor(win: RouterWindow = window) {
    this.win = win;
  }

  current(): View {
    return parseRoute(this.win.location.hash);
  }

  navigate(view: View): void {
    if (this.current() !== view) this.win.location.hash = formatRoute(view);
    this.emit();
  }

  onChange(listener: (view: View) => void): () => void {
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

  /** Only a real change of screen is announced, so navigate() followed by the browser's hashchange fires once. */
  private emit(): void {
    const view = this.current();
    if (view === this.last) return;
    this.last = view;
    for (const listener of [...this.listeners]) listener(view);
  }
}
