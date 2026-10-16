import { describe, it, expect, beforeEach } from 'vitest';
import { Router, type View } from '../app/router';
import { AppShell } from '../app/shell';

function fakeWindow(initialHash = '') {
  const listeners = new Set<() => void>();
  const win = {
    location: { hash: initialHash },
    addEventListener: (_type: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => void listeners.delete(fn),
  };
  return { win, changeHash: (hash: string) => { win.location.hash = hash; listeners.forEach((fn) => fn()); } };
}

function section(id: string, views: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.dataset.views = views;
  document.body.appendChild(el);
  return el;
}

describe('AppShell', () => {
  let stand: HTMLElement;
  let menu: HTMLElement;
  let xylophone: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    delete document.body.dataset.view;
    menu = section('menu', 'home');
    stand = section('stand', 'levels practice learn');
    xylophone = section('xylo', 'xylophone');
  });

  const hidden = (el: HTMLElement) => el.classList.contains('view-hidden');

  it('shows only the sections that list the current view', () => {
    const { win } = fakeWindow('#/levels');
    new AppShell(new Router(win)).start();
    expect(hidden(menu)).toBe(true);
    expect(hidden(stand)).toBe(false);
    expect(hidden(xylophone)).toBe(true);
    expect(document.body.dataset.view).toBe('levels');
  });

  it('starts on the home screen without an address', () => {
    const { win } = fakeWindow();
    new AppShell(new Router(win)).start();
    expect(hidden(menu)).toBe(false);
    expect(hidden(stand)).toBe(true);
    expect(document.body.dataset.view).toBe('home');
  });

  it('switches sections when navigating', () => {
    const { win } = fakeWindow();
    const shell = new AppShell(new Router(win));
    shell.start();
    shell.navigate('xylophone');
    expect(hidden(menu)).toBe(true);
    expect(hidden(xylophone)).toBe(false);
    expect(shell.current()).toBe('xylophone');
  });

  it('follows the Back button', () => {
    const { win, changeHash } = fakeWindow('#/levels');
    const shell = new AppShell(new Router(win));
    shell.start();
    changeHash('#/');
    expect(shell.current()).toBe('home');
    expect(hidden(menu)).toBe(false);
  });

  it('calls leave on the old view and enter on the new one, in that order', () => {
    const { win } = fakeWindow();
    const shell = new AppShell(new Router(win));
    const calls: string[] = [];
    shell.register('home', {
      enter: (view, previous) => calls.push(`enter ${view} from ${previous}`),
      leave: (view, next) => calls.push(`leave ${view} to ${next}`),
    });
    shell.register('songs', {
      enter: (view, previous) => calls.push(`enter ${view} from ${previous}`),
    });
    shell.start();
    shell.navigate('songs');
    expect(calls).toEqual(['enter home from null', 'leave home to songs', 'enter songs from home']);
  });

  it('runs the same hooks for several views', () => {
    const { win } = fakeWindow();
    const shell = new AppShell(new Router(win));
    const entered: View[] = [];
    shell.register(['levels', 'practice'], { enter: (view) => entered.push(view) });
    shell.start();
    shell.navigate('levels');
    shell.navigate('practice');
    expect(entered).toEqual(['levels', 'practice']);
  });

  it('shows the new section before calling enter, so the hook can measure it', () => {
    const { win } = fakeWindow();
    const shell = new AppShell(new Router(win));
    let wasHidden: boolean | null = null;
    shell.register('levels', { enter: () => (wasHidden = hidden(stand)) });
    shell.start();
    shell.navigate('levels');
    expect(wasHidden).toBe(false);
  });

  it('does not run hooks again for the same view', () => {
    const { win } = fakeWindow();
    const shell = new AppShell(new Router(win));
    const calls: string[] = [];
    shell.register('levels', { enter: () => calls.push('enter') });
    shell.start();
    shell.navigate('levels');
    shell.navigate('levels');
    expect(calls).toEqual(['enter']);
  });
});
