import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MainMenu, MENU_TILES } from '../menu/mainMenu';
import { initLocale, setLocale, t } from '../i18n';
import type { View } from '../app/router';

function setup(level = '3b') {
  const navigate = vi.fn<(view: View) => void>();
  const openSettings = vi.fn();
  const menu = new MainMenu({ navigate, openSettings, levelLabel: () => level });
  document.body.replaceChildren(menu.element);
  const tile = (id: string) => menu.element.querySelector<HTMLButtonElement>(`[data-tile="${id}"]`)!;
  return { menu, navigate, openSettings, tile };
}

describe('MainMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    initLocale();
  });

  it('is the home screen section', () => {
    const { menu } = setup();
    expect(menu.element.id).toBe('mainMenu');
    expect(menu.element.dataset.views).toBe('home');
  });

  it('shows a title and a subtitle', () => {
    const { menu } = setup();
    expect(menu.element.querySelector('h1')!.textContent).toBe('Music Notes Trainer');
    expect(menu.element.querySelector('.menu-subtitle')!.textContent).toBe(t('menu.subtitle'));
  });

  it('has one button per tile, each with a title and a description', () => {
    const { menu, tile } = setup();
    expect(menu.element.querySelectorAll('button.menu-tile')).toHaveLength(MENU_TILES.length);
    for (const def of MENU_TILES) {
      expect(tile(def.id).querySelector('.menu-tile-title')!.textContent).toBe(t(def.title));
      expect(tile(def.id).querySelector('.menu-tile-desc')!.textContent).not.toBe('');
      expect(tile(def.id).querySelector('.menu-tile-icon')!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('offers learning, levels, songs and settings', () => {
    const ids = MENU_TILES.map((tileDef) => tileDef.id);
    expect(ids).toEqual(expect.arrayContaining(['learn', 'levels', 'songs', 'settings']));
  });

  it('tells which level the player is on', () => {
    const { tile } = setup('3b');
    expect(tile('levels').querySelector('.menu-tile-desc')!.textContent).toContain('3b');
  });

  it('opens the screen of a tile when it is pressed', () => {
    const { tile, navigate } = setup();
    tile('learn').click();
    tile('levels').click();
    tile('songs').click();
    expect(navigate.mock.calls.map(([view]) => view)).toEqual(['learn', 'levels', 'songs']);
  });

  it('opens the settings instead of a screen for the settings tile', () => {
    const { tile, navigate, openSettings } = setup();
    tile('settings').click();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not let the settings click reach the page, which closes the panel on outside clicks', () => {
    const { tile } = setup();
    const outside = vi.fn();
    document.addEventListener('click', outside);
    tile('settings').click();
    tile('levels').click();
    document.removeEventListener('click', outside);
    expect(outside).toHaveBeenCalledTimes(1); // only the levels tile bubbled
  });

  it('writes the texts again in the new language and level on refresh()', () => {
    let level = '1a';
    const menu = new MainMenu({ navigate: () => {}, openSettings: () => {}, levelLabel: () => level });
    document.body.replaceChildren(menu.element);
    setLocale('fa');
    level = '۴c';
    menu.refresh();
    expect(menu.element.querySelector('h1')!.textContent).toBe('مربی نت‌خوانی');
    expect(menu.element.querySelector('[data-tile="songs"] .menu-tile-title')!.textContent).toBe('آهنگ‌ها');
    expect(menu.element.querySelector('[data-tile="levels"] .menu-tile-desc')!.textContent).toContain('۴c');
  });
});
