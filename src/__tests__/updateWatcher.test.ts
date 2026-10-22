import { describe, expect, it, vi } from 'vitest';
import { checkOnReturn, watchForUpdate, type ContainerLike, type RegistrationLike, type WorkerLike } from '../pwa/updateWatcher';

function worker(state = 'installing') {
  const listeners: Array<() => void> = [];
  const posted: unknown[] = [];
  const w = {
    state,
    postMessage: (message: unknown) => void posted.push(message),
    addEventListener: (_type: 'statechange', listener: () => void) => void listeners.push(listener),
    /** The worker moves to a new state, and tells its listeners. */
    become(next: string) {
      w.state = next;
      for (const listener of [...listeners]) listener();
    },
    posted,
  };
  return w satisfies WorkerLike & { become(next: string): void; posted: unknown[] };
}

function setup({ controller = true, waiting = null as ReturnType<typeof worker> | null } = {}) {
  const regListeners: Array<() => void> = [];
  const registration = {
    waiting,
    installing: null as ReturnType<typeof worker> | null,
    addEventListener: (_type: 'updatefound', listener: () => void) => void regListeners.push(listener),
  } satisfies RegistrationLike;
  const containerListeners: Array<() => void> = [];
  const container = {
    controller: controller ? {} : null,
    addEventListener: (_type: 'controllerchange', listener: () => void) => void containerListeners.push(listener),
  } satisfies ContainerLike;
  const offered: Array<() => void> = [];
  const reload = vi.fn();
  watchForUpdate(registration, container, (apply) => offered.push(apply), reload);
  return {
    registration,
    offered,
    reload,
    /** A new version is found and starts installing. */
    found(w: ReturnType<typeof worker>) {
      registration.installing = w;
      for (const listener of [...regListeners]) listener();
    },
    /** The page is now served by another worker. */
    takeOver() {
      for (const listener of [...containerListeners]) listener();
    },
  };
}

describe('watchForUpdate', () => {
  it('offers a new version that was already waiting when the page opened', () => {
    const waiting = worker('installed');
    const t = setup({ waiting });
    expect(t.offered).toHaveLength(1);
    t.offered[0]();
    expect(waiting.posted).toEqual(['skip-waiting']);
  });

  it('offers a new version that is found and installed while the page is open', () => {
    const t = setup();
    expect(t.offered).toHaveLength(0);
    const found = worker();
    t.found(found);
    expect(t.offered).toHaveLength(0); // not yet: it is still installing
    found.become('installed');
    expect(t.offered).toHaveLength(1);
    t.offered[0]();
    expect(found.posted).toEqual(['skip-waiting']);
  });

  it('offers a version once, however often it reports', () => {
    const t = setup();
    const found = worker();
    t.found(found);
    found.become('installed');
    found.become('installed');
    expect(t.offered).toHaveLength(1);
  });

  it('offers nothing on the first visit: the first worker is not an update, it takes the page by itself', () => {
    const t = setup({ controller: false });
    const found = worker();
    t.found(found);
    found.become('installed');
    t.takeOver();
    expect(t.offered).toHaveLength(0);
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('reloads once when the new version has taken over after it was asked to, and not before', () => {
    const waiting = worker('installed');
    const t = setup({ waiting });
    t.takeOver(); // another tab applied an update: this page is not asked to reload
    expect(t.reload).not.toHaveBeenCalled();
    t.offered[0]();
    t.takeOver();
    t.takeOver();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('does not offer a worker that is redundant', () => {
    const t = setup();
    const found = worker();
    t.found(found);
    found.become('redundant');
    expect(t.offered).toHaveLength(0);
  });
});

describe('checkOnReturn', () => {
  function page() {
    const listeners: Array<() => void> = [];
    const doc = {
      visibilityState: 'hidden' as DocumentVisibilityState,
      addEventListener: (_type: 'visibilitychange', listener: () => void) => void listeners.push(listener),
    };
    const set = (state: DocumentVisibilityState) => {
      doc.visibilityState = state;
      for (const listener of listeners) listener();
    };
    return { doc, show: () => set('visible'), hide: () => set('hidden') };
  }

  it('asks the browser to look for a new version whenever the page comes back to the front, so a page left open for days finds one', () => {
    const update = vi.fn(() => Promise.resolve());
    const p = page();
    checkOnReturn({ update }, p.doc);
    p.hide();
    expect(update).not.toHaveBeenCalled();
    p.show();
    expect(update).toHaveBeenCalledTimes(1);
    p.hide();
    p.show();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('does not break when the check fails (no network)', async () => {
    const update = vi.fn(() => Promise.reject(new Error('offline')));
    const p = page();
    checkOnReturn({ update }, p.doc);
    expect(() => p.show()).not.toThrow();
    await Promise.resolve();
  });
});
