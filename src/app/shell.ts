import type { Router, View } from './router';

export interface ViewHooks {
  /** `param` is the name after the screen in the address (the lesson), or null. */
  enter?(view: View, previous: View | null, param: string | null): void;
  leave?(view: View, next: View): void;
  /** The screen stays, but the name after it changed (another lesson). */
  change?(view: View, param: string | null): void;
}

/**
 * Shows one screen at a time. Sections of the page say where they belong with
 * `data-views="levels practice learn"`; the shell hides the others with the `view-hidden` class
 * (not the `hidden` attribute, which the sections use for their own open/closed state).
 */
export class AppShell {
  private readonly router: Router;
  private readonly root: Document;
  private readonly hooks = new Map<View, ViewHooks>();
  private view: View | null = null;
  private param: string | null = null;

  constructor(router: Router, root: Document = document) {
    this.router = router;
    this.root = root;
  }

  register(views: View | readonly View[], hooks: ViewHooks): void {
    for (const view of Array.isArray(views) ? views : [views as View]) this.hooks.set(view, hooks);
  }

  current(): View | null {
    return this.view;
  }

  /** The name after the current screen in the address (the lesson), or null. */
  currentParam(): string | null {
    return this.param;
  }

  navigate(view: View, param: string | null = null): void {
    this.router.navigate(view, param);
  }

  start(): void {
    this.router.onChange((view, param) => this.apply(view, param));
    this.router.start();
  }

  private apply(next: View, param: string | null = null): void {
    const previous = this.view;
    if (previous === next) {
      this.param = param;
      this.hooks.get(next)?.change?.(next, param);
      return;
    }
    this.param = param;
    if (previous) this.hooks.get(previous)?.leave?.(previous, next);
    this.view = next;
    this.root.body.dataset.view = next;
    for (const section of this.root.querySelectorAll<HTMLElement>('[data-views]')) {
      const views = (section.dataset.views ?? '').split(/\s+/);
      section.classList.toggle('view-hidden', !views.includes(next));
    }
    this.hooks.get(next)?.enter?.(next, previous, param);
  }
}
