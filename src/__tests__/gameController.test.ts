import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { GameStore } from '../game/gameStore';
import { GameController } from '../game/gameController';
import type { ToastOptions } from '../game/toastCenter';

function setup() {
  const shown: ToastOptions[] = [];
  const xp: number[] = [];
  const toasts = {
    show: vi.fn((options: ToastOptions) => {
      shown.push(options);
      return document.createElement('div');
    }),
    showXp: vi.fn((n: number) => void xp.push(n)),
  };
  const store = new GameStore({ storage: null, now: () => new Date('2026-10-16T12:00:00'), beginnerSongIds: ['mary-lamb'] });
  const game = new GameController({ store, toasts });
  return { store, game, shown, xp };
}

beforeEach(() => {
  localStorage.clear();
  initLocale();
});

describe('GameController', () => {
  it('shows the XP a right answer earned and nothing for a wrong one', () => {
    const { game, xp } = setup();
    game.answer(true);
    game.answer(false);
    expect(xp).toEqual([2]);
  });

  it('announces a badge with its name and what it was for', () => {
    const { game, shown } = setup();
    game.answer(true);
    const badge = shown.find((s) => s.kind === 'badge')!;
    expect(badge.title).toBe('Badge earned: First note');
    expect(badge.detail).toBe('Answer your first note correctly.');
  });

  it('announces a new rank', () => {
    const { game, shown } = setup();
    for (let i = 0; i < 5; i++) game.levelPassed(1);
    const rank = shown.find((s) => s.kind === 'rank')!;
    expect(rank.title).toBe('Rank 2!');
  });

  it('announces the daily goal once', () => {
    const { game, shown } = setup();
    for (let i = 0; i < 6; i++) game.levelPassed(1);
    expect(shown.filter((s) => s.kind === 'goal')).toHaveLength(1);
  });

  it('passes each kind of event on to the store', () => {
    const { game, store } = setup();
    game.stepPassed();
    game.songFinished('mary-lamb', 3);
    game.xyloSong('twinkle', 2);
    game.lessonRead(1, 1);
    game.stage(3);
    expect(store.stats()).toMatchObject({ stepsPassed: 1, songsFinished: 1, xyloSongs: 1, maxStage: 3 });
    expect(store.totalXp()).toBe(5 + 30 + 20 + 23);
    expect(store.hasBadge('stage-3')).toBe(true);
    expect(store.hasBadge('lessons')).toBe(true);
  });

  it('returns what the event gave', () => {
    const { game } = setup();
    expect(game.answer(true).xp).toBe(2);
    expect(game.levelPassed(1).xp).toBe(10);
  });

  it('writes announcements in the current language', () => {
    setLocale('fa');
    const { game, shown } = setup();
    game.answer(true);
    expect(shown.find((s) => s.kind === 'badge')!.title).toBe('نشان تازه: نخستین نت');
  });
});
