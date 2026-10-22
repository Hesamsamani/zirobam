import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { formatRoute } from '../app/router';
import { SideNav, type SideNavDeps } from '../nav/sideNav';

/** A device that can change: `set(true)` is a wide, tall screen (the rail), `set(false)` a phone (the drawer). */
function device(rail: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const query = {
    matches: rail,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
  } as unknown as MediaQueryList;
  return {
    matchMedia: vi.fn(() => query),
    set(matches: boolean) {
      (query as unknown as { matches: boolean }).matches = matches;
      for (const listener of [...listeners]) listener({ matches });
    },
  };
}

let theme: 'dark' | 'light';
let locale: 'en' | 'fa';
let nav: SideNav;
let calls: { metronome: Mock<() => void>; settings: Mock<(opener: HTMLElement) => void>; language: Mock<() => void>; theme: Mock<() => void> };

function make(rail: boolean, overrides: Partial<SideNavDeps> = {}) {
  const dev = device(rail);
  calls = { metronome: vi.fn<() => void>(), settings: vi.fn<(opener: HTMLElement) => void>(), language: vi.fn<() => void>(), theme: vi.fn<() => void>() };
  nav = new SideNav({
    matchMedia: dev.matchMedia,
    hrefOf: formatRoute,
    openMetronome: calls.metronome,
    toggleSettings: calls.settings,
    toggleLanguage: () => {
      calls.language();
      locale = locale === 'en' ? 'fa' : 'en';
      setLocale(locale);
      nav.refresh();
    },
    toggleTheme: () => {
      calls.theme();
      theme = theme === 'dark' ? 'light' : 'dark';
      nav.refresh();
    },
    locale: () => locale,
    theme: () => theme,
    ...overrides,
  });
  nav.mount();
  return dev;
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const item = (id: string) => $<HTMLElement>(`[data-nav="${id}"]`);
const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

beforeEach(() => {
  initLocale();
  setLocale('en');
  locale = 'en';
  theme = 'dark';
  document.documentElement.removeAttribute('dir');
  document.body.removeAttribute('data-nav');
  document.body.className = '';
  document.body.replaceChildren();
  const app = document.createElement('div');
  app.id = 'app';
  const heading = document.createElement('h1');
  heading.textContent = 'A screen';
  const hidden = document.createElement('section');
  hidden.className = 'view-hidden';
  const hiddenHeading = document.createElement('h1');
  hiddenHeading.textContent = 'Not this one';
  hidden.append(hiddenHeading);
  app.append(hidden, heading);
  document.body.append(app);
});

afterEach(() => nav.destroy());

describe('the structure of the rail', () => {
  it('is a navigation with a name, and seventeen places in four named groups', () => {
    make(true);
    const element = $('#sideNav');
    expect(element.tagName).toBe('NAV');
    expect(element.getAttribute('aria-label')).toBe('Main navigation');
    expect(all('#sideNav [data-nav]')).toHaveLength(17);
    const groups = all('.nav-group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Start', 'Learn', 'Play', 'Tools']);
    expect(groups.every((g) => g.getAttribute('role') === 'group')).toBe(true);
  });

  it('opens the screens as links with their own addresses, and the metronome as a button', () => {
    make(true);
    expect(item('lessons').tagName).toBe('A');
    expect(item('lessons').getAttribute('href')).toBe('#/lessons');
    expect(item('home').getAttribute('href')).toBe('#/');
    expect(item('metronome').tagName).toBe('BUTTON');
    item('metronome').click();
    expect(calls.metronome).toHaveBeenCalledTimes(1);
  });

  it('keeps every name in the page while the rail is narrow, so a screen reader hears it', () => {
    make(true);
    expect(item('ear').textContent).toContain('Ear training');
    expect(item('ear').querySelector('.nav-label')!.textContent).toBe('Ear training');
  });

  it('puts Settings and the two quick buttons at the foot, and never among the places', () => {
    make(true);
    expect(all('.nav-foot > *')).toHaveLength(3);
    expect(document.querySelector('[data-nav="settings"]')).toBeNull();
    const settings = $('.nav-foot [data-nav-action="settings"]');
    expect(settings.getAttribute('aria-controls')).toBe('optionsPanel');
    expect(settings.getAttribute('aria-expanded')).toBe('false');
    settings.click();
    expect(calls.settings).toHaveBeenCalledWith(settings);
  });

  it('does not use the hooks of the home screen tiles, which other tests look up without a scope', () => {
    make(true);
    expect(all('#sideNav [data-tile]')).toHaveLength(0);
    expect(all('#sideNav .menu-tile')).toHaveLength(0);
  });
});

describe('the current place', () => {
  it('is marked with aria-current on exactly one item, and follows the screen', () => {
    make(true);
    nav.setCurrent('lessons');
    expect(all('[aria-current="page"]')).toEqual([item('lessons')]);
    nav.setCurrent('ear');
    expect(all('[aria-current="page"]')).toEqual([item('ear')]);
  });

  it('puts a song being practised and the song maker under Songs', () => {
    make(true);
    nav.setCurrent('practice');
    expect(all('[aria-current="page"]')).toEqual([item('songs')]);
    nav.setCurrent('maker');
    expect(all('[aria-current="page"]')).toEqual([item('songs')]);
  });
});

describe('a list that is longer than the screen', () => {
  /** Gives the scrolling part of the rail a size, since jsdom has no layout. */
  function size(scrollTop: number, clientHeight: number, scrollHeight: number) {
    const list = $('.nav-scroll');
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: clientHeight });
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight });
    list.scrollTop = scrollTop;
    list.dispatchEvent(new Event('scroll'));
    return list;
  }

  it('says which edge has more behind it, so the list can fade there', () => {
    make(true);
    expect($('.nav-scroll').dataset.fade).toBe('none'); // everything fits
    expect(size(0, 400, 750).dataset.fade).toBe('bottom');
    expect(size(150, 400, 750).dataset.fade).toBe('both');
    expect(size(350, 400, 750).dataset.fade).toBe('top');
    expect(size(0, 400, 400).dataset.fade).toBe('none');
  });

  /** The list shows y 100 to 500; the item is where the test says. */
  function place(top: number, bottom: number, scrollTop: number) {
    const list = $('.nav-scroll');
    list.getBoundingClientRect = () => ({ top: 100, bottom: 500, height: 400 }) as DOMRect;
    item('lessons').getBoundingClientRect = () => ({ top, bottom, height: bottom - top }) as DOMRect;
    list.scrollTop = scrollTop;
    return list;
  }

  it('keeps the current place in view: it scrolls the list down for a place below it, and up for one above it', () => {
    make(true);
    const below = place(520, 560, 0);
    nav.setCurrent('lessons');
    expect(below.scrollTop).toBe(68); // the part below the list, and a little room
    const above = place(60, 100, 200);
    nav.setCurrent('lessons');
    expect(above.scrollTop).toBe(200 - 48);
  });

  it('leaves the list alone when the place is in view, and does not use scrollIntoView, which would move the starting point of Tab', () => {
    make(true);
    const scrollIntoView = vi.fn();
    item('lessons').scrollIntoView = scrollIntoView;
    const list = place(200, 244, 30);
    nav.setCurrent('lessons');
    expect(list.scrollTop).toBe(30);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('the quick buttons', () => {
  it('shows the other language by its own name, in its own language, and switches to it', () => {
    make(true);
    const button = $('.nav-foot [data-nav-action="language"]');
    expect(button.querySelector('.nav-label')!.textContent).toBe('فارسی');
    expect(button.querySelector('.nav-label')!.getAttribute('lang')).toBe('fa');
    expect(button.getAttribute('title')).toBe('Switch the language to Persian');
    button.click();
    expect(calls.language).toHaveBeenCalledTimes(1);
    expect(button.querySelector('.nav-label')!.textContent).toBe('English');
    expect(button.querySelector('.nav-label')!.getAttribute('lang')).toBe('en');
    expect(button.getAttribute('title')).toBe('تغییر زبان به انگلیسی'); // the page is in Persian now, and the hint is too
  });

  it('offers the theme it would switch to, with the icon of that theme', () => {
    make(true);
    const button = $('.nav-foot [data-nav-action="theme"]');
    expect(button.querySelector('.nav-label')!.textContent).toBe('Light theme');
    expect(button.dataset.next).toBe('light');
    button.click();
    expect(calls.theme).toHaveBeenCalledTimes(1);
    expect(button.querySelector('.nav-label')!.textContent).toBe('Dark theme');
    expect(button.dataset.next).toBe('dark');
  });

  it('is in Persian when the language is, groups and all', () => {
    make(true);
    setLocale('fa');
    locale = 'fa';
    nav.refresh();
    expect($('#sideNav').getAttribute('aria-label')).toBe('پیمایش اصلی');
    expect(item('home').textContent).toContain('خانه');
    expect(all('.nav-group').map((g) => g.getAttribute('aria-label'))).toEqual(['شروع', 'یادگیری', 'نواختن', 'ابزارها']);
    expect($('.nav-foot [data-nav-action="language"] .nav-label').textContent).toBe('English');
    expect($('.nav-foot [data-nav-action="theme"] .nav-label').textContent).toBe('حالت روشن');
  });
});

describe('the two ways to show it', () => {
  it('is a rail on a wide, tall screen: the rail is in reach, the handle is not there', () => {
    make(true);
    expect(nav.mode()).toBe('rail');
    expect(document.body.dataset.nav).toBe('rail');
    expect($('#sideNav').hasAttribute('inert')).toBe(false);
    expect(nav.handle.hidden).toBe(true);
  });

  it('is a drawer on a phone: out of reach (and out of the tab order) until it is opened, with a handle at the edge', () => {
    make(false);
    expect(nav.mode()).toBe('drawer');
    expect(document.body.dataset.nav).toBe('drawer');
    expect($('#sideNav').hasAttribute('inert')).toBe(true);
    expect(nav.handle.hidden).toBe(false);
    expect(nav.handle.getAttribute('aria-expanded')).toBe('false');
    expect(nav.handle.getAttribute('aria-label')).toBe('Open the menu');
  });

  it('changes with the device', () => {
    const dev = make(true);
    dev.set(false);
    expect(document.body.dataset.nav).toBe('drawer');
    dev.set(true);
    expect(document.body.dataset.nav).toBe('rail');
  });

  it('tells floating things how much room it takes at each side, which turns round for Persian', () => {
    const dev = make(true);
    expect(nav.reservedInsets()).toEqual({ left: 88, right: 0 });
    document.documentElement.dir = 'rtl';
    expect(nav.reservedInsets()).toEqual({ left: 0, right: 88 });
    dev.set(false);
    expect(nav.reservedInsets()).toEqual({ left: 0, right: 0 });
  });

  it('can be pinned open to show its names, and says so', () => {
    make(true);
    const brand = $('.nav-brand');
    expect(brand.getAttribute('aria-expanded')).toBe('false');
    expect(brand.getAttribute('aria-label')).toBe('Show the names');
    brand.click();
    expect($('#sideNav').dataset.pinned).toBe('true');
    expect(brand.getAttribute('aria-expanded')).toBe('true');
    expect(brand.getAttribute('aria-label')).toBe('Hide the names');
    brand.click();
    expect($('#sideNav').dataset.pinned).toBe('false');
  });
});

describe('the drawer', () => {
  it('opens from the handle: the places are in reach, the page behind is not, and the focus goes to the current place', () => {
    make(false);
    nav.setCurrent('ear');
    nav.handle.click();
    expect(nav.isDrawerOpen()).toBe(true);
    expect($('#sideNav').hasAttribute('inert')).toBe(false);
    expect($('#sideNav').dataset.open).toBe('true');
    expect(nav.scrim.hidden).toBe(false);
    expect($('#app').hasAttribute('inert')).toBe(true);
    expect(document.body.classList.contains('nav-locked')).toBe(true);
    expect(nav.handle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item('ear'));
  });

  it('puts the focus on the first place when there is no current one', () => {
    make(false);
    nav.handle.click();
    expect(document.activeElement).toBe(item('home'));
  });

  it('closes with Escape and gives the focus back to the handle', () => {
    make(false);
    nav.handle.click();
    press('Escape');
    expect(nav.isDrawerOpen()).toBe(false);
    expect($('#sideNav').hasAttribute('inert')).toBe(true);
    expect($('#app').hasAttribute('inert')).toBe(false);
    expect(document.body.classList.contains('nav-locked')).toBe(false);
    expect(nav.scrim.hidden).toBe(true);
    expect(document.activeElement).toBe(nav.handle);
  });

  it('closes on the scrim, with the brand button, and when a place is chosen', () => {
    make(false);
    nav.handle.click();
    nav.scrim.click();
    expect(nav.isDrawerOpen()).toBe(false);
    nav.handle.click();
    $('.nav-brand').click();
    expect(nav.isDrawerOpen()).toBe(false);
    nav.handle.click();
    item('lessons').addEventListener('click', (e) => e.preventDefault()); // do not leave the test page
    item('lessons').click();
    expect(nav.isDrawerOpen()).toBe(false);
  });

  it('closes when Settings is chosen, so the panel can be seen', () => {
    make(false);
    nav.handle.click();
    $('.nav-foot [data-nav-action="settings"]').click();
    expect(calls.settings).toHaveBeenCalledTimes(1);
    expect(nav.isDrawerOpen()).toBe(false);
  });

  it('closes by itself when the screen becomes wide enough for the rail', () => {
    const dev = make(false);
    nav.handle.click();
    dev.set(true);
    expect(nav.isDrawerOpen()).toBe(false);
    expect($('#app').hasAttribute('inert')).toBe(false);
    expect($('#sideNav').hasAttribute('inert')).toBe(false);
    expect(document.body.classList.contains('nav-locked')).toBe(false);
  });

  it('does not open as a rail', () => {
    make(true);
    nav.openDrawer();
    expect(nav.isDrawerOpen()).toBe(false);
  });

  it('keeps the quick buttons in reach while the drawer is open', () => {
    make(false);
    nav.handle.click();
    $('.nav-foot [data-nav-action="theme"]').click();
    expect(calls.theme).toHaveBeenCalledTimes(1);
    expect(nav.isDrawerOpen()).toBe(true); // changing the theme or the language is no reason to close it
  });
});

describe('skip to the content', () => {
  it('finds the h2 of a screen that has no h1, and leaves the rail itself and the settings alone', () => {
    make(true);
    document.querySelector('#app h1:not(.x)')!.closest('#app')!.querySelectorAll('h1').forEach((h) => h.remove());
    const title = document.createElement('h2');
    title.textContent = 'Lessons';
    document.querySelector('#app')!.append(title);
    $('.nav-skip').click();
    expect(document.activeElement).toBe(title);
  });

  it('moves the focus to the heading of the screen that is shown, not to one that is hidden', () => {
    make(true);
    $('.nav-skip').click();
    expect(document.activeElement!.textContent).toBe('A screen');
  });
});
