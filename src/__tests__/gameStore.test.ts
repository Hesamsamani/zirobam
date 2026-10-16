import { describe, it, expect } from 'vitest';
import { GameStore, levelForXp, xpForLevel, practiceStars, dayKey } from '../game/gameStore';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function storeAt(date: string, storage = fakeStorage(), beginner: string[] = ['mary-lamb', 'twinkle']) {
  let current = new Date(`${date}T12:00:00`);
  const store = new GameStore({ storage, now: () => current, beginnerSongIds: beginner });
  return { store, storage, setDate: (d: string) => (current = new Date(`${d}T12:00:00`)) };
}

describe('levels from XP', () => {
  it('needs 50 more XP for each level than for the one before', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(3)).toBe(150);
    expect(xpForLevel(4)).toBe(300);
  });

  it('finds the level and the progress inside it', () => {
    expect(levelForXp(0)).toEqual({ level: 1, into: 0, needed: 50 });
    expect(levelForXp(49)).toEqual({ level: 1, into: 49, needed: 50 });
    expect(levelForXp(50)).toEqual({ level: 2, into: 0, needed: 100 });
    expect(levelForXp(149)).toEqual({ level: 2, into: 99, needed: 100 });
    expect(levelForXp(150).level).toBe(3);
  });

  it('treats damaged numbers as zero', () => {
    expect(levelForXp(-5).level).toBe(1);
    expect(levelForXp(NaN).level).toBe(1);
  });
});

describe('dayKey', () => {
  it('is the local date as year-month-day', () => {
    expect(dayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(dayKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});

describe('practiceStars', () => {
  it('gives three stars for a run with no repeats, fewer as repeats pile up', () => {
    expect(practiceStars(19, 0)).toBe(3);
    expect(practiceStars(19, 4)).toBe(3);
    expect(practiceStars(19, 8)).toBe(2);
    expect(practiceStars(19, 30)).toBe(1);
  });
});

describe('answers', () => {
  it('give 2 XP, one more for every 5 right answers in a row', () => {
    const { store } = storeAt('2026-10-16');
    const gains: number[] = [];
    for (let i = 0; i < 10; i++) gains.push(store.recordAnswer(true).xp);
    expect(gains).toEqual([2, 2, 2, 2, 3, 2, 2, 2, 2, 4]);
  });

  it('give nothing when wrong, and end the combo', () => {
    const { store } = storeAt('2026-10-16');
    for (let i = 0; i < 4; i++) store.recordAnswer(true);
    expect(store.combo()).toBe(4);
    const wrong = store.recordAnswer(false);
    expect(wrong.xp).toBe(0);
    expect(store.combo()).toBe(0);
    expect(store.recordAnswer(true).xp).toBe(2);
  });

  it('count correct answers and the best combo', () => {
    const { store } = storeAt('2026-10-16');
    for (let i = 0; i < 6; i++) store.recordAnswer(true);
    store.recordAnswer(false);
    for (let i = 0; i < 3; i++) store.recordAnswer(true);
    expect(store.stats().correct).toBe(9);
    expect(store.stats().bestCombo).toBe(6);
  });
});

describe('other XP', () => {
  it('is 10 for a level piece, 5 for a practice step', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordLevelPassed(1).xp).toBe(10);
    expect(store.recordStepPassed().xp).toBe(5);
    expect(store.totalXp()).toBe(15);
  });

  it('is 30 the first time a song is finished and little after that', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordSongFinished('mary-lamb', 3).xp).toBe(30);
    expect(store.recordSongFinished('mary-lamb', 3).xp).toBe(5);
    expect(store.stats().songsFinished).toBe(2);
    expect(store.songStars('mary-lamb')).toBe(3);
  });

  it('keeps the best stars of a song', () => {
    const { store } = storeAt('2026-10-16');
    store.recordSongFinished('twinkle', 3);
    store.recordSongFinished('twinkle', 1);
    expect(store.songStars('twinkle')).toBe(3);
    expect(store.songStars('unknown')).toBe(0);
  });

  it('is 10, 20 or 30 for a xylophone song, more only when the stars improve', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordXyloSong('mary-lamb', 1).xp).toBe(10);
    expect(store.recordXyloSong('mary-lamb', 3).xp).toBe(30);
    expect(store.recordXyloSong('mary-lamb', 3).xp).toBeLessThan(10);
    expect(store.stats().xyloSongs).toBe(3);
    expect(store.stats().xyloThreeStars).toBe(2);
  });

  it('is 3 for each lesson read for the first time, and 20 more for finishing the course', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordLessonRead(1, 3).xp).toBe(3);
    expect(store.recordLessonRead(2, 3).xp).toBe(3);
    expect(store.recordLessonRead(3, 3).xp).toBe(23);
    expect(store.stats().lessonsRead).toBe(3);
    expect(store.stats().lessonsTotal).toBe(3);
  });

  it('does not pay the course bonus twice', () => {
    const { store } = storeAt('2026-10-16');
    store.recordLessonRead(2, 2);
    expect(store.recordLessonRead(2, 2).xp).toBe(3);
  });

  it('earns a badge for five lessons, and another for the whole course', () => {
    const { store } = storeAt('2026-10-16');
    for (let done = 1; done <= 4; done++) store.recordLessonRead(done, 6);
    expect(store.hasBadge('lessons-5')).toBe(false);
    store.recordLessonRead(5, 6);
    expect(store.hasBadge('lessons-5')).toBe(true);
    expect(store.hasBadge('lessons')).toBe(false);
    store.recordLessonRead(6, 6);
    expect(store.hasBadge('lessons')).toBe(true);
  });

  it('asks for the whole course again when lessons are added to it', () => {
    const { store } = storeAt('2026-10-16');
    store.recordLessonRead(3, 3);
    expect(store.hasBadge('lessons')).toBe(true);
    expect(store.stats().lessonsTotal).toBe(3);
    store.recordLessonRead(3, 4);
    expect(store.stats().lessonsTotal).toBe(4);
    expect(store.recordLessonRead(4, 4).xp).toBe(23);
  });
});

describe('levels of the player', () => {
  it('tells when a level is gained', () => {
    const { store } = storeAt('2026-10-16');
    let gained: boolean[] = [];
    for (let i = 0; i < 6; i++) gained.push(store.recordLevelPassed(1).leveledUp); // 6 x 10 = 60 XP
    expect(gained).toEqual([false, false, false, false, true, false]);
    expect(store.level()).toBe(2);
    expect(store.levelProgress()).toMatchObject({ level: 2, into: 10, needed: 100 });
  });
});

describe('daily goal and streak', () => {
  it('counts the XP of today toward the goal and says when it is reached', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.goal()).toBe(50);
    expect(store.todayXp()).toBe(0);
    for (let i = 0; i < 4; i++) store.recordLevelPassed(1);
    expect(store.todayXp()).toBe(40);
    const award = store.recordLevelPassed(1);
    expect(award.goalReached).toBe(true);
    expect(store.recordLevelPassed(1).goalReached).toBe(false); // only the moment it is crossed
  });

  it('lets the player choose a goal of 20, 50 or 100', () => {
    const { store } = storeAt('2026-10-16');
    store.setGoal(20);
    expect(store.goal()).toBe(20);
    store.setGoal(33 as never);
    expect(store.goal()).toBe(20);
  });

  it('builds a streak from consecutive days that met the goal', () => {
    const { store, setDate } = storeAt('2026-10-14');
    store.setGoal(20);
    for (const day of ['2026-10-14', '2026-10-15', '2026-10-16']) {
      setDate(day);
      store.recordLevelPassed(1);
      store.recordLevelPassed(1);
    }
    expect(store.streak()).toBe(3);
  });

  it('keeps yesterday\'s streak alive until today is over', () => {
    const { store, setDate } = storeAt('2026-10-14');
    store.setGoal(20);
    for (const day of ['2026-10-14', '2026-10-15']) {
      setDate(day);
      store.recordLevelPassed(1);
      store.recordLevelPassed(1);
    }
    setDate('2026-10-16');
    expect(store.streak()).toBe(2); // today has not been played yet
    store.recordStepPassed();
    expect(store.streak()).toBe(2); // today is not at the goal yet
    store.recordLevelPassed(1);
    store.recordLevelPassed(1);
    expect(store.streak()).toBe(3);
  });

  it('breaks the streak after a missed day', () => {
    const { store, setDate } = storeAt('2026-10-10');
    store.setGoal(20);
    for (const day of ['2026-10-10', '2026-10-11']) {
      setDate(day);
      store.recordLevelPassed(1);
      store.recordLevelPassed(1);
    }
    setDate('2026-10-14');
    expect(store.streak()).toBe(0);
  });
});

describe('badges', () => {
  it('are earned once, and reported when they are', () => {
    const { store } = storeAt('2026-10-16');
    const first = store.recordAnswer(true);
    expect(first.newBadges).toContain('first-note');
    const second = store.recordAnswer(true);
    expect(second.newBadges).not.toContain('first-note');
    expect(store.hasBadge('first-note')).toBe(true);
    expect(store.badgeDate('first-note')).toBe('2026-10-16');
  });

  it('come from level, stage and song events too', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordLevelPassed(5).newBadges).toContain('level-5');
    expect(store.recordStage(3).newBadges).toContain('stage-3');
    expect(store.recordSongFinished('mary-lamb', 3).newBadges).toContain('first-song');
    expect(store.recordXyloSong('twinkle', 3).newBadges).toEqual(expect.arrayContaining(['xylo-first', 'xylo-3stars']));
  });

  it('needs every beginner song for the repertoire badge', () => {
    const { store } = storeAt('2026-10-16');
    expect(store.recordSongFinished('mary-lamb', 2).newBadges).not.toContain('beginner-songs');
    expect(store.recordSongFinished('twinkle', 2).newBadges).toContain('beginner-songs');
  });

  it('include the streak and the daily goal', () => {
    const { store } = storeAt('2026-10-16');
    store.setGoal(20);
    const award = store.recordLevelPassed(1);
    expect(award.newBadges).not.toContain('goal-first');
    expect(store.recordLevelPassed(1).newBadges).toContain('goal-first');
  });
});

describe('saving', () => {
  it('keeps everything in storage and restores it', () => {
    const storage = fakeStorage();
    const { store } = storeAt('2026-10-16', storage);
    store.setGoal(100);
    store.recordAnswer(true);
    store.recordSongFinished('mary-lamb', 2);
    const again = storeAt('2026-10-16', storage).store;
    expect(again.totalXp()).toBe(store.totalXp());
    expect(again.goal()).toBe(100);
    expect(again.songStars('mary-lamb')).toBe(2);
    expect(again.hasBadge('first-song')).toBe(true);
    expect(Object.keys(storage.data)).toEqual(['game.v1']);
  });

  it('does not keep the combo between visits', () => {
    const storage = fakeStorage();
    const { store } = storeAt('2026-10-16', storage);
    for (let i = 0; i < 3; i++) store.recordAnswer(true);
    expect(storeAt('2026-10-16', storage).store.combo()).toBe(0);
  });

  it('ignores damaged saved data', () => {
    for (const saved of ['not json', '{"version":1,"xp":"lots"}', '[]', 'null', '{"version":2}']) {
      const { store } = storeAt('2026-10-16', fakeStorage({ 'game.v1': saved }));
      expect(store.totalXp()).toBe(0);
      expect(store.goal()).toBe(50);
    }
  });

  it('clamps numbers that are out of range', () => {
    const saved = JSON.stringify({ version: 1, xp: -50, goal: 7, days: { '2026-10-16': 'x' }, counters: { correct: -3 }, badges: { 'first-note': 5, bogus: '2026-01-01' } });
    const { store } = storeAt('2026-10-16', fakeStorage({ 'game.v1': saved }));
    expect(store.totalXp()).toBe(0);
    expect(store.goal()).toBe(50);
    expect(store.stats().correct).toBe(0);
    expect(store.hasBadge('first-note')).toBe(false);
    expect(store.hasBadge('bogus' as never)).toBe(false);
  });

  it('works when storage is not available', () => {
    const store = new GameStore({ storage: null, now: () => new Date(), beginnerSongIds: [] });
    expect(store.recordAnswer(true).xp).toBe(2);
  });

  it('can start over', () => {
    const { store } = storeAt('2026-10-16');
    store.setGoal(100);
    store.recordSongFinished('mary-lamb', 3);
    store.reset();
    expect(store.totalXp()).toBe(0);
    expect(store.hasBadge('first-song')).toBe(false);
    expect(store.goal()).toBe(100); // the goal is a setting, not progress
  });

  it('tells listeners about every change', () => {
    const { store } = storeAt('2026-10-16');
    let calls = 0;
    const off = store.onChange(() => calls++);
    store.recordAnswer(true);
    store.setGoal(20);
    off();
    store.recordAnswer(true);
    expect(calls).toBe(2);
  });
});
