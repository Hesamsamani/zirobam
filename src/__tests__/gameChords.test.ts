import { describe, expect, it } from 'vitest';
import { BADGES } from '../game/achievements';
import { GameStore } from '../game/gameStore';

function store() {
  const data: Record<string, string> = {};
  const storage = { getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => void (data[k] = v) };
  return { game: new GameStore({ storage, now: () => new Date('2026-10-21T12:00:00'), beginnerSongIds: [] }), storage };
}

describe('the chord quiz in the game', () => {
  it('pays 3 XP for a right chord and nothing for a wrong one, and counts only the right ones', () => {
    const { game } = store();
    expect(game.recordChordAnswer(true).xp).toBe(3);
    expect(game.recordChordAnswer(false).xp).toBe(0);
    expect(game.stats().chordsCorrect).toBe(1);
    expect(game.stats().correct).toBe(0); // the note quiz has its own count
    expect(game.stats().earCorrect).toBe(0);
  });

  it('earns the chord badge at 25 right chords', () => {
    const { game } = store();
    for (let i = 0; i < 24; i++) game.recordChordAnswer(true);
    expect(game.hasBadge('chords-25')).toBe(false);
    expect(game.recordChordAnswer(true).newBadges).toContain('chords-25');
    expect(game.hasBadge('chords-25')).toBe(true);
  });

  it('keeps the count between visits, and an old save without it starts at 0', () => {
    const { game, storage } = store();
    game.recordChordAnswer(true);
    const again = new GameStore({ storage, now: () => new Date('2026-10-21T12:00:00'), beginnerSongIds: [] });
    expect(again.stats().chordsCorrect).toBe(1);
    const old = JSON.parse(storage.getItem('game.v1')!);
    delete old.counters.chordsCorrect;
    storage.setItem('game.v1', JSON.stringify(old));
    expect(new GameStore({ storage, now: () => new Date('2026-10-21T12:00:00'), beginnerSongIds: [] }).stats().chordsCorrect).toBe(0);
  });

  it('is one of twenty two badges', () => {
    expect(BADGES).toHaveLength(22);
    expect(BADGES.map((b) => b.id)).toContain('chords-25');
  });
});

describe('the rhythm trainer in the game', () => {
  it('pays 5 XP for a piece tapped on time, counts it, and earns the badge at five', () => {
    const { game } = store();
    expect(game.recordRhythmPassed().xp).toBe(5);
    expect(game.stats().rhythmPassed).toBe(1);
    expect(game.hasBadge('rhythm-5')).toBe(false);
    for (let i = 0; i < 3; i++) game.recordRhythmPassed();
    expect(game.recordRhythmPassed().newBadges).toContain('rhythm-5');
  });
});
