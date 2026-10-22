import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, NAV_ITEMS, RAIL_QUERY, navIdForView } from '../nav/navItems';
import { MENU_TILES } from '../menu/mainMenu';
import { VIEWS, isView } from '../app/router';
import { ICON_PATHS } from '../ui/icons';
import { en } from '../i18n/locales/en';
import { fa } from '../i18n/locales/fa';

describe('the items of the side rail', () => {
  it('are the seventeen places of the app: home, today and every tile of the home screen except Settings', () => {
    expect(NAV_ITEMS).toHaveLength(17);
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(17);
    expect(ids).toContain('home');
    expect(ids).toContain('today');
    for (const tile of MENU_TILES.filter((t) => t.id !== 'settings')) expect(ids, tile.id).toContain(tile.id);
    expect(ids).not.toContain('settings'); // Settings is a button at the foot of the rail, with the quick buttons
  });

  it('come in four groups, in the order of the rail, each group with a name in both languages', () => {
    expect(NAV_GROUPS).toEqual(['start', 'learn', 'play', 'tools']);
    const seen: string[] = [];
    for (const item of NAV_ITEMS) if (seen[seen.length - 1] !== item.group) seen.push(item.group);
    expect(seen).toEqual([...NAV_GROUPS]);
    for (const group of NAV_GROUPS) {
      expect(`nav.group.${group}` in en).toBe(true);
      expect(`nav.group.${group}` in fa).toBe(true);
    }
  });

  it('open a screen of the app, except the metronome, which opens its own window', () => {
    for (const item of NAV_ITEMS) {
      if ('view' in item.target) expect(isView(item.target.view), item.id).toBe(true);
      else expect(item.id).toBe('metronome');
    }
    expect(NAV_ITEMS.find((i) => i.id === 'metronome')!.target).toEqual({ action: 'metronome' });
  });

  it('have an icon and a name in English and Persian', () => {
    for (const item of NAV_ITEMS) {
      expect(ICON_PATHS[item.icon], item.id).toBeTruthy();
      expect(item.label in en, `${item.id} in English`).toBe(true);
      expect(item.label in fa, `${item.id} in Persian`).toBe(true);
    }
  });

  it('use the names of the home screen tiles, so a place has one name everywhere', () => {
    for (const tile of MENU_TILES.filter((t) => t.id !== 'settings')) expect(NAV_ITEMS.find((i) => i.id === tile.id)!.label).toBe(tile.title);
  });
});

describe('navIdForView', () => {
  it('finds the item of every screen, so one is always the current one', () => {
    const ids = new Set(NAV_ITEMS.map((i) => i.id));
    for (const view of VIEWS) expect(ids.has(navIdForView(view)!), view).toBe(true);
  });

  it('puts a song being practised and the song maker under Songs', () => {
    expect(navIdForView('practice')).toBe('songs');
    expect(navIdForView('maker')).toBe('songs');
    expect(navIdForView('home')).toBe('home');
    expect(navIdForView('learn')).toBe('learn');
    expect(navIdForView('generator')).toBe('generator');
    expect(navIdForView('levels')).toBe('levels');
  });
});

describe('RAIL_QUERY', () => {
  it('asks for a screen that is wide and tall enough: a phone, and a laptop turned very short, get the drawer', () => {
    expect(RAIL_QUERY).toBe('(min-width: 768px) and (min-height: 560px)');
  });
});
