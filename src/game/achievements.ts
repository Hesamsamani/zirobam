import type { MessageKey } from '../i18n';

export type BadgeId =
  | 'first-note'
  | 'combo-10'
  | 'correct-100'
  | 'lessons-5'
  | 'lessons'
  | 'stage-3'
  | 'stage-5'
  | 'level-5'
  | 'level-10'
  | 'first-song'
  | 'beginner-songs'
  | 'xylo-first'
  | 'xylo-3stars'
  | 'ear-25'
  | 'chords-25'
  | 'scales-5'
  | 'goal-first'
  | 'streak-3'
  | 'streak-7';

export type BadgeIcon = 'note' | 'flame' | 'star' | 'book' | 'bars' | 'target' | 'crown' | 'clef';

/** What the badges are judged on. */
export interface BadgeContext {
  counters: {
    correct: number;
    bestCombo: number;
    maxLevel: number;
    maxStage: number;
    songsFinished: number;
    xyloSongs: number;
    xyloThreeStars: number;
    earCorrect: number;
    chordsCorrect: number;
    scalesPlayed: number;
    lessonsRead: number;
    lessonsTotal: number;
  };
  finishedSongIds: readonly string[];
  beginnerSongIds: readonly string[];
  daysGoalMet: number;
  streak: number;
}

export interface Badge {
  id: BadgeId;
  title: MessageKey;
  desc: MessageKey;
  icon: BadgeIcon;
  earned(ctx: BadgeContext): boolean;
}

export const BADGES: readonly Badge[] = [
  { id: 'first-note', title: 'badge.firstNote.title', desc: 'badge.firstNote.desc', icon: 'note', earned: (c) => c.counters.correct >= 1 },
  { id: 'combo-10', title: 'badge.combo10.title', desc: 'badge.combo10.desc', icon: 'flame', earned: (c) => c.counters.bestCombo >= 10 },
  { id: 'correct-100', title: 'badge.correct100.title', desc: 'badge.correct100.desc', icon: 'target', earned: (c) => c.counters.correct >= 100 },
  { id: 'lessons-5', title: 'badge.lessons5.title', desc: 'badge.lessons5.desc', icon: 'book', earned: (c) => c.counters.lessonsRead >= 5 },
  {
    id: 'lessons',
    title: 'badge.lessons.title',
    desc: 'badge.lessons.desc',
    icon: 'book',
    earned: (c) => c.counters.lessonsTotal > 0 && c.counters.lessonsRead >= c.counters.lessonsTotal,
  },
  { id: 'stage-3', title: 'badge.stage3.title', desc: 'badge.stage3.desc', icon: 'clef', earned: (c) => c.counters.maxStage >= 3 },
  { id: 'stage-5', title: 'badge.stage5.title', desc: 'badge.stage5.desc', icon: 'crown', earned: (c) => c.counters.maxStage >= 5 },
  { id: 'level-5', title: 'badge.level5.title', desc: 'badge.level5.desc', icon: 'star', earned: (c) => c.counters.maxLevel >= 5 },
  { id: 'level-10', title: 'badge.level10.title', desc: 'badge.level10.desc', icon: 'crown', earned: (c) => c.counters.maxLevel >= 10 },
  { id: 'first-song', title: 'badge.firstSong.title', desc: 'badge.firstSong.desc', icon: 'note', earned: (c) => c.counters.songsFinished >= 1 },
  {
    id: 'beginner-songs',
    title: 'badge.beginnerSongs.title',
    desc: 'badge.beginnerSongs.desc',
    icon: 'book',
    earned: (c) => c.beginnerSongIds.length > 0 && c.beginnerSongIds.every((id) => c.finishedSongIds.includes(id)),
  },
  { id: 'xylo-first', title: 'badge.xyloFirst.title', desc: 'badge.xyloFirst.desc', icon: 'bars', earned: (c) => c.counters.xyloSongs >= 1 },
  { id: 'xylo-3stars', title: 'badge.xylo3.title', desc: 'badge.xylo3.desc', icon: 'star', earned: (c) => c.counters.xyloThreeStars >= 1 },
  { id: 'ear-25', title: 'badge.ear.title', desc: 'badge.ear.desc', icon: 'note', earned: (c) => c.counters.earCorrect >= 25 },
  { id: 'chords-25', title: 'badge.chords.title', desc: 'badge.chords.desc', icon: 'bars', earned: (c) => c.counters.chordsCorrect >= 25 },
  { id: 'scales-5', title: 'badge.scales.title', desc: 'badge.scales.desc', icon: 'bars', earned: (c) => c.counters.scalesPlayed >= 5 },
  { id: 'goal-first', title: 'badge.goalFirst.title', desc: 'badge.goalFirst.desc', icon: 'target', earned: (c) => c.daysGoalMet >= 1 },
  { id: 'streak-3', title: 'badge.streak3.title', desc: 'badge.streak3.desc', icon: 'flame', earned: (c) => c.streak >= 3 },
  { id: 'streak-7', title: 'badge.streak7.title', desc: 'badge.streak7.desc', icon: 'flame', earned: (c) => c.streak >= 7 },
];

export const BADGE_IDS: readonly BadgeId[] = BADGES.map((b) => b.id);

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === 'string' && (BADGE_IDS as readonly string[]).includes(value);
}
