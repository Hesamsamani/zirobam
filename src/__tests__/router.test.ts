import { describe, it, expect, vi } from 'vitest';
import { Router, hashQuery, parseRoute, parseLocation, formatRoute, isView, VIEWS, type View } from '../app/router';

/** The smallest window the router needs: a hash, and hashchange listeners. */
function fakeWindow(initialHash = '') {
  const listeners = new Set<() => void>();
  const win = {
    location: { hash: initialHash },
    addEventListener: (_type: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => void listeners.delete(fn),
  };
  return {
    win,
    /** What a browser does after the hash was changed by the user (Back button, a typed address). */
    changeHash(hash: string) {
      win.location.hash = hash;
      for (const fn of [...listeners]) fn();
    },
  };
}

describe('parseRoute', () => {
  it('reads each view from its hash', () => {
    for (const view of VIEWS) {
      expect(parseRoute(formatRoute(view))).toBe(view);
    }
  });

  it('treats an empty hash and the bare slash as the home screen', () => {
    expect(parseRoute('')).toBe('home');
    expect(parseRoute('#')).toBe('home');
    expect(parseRoute('#/')).toBe('home');
  });

  it('falls back to home for anything it does not know', () => {
    expect(parseRoute('#/nope')).toBe('home');
    expect(parseRoute('#/levels/extra')).toBe('home');
    expect(parseRoute('#levels')).toBe('levels');
    expect(parseRoute('#/LEVELS')).toBe('home');
    expect(parseRoute('#/<script>')).toBe('home');
  });
});

describe('parseLocation', () => {
  it('reads a lesson name after the view', () => {
    expect(parseLocation('#/lessons/note-values')).toEqual({ view: 'lessons', param: 'note-values' });
    expect(parseLocation('#/lessons')).toEqual({ view: 'lessons', param: null });
    expect(parseLocation('#lessons/staff')).toEqual({ view: 'lessons', param: 'staff' });
  });

  it('only some screens take a name; elsewhere it is not an address of the app', () => {
    expect(parseLocation('#/levels/extra')).toEqual({ view: 'home', param: null });
    expect(parseLocation('#/lessons/a/b')).toEqual({ view: 'home', param: null });
    expect(parseLocation('#/lessons/BAD NAME')).toEqual({ view: 'home', param: null });
  });

  it('ignores a query on the catalogue (it is read by the screen itself) and refuses it elsewhere', () => {
    expect(parseLocation('#/catalog?artist=Queen&level=2')).toEqual({ view: 'catalog', param: null });
    expect(parseLocation('#/levels?x=1')).toEqual({ view: 'home', param: null });
  });

  it('keeps parseRoute as the view alone', () => {
    expect(parseRoute('#/lessons/staff')).toBe('lessons');
  });
});

describe('hashQuery', () => {
  it('returns what follows the question mark', () => {
    expect(hashQuery('#/catalog?artist=Queen&level=2')).toBe('artist=Queen&level=2');
    expect(hashQuery('#/catalog?q=a?b')).toBe('q=a?b');
  });

  it('is empty without one', () => {
    expect(hashQuery('#/catalog')).toBe('');
    expect(hashQuery('')).toBe('');
    expect(hashQuery('#/catalog?')).toBe('');
  });
});

describe('formatRoute', () => {
  it('uses #/ for home and #/name for the rest', () => {
    expect(formatRoute('home')).toBe('#/');
    expect(formatRoute('levels')).toBe('#/levels');
    expect(formatRoute('xylophone')).toBe('#/xylophone');
  });

  it('adds the name of a lesson', () => {
    expect(formatRoute('lessons', 'staff')).toBe('#/lessons/staff');
    expect(formatRoute('lessons', null)).toBe('#/lessons');
  });
});

describe('isView', () => {
  it('accepts only known view names', () => {
    expect(isView('songs')).toBe(true);
    expect(isView('Songs')).toBe(false);
    expect(isView('')).toBe(false);
  });
});

describe('Router', () => {
  it('starts on the view in the address', () => {
    const { win } = fakeWindow('#/learn');
    expect(new Router(win).current()).toBe('learn');
  });

  it('tells listeners about the first view when it starts', () => {
    const { win } = fakeWindow('#/songs');
    const router = new Router(win);
    const seen: View[] = [];
    router.onChange((view) => seen.push(view));
    router.start();
    expect(seen).toEqual(['songs']);
  });

  it('changes the address and tells listeners at once when navigating', () => {
    const { win } = fakeWindow();
    const router = new Router(win);
    const seen: View[] = [];
    router.onChange((view) => seen.push(view));
    router.start();
    router.navigate('levels');
    expect(win.location.hash).toBe('#/levels');
    expect(router.current()).toBe('levels');
    expect(seen).toEqual(['home', 'levels']);
  });

  it('does not repeat the same view when the browser then fires hashchange', () => {
    const { win, changeHash } = fakeWindow();
    const router = new Router(win);
    const seen: View[] = [];
    router.onChange((view) => seen.push(view));
    router.start();
    router.navigate('levels');
    changeHash('#/levels');
    expect(seen).toEqual(['home', 'levels']);
  });

  it('follows the Back button and typed addresses', () => {
    const { win, changeHash } = fakeWindow('#/levels');
    const router = new Router(win);
    const seen: View[] = [];
    router.onChange((view) => seen.push(view));
    router.start();
    changeHash('#/xylophone');
    changeHash('#/garbage');
    expect(seen).toEqual(['levels', 'xylophone', 'home']);
  });

  it('tells listeners about the lesson name, and about a change of it on the same screen', () => {
    const { win, changeHash } = fakeWindow('#/lessons');
    const router = new Router(win);
    const seen: Array<[View, string | null]> = [];
    router.onChange((view, param) => seen.push([view, param]));
    router.start();
    router.navigate('lessons', 'staff');
    changeHash('#/lessons/clefs');
    changeHash('#/lessons/clefs');
    expect(win.location.hash).toBe('#/lessons/clefs');
    expect(router.param()).toBe('clefs');
    expect(seen).toEqual([['lessons', null], ['lessons', 'staff'], ['lessons', 'clefs']]);
  });

  it('stops telling a listener after it unsubscribed', () => {
    const { win } = fakeWindow();
    const router = new Router(win);
    const fn = vi.fn();
    const off = router.onChange(fn);
    router.start();
    off();
    router.navigate('songs');
    expect(fn).toHaveBeenCalledTimes(1); // only the first view
  });

  it('stops listening to the browser after stop()', () => {
    const { win, changeHash } = fakeWindow();
    const router = new Router(win);
    const fn = vi.fn();
    router.onChange(fn);
    router.start();
    router.stop();
    changeHash('#/levels');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
