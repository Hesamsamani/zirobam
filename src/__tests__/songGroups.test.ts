import { describe, it, expect } from 'vitest';
import { groupSongs } from '../songs/songGroups';
import type { BuiltInSong } from '../songs';
import { BUILT_IN_SONGS } from '../songs';

const song = (id: string, difficulty: BuiltInSong['difficulty'], category?: BuiltInSong['category']): BuiltInSong => ({
  id,
  title: id,
  composer: '',
  difficulty,
  category,
  xml: '',
});

describe('groupSongs', () => {
  it('groups songs by difficulty, easiest first, and puts exercises last', () => {
    const groups = groupSongs([
      song('e1', 'easy'),
      song('x1', 'beginner', 'exercise'),
      song('b1', 'beginner'),
      song('i1', 'intermediate'),
      song('b2', 'beginner', 'nursery'),
    ]);
    expect(groups.map((g) => g.id)).toEqual(['beginner', 'easy', 'intermediate', 'exercises']);
    expect(groups[0].songs.map((s) => s.id)).toEqual(['b1', 'b2']);
    expect(groups[3].songs.map((s) => s.id)).toEqual(['x1']);
  });

  it('leaves out empty groups', () => {
    const groups = groupSongs([song('b1', 'beginner')]);
    expect(groups.map((g) => g.id)).toEqual(['beginner']);
    expect(groupSongs([])).toEqual([]);
  });

  it('keeps the order of the list inside a group', () => {
    const groups = groupSongs([song('b3', 'beginner'), song('b1', 'beginner'), song('b2', 'beginner')]);
    expect(groups[0].songs.map((s) => s.id)).toEqual(['b3', 'b1', 'b2']);
  });

  it('puts every built-in song in exactly one group', () => {
    const ids = groupSongs(BUILT_IN_SONGS).flatMap((g) => g.songs.map((s) => s.id));
    expect(ids.sort()).toEqual(BUILT_IN_SONGS.map((s) => s.id).sort());
  });

  it('gives each group a text key for its heading', () => {
    expect(groupSongs(BUILT_IN_SONGS).every((g) => g.label.length > 0)).toBe(true);
  });
});
