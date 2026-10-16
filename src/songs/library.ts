import type { BuiltInSong } from './index';
import { defineSong, type SongSpec } from './songBuilder';
import { MORE_SPECS } from './libraryMore';

/**
 * More songs and exercises, all in the public domain. The tunes are simplified arrangements for
 * reading practice (the tune in the right hand, a rest in the left), not scholarly editions.
 * Notes: `E4q` = E in octave 4, quarter; `w h q e s` = whole, half, quarter, eighth, sixteenth;
 * a dot makes the note half as long again; `rq` is a quarter rest; `|` ends a measure.
 */
const SPECS: readonly SongSpec[] = [
  // ----- songs -----
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditional',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 4,
    melody: 'E4q D4q C4h | E4q D4q C4h | C4e C4e C4e C4e D4e D4e D4e D4e | E4q D4q C4h',
  },
  {
    id: 'au-clair',
    title: 'Au Clair de la Lune',
    composer: 'Traditional (French)',
    difficulty: 'beginner',
    category: 'folk',
    fifths: 0,
    beats: 4,
    melody:
      'C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w | C4q C4q C4q D4q | E4h D4h | C4q E4q D4q D4q | C4w',
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditional (French)',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 1,
    beats: 4,
    melody:
      'G4q A4q B4q G4q | G4q A4q B4q G4q | B4q C5q D5h | B4q C5q D5h | ' +
      'D5e E5e D5e C5e B4q G4q | D5e E5e D5e C5e B4q G4q | G4q D4q G4h | G4q D4q G4h',
  },
  {
    id: 'london-bridge',
    title: 'London Bridge',
    composer: 'Traditional',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 4,
    melody:
      'G4q. A4e G4q F4q | E4q F4q G4h | D4q E4q F4h | E4q F4q G4h | G4q. A4e G4q F4q | E4q F4q G4h | D4q G4q E4q C4q',
  },
  {
    id: 'old-macdonald',
    title: 'Old MacDonald',
    composer: 'Traditional',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 4,
    melody: 'C4q C4q C4q G4q | A4q A4q G4h | E4q E4q D4q D4q | C4w',
  },
  {
    id: 'lightly-row',
    title: 'Lightly Row',
    composer: 'Traditional',
    difficulty: 'beginner',
    category: 'folk',
    fifths: 0,
    beats: 4,
    melody:
      'G4q E4q E4h | F4q D4q D4h | C4q D4q E4q F4q | G4q G4q G4h | ' +
      'G4q E4q E4q E4q | F4q D4q D4q D4q | C4q E4q G4q G4q | C4w',
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells',
    composer: 'James Lord Pierpont',
    difficulty: 'easy',
    category: 'folk',
    fifths: 0,
    beats: 4,
    melody:
      'E4q E4q E4h | E4q E4q E4h | E4q G4q C4q. D4e | E4w | ' +
      'F4q F4q F4q. F4e | F4q E4q E4q E4e E4e | E4q D4q D4q E4q | D4h G4h',
  },
  {
    id: 'yankee-doodle',
    title: 'Yankee Doodle',
    composer: 'Traditional',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 4,
    melody:
      'G4q G4q A4q B4q | G4q B4q A4q D4q | G4q G4q A4q B4q | G4h F#4h | ' +
      'G4q G4q A4q B4q | C5q B4q A4q G4q | F#4q D4q E4q F#4q | G4h G4h',
  },
  {
    id: 'canon-d',
    title: 'Canon in D (theme)',
    composer: 'Johann Pachelbel',
    difficulty: 'intermediate',
    category: 'classical',
    fifths: 2,
    beats: 4,
    melody:
      'F#5h E5h | D5h C#5h | B4h A4h | B4h C#5h | D5h C#5h | B4h A4h | G4h F#4h | G4h E4h',
  },

  // ----- exercises -----
  {
    id: 'ex-c-scale',
    title: 'C major scale',
    composer: 'Exercise',
    difficulty: 'beginner',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody: 'C4q D4q E4q F4q | G4q A4q B4q C5q | C5q B4q A4q G4q | F4q E4q D4q C4q',
  },
  {
    id: 'ex-five-notes',
    title: 'Five-note pattern',
    composer: 'Exercise',
    difficulty: 'beginner',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody: 'C4q D4q E4q F4q | G4q F4q E4q D4q | C4q E4q G4q E4q | C4w',
  },
  {
    id: 'ex-chord-notes',
    title: 'C major chord notes',
    composer: 'Exercise',
    difficulty: 'beginner',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody: 'C4q E4q G4q C5q | E5q C5q G4q E4q | C4q E4q G4q C5q | C5w',
  },
  {
    id: 'ex-one-note-rhythm',
    title: 'Rhythm on one note',
    composer: 'Exercise',
    difficulty: 'beginner',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody:
      'C4q C4q C4h | C4e C4e C4q C4h | C4q. C4e C4q C4q | C4h. rq | C4e C4e C4e C4e C4q C4q | C4w',
  },
  {
    id: 'ex-thirds',
    title: 'Skipping in thirds',
    composer: 'Exercise',
    difficulty: 'easy',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody: 'C4q E4q D4q F4q | E4q G4q F4q A4q | G4q B4q A4q C5q | G4q E4q C4h',
  },
  {
    id: 'ex-waltz',
    title: 'Waltz pattern',
    composer: 'Exercise',
    difficulty: 'easy',
    category: 'exercise',
    fifths: 0,
    beats: 3,
    melody: 'C4q E4q G4q | C5h. | G4q E4q C4q | C4h.',
  },
  {
    id: 'ex-g-scale',
    title: 'G major scale',
    composer: 'Exercise',
    difficulty: 'easy',
    category: 'exercise',
    fifths: 1,
    beats: 4,
    melody: 'G4q A4q B4q C5q | D5q E5q F#5q G5q | G5q F#5q E5q D5q | C5q B4q A4q G4q',
  },
  {
    id: 'ex-f-scale',
    title: 'F major scale',
    composer: 'Exercise',
    difficulty: 'easy',
    category: 'exercise',
    fifths: -1,
    beats: 4,
    melody: 'F4q G4q A4q Bb4q | C5q D5q E5q F5q | F5q E5q D5q C5q | Bb4q A4q G4q F4q',
  },
  {
    id: 'ex-eighth-scale',
    title: 'Scale in eighth notes',
    composer: 'Exercise',
    difficulty: 'intermediate',
    category: 'exercise',
    fifths: 0,
    beats: 4,
    melody:
      'C4e D4e E4e F4e G4e A4e B4e C5e | C5e B4e A4e G4e F4e E4e D4e C4e | C4q E4q G4q C5q | C5h C4h',
  },
];

export const SONG_LIBRARY: BuiltInSong[] = [...SPECS, ...MORE_SPECS].map(defineSong);
