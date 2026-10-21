import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MainMenu, MENU_TILES } from '../menu/mainMenu';
import { initLocale, setLocale, t } from '../i18n';
import type { View } from '../app/router';

function setup(level = '3b') {
  const navigate = vi.fn<(view: View) => void>();
  const openSettings = vi.fn();
  const openMetronome = vi.fn();
  const resume = { view: 'levels' as View, title: 'Level 3b', detail: 'Quarter notes (RH)' };
  const menu = new MainMenu({
    navigate,
    openSettings,
    openMetronome,
    levelLabel: () => level,
    resume: () => resume,
    lessonsProgress: () => ({ read: 3, total: 36 }),
  });
  document.body.replaceChildren(menu.element);
  const tile = (id: string) => menu.element.querySelector<HTMLButtonElement>(`[data-tile="${id}"]`)!;
  return { menu, navigate, openSettings, openMetronome, tile, resume };
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
      expect(tile(def.id).querySelector('.menu-tile-icon')!.getElementsByTagName('path')[0].getAttribute('d')).toBeTruthy();
    }
  });

  it('offers lessons, the quiz, levels, songs and the tools', () => {
    const ids = MENU_TILES.map((tileDef) => tileDef.id);
    expect(ids).toEqual(expect.arrayContaining(['lessons', 'learn', 'ear', 'scales', 'chords', 'rhythm', 'persian', 'levels', 'songs', 'catalog', 'generator', 'tuner', 'xylophone', 'metronome', 'progress', 'settings']));
  });

  it('keeps the lessons apart from the quiz', () => {
    const { tile } = setup();
    expect(tile('lessons').querySelector('.menu-tile-title')!.textContent).toBe('Lessons');
    expect(tile('learn').querySelector('.menu-tile-title')!.textContent).toBe('Note quiz');
  });

  it('tells how many lessons were read', () => {
    const { tile } = setup();
    expect(tile('lessons').querySelector('.menu-tile-desc')!.textContent).toContain('3 of 36');
  });

  it('tells which level the player is on', () => {
    const { tile } = setup('3b');
    expect(tile('levels').querySelector('.menu-tile-desc')!.textContent).toContain('3b');
  });

  it('opens the screen of a tile when it is pressed', () => {
    const { tile, navigate } = setup();
    tile('lessons').click();
    tile('learn').click();
    tile('levels').click();
    tile('songs').click();
    tile('catalog').click();
    tile('xylophone').click();
    tile('progress').click();
    expect(navigate.mock.calls.map(([view]) => view)).toEqual(['lessons', 'learn', 'levels', 'songs', 'catalog', 'xylophone', 'progress']);
  });

  it('opens the settings instead of a screen for the settings tile', () => {
    const { tile, navigate, openSettings } = setup();
    tile('settings').click();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the floating metronome instead of a screen for the metronome tile', () => {
    const { tile, navigate, openMetronome, openSettings } = setup();
    tile('metronome').click();
    expect(openMetronome).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();
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

  it('shows where you left off on a sheet of its own, and continues there', () => {
    const { menu, navigate } = setup();
    const card = menu.element.querySelector<HTMLButtonElement>('.menu-resume')!;
    expect(card.querySelector('.menu-resume-title')!.textContent).toBe('Level 3b');
    expect(card.querySelector('.menu-resume-detail')!.textContent).toBe('Quarter notes (RH)');
    expect(card.querySelector('.menu-resume-go')!.textContent).toBe('Continue');
    card.click();
    expect(navigate).toHaveBeenCalledWith('levels');
  });

  it('shows the extra strip (the rank and goal) under the subtitle', () => {
    const extra = document.createElement('div');
    extra.className = 'game-hud';
    const menu = new MainMenu({
      navigate: () => {},
      openSettings: () => {},
      openMetronome: () => {},
      levelLabel: () => '1a',
      resume: () => ({ view: 'levels', title: 'Level 1a', detail: '' }),
      extra,
    });
    expect(menu.element.querySelector('.menu-header .game-hud')).toBe(extra);
  });

  it('is not counted among the tiles', () => {
    const { menu } = setup();
    expect(menu.element.querySelectorAll('.menu-tile')).toHaveLength(MENU_TILES.length);
  });

  it('puts the ways to learn and practise apart from the tools', () => {
    const { menu } = setup();
    const paths = Array.from(menu.element.querySelectorAll<HTMLElement>('.menu-paths [data-tile]')).map((b) => b.dataset.tile);
    const tools = Array.from(menu.element.querySelectorAll<HTMLElement>('.menu-tools [data-tile]')).map((b) => b.dataset.tile);
    expect(paths).toEqual(['lessons', 'learn', 'ear', 'scales', 'chords', 'rhythm', 'persian', 'levels', 'songs']);
    expect(tools).toEqual(['catalog', 'tuner', 'generator', 'xylophone', 'metronome', 'progress', 'settings']);
  });

  it('continues into a song when that is where you were', () => {
    const navigate = vi.fn<(view: View) => void>();
    const menu = new MainMenu({
      navigate,
      openSettings: () => {},
      openMetronome: () => {},
      levelLabel: () => '1a',
      resume: () => ({ view: 'practice', title: 'Frère Jacques', detail: 'Step 3 of 19' }),
    });
    menu.element.querySelector<HTMLButtonElement>('.menu-resume')!.click();
    expect(navigate).toHaveBeenCalledWith('practice');
  });

  it('writes the texts again in the new language and level on refresh()', () => {
    let level = '1a';
    const menu = new MainMenu({
      navigate: () => {},
      openSettings: () => {},
      openMetronome: () => {},
      levelLabel: () => level,
      resume: () => ({ view: 'practice', title: 'مری', detail: 'مرحله ۲' }),
    });
    document.body.replaceChildren(menu.element);
    setLocale('fa');
    level = '۴c';
    menu.refresh();
    expect(menu.element.querySelector('h1')!.textContent).toBe('مربی نت‌خوانی');
    expect(menu.element.querySelector('[data-tile="songs"] .menu-tile-title')!.textContent).toBe('آهنگ‌ها');
    expect(menu.element.querySelector('[data-tile="levels"] .menu-tile-desc')!.textContent).toContain('۴c');
    expect(menu.element.querySelector('.menu-resume-go')!.textContent).toBe('ادامه');
    expect(menu.element.querySelector('.menu-resume-title')!.textContent).toBe('مری');
  });
});
