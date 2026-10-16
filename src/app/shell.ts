import type { Router, View } from './router';

export interface ViewHooks {
  enter?(view: View, previous: View | null): void;
  leave?(view: View, next: View): void;
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

  navigate(view: View): void {
    this.router.navigate(view);
  }

  start(): void {
    this.router.onChange((view) => this.apply(view));
    this.router.start();
  }

  private apply(next: View): void {
    const previous = this.view;
    if (previous) this.hooks.get(previous)?.leave?.(previous, next);
    this.view = next;
    this.root.body.dataset.view = next;
    for (const section of this.root.querySelectorAll<HTMLElement>('[data-views]')) {
      const views = (section.dataset.views ?? '').split(/\s+/);
      section.classList.toggle('view-hidden', !views.includes(next));
    }
    this.hooks.get(next)?.enter?.(next, previous);
  }
}
