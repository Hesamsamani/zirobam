import type { MessageKey } from '../i18n';
import type { BuiltInSong } from './index';

export interface SongGroup {
  id: BuiltInSong['difficulty'] | 'exercises';
  /** Text key of the heading. */
  label: MessageKey;
  songs: BuiltInSong[];
}

const LEVELS: ReadonlyArray<{ id: BuiltInSong['difficulty']; label: MessageKey }> = [
  { id: 'beginner', label: 'options.songsBeginner' },
  { id: 'easy', label: 'options.songsEasy' },
  { id: 'intermediate', label: 'options.songsIntermediate' },
];

/** Songs by difficulty, easiest first, then the exercises. Empty groups are left out. */
export function groupSongs(songs: readonly BuiltInSong[]): SongGroup[] {
  const groups: SongGroup[] = LEVELS.map(({ id, label }) => ({
    id,
    label,
    songs: songs.filter((song) => song.category !== 'exercise' && song.difficulty === id),
  }));
  groups.push({ id: 'exercises', label: 'songs.exercises', songs: songs.filter((song) => song.category === 'exercise') });
  return groups.filter((group) => group.songs.length > 0);
}
