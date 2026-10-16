import type { SongSpec } from './songBuilder';

/**
 * More public-domain songs with their real notes: carols, folk tunes, hymns and classical themes.
 * The tunes are simplified for reading practice (the melody in the right hand, nothing in the left; a
 * 6/8 tune is written in 3/4 with the same note values, or twice as long where the pattern has sixteenths).
 *
 * Where they come from: the melodies were read from the LilyPond scores on English and German Wikipedia
 * (CC BY-SA 4.0; Lowell Mason's "The Modern Psalmist" 1839 for Joy to the World, Cecil Sharp 1916 for
 * Scarborough Fair, the Londonderry Air as collected by Jane Ross 1851) and from The Session's ABC settings,
 * and each was compared with other transcriptions. When the Saints, O Tannenbaum, Greensleeves, Für Elise,
 * We Wish You a Merry Christmas were written out by hand from those sources and from memory.
 * The tests check the length of every measure and the key, not the pitches, so a wrong note is still possible:
 * listen to a song and tell us if a note sounds wrong.
 */
export const MORE_SPECS: readonly SongSpec[] = [
  {
    id: 'row-row-row',
    title: 'Row, Row, Row Your Boat',
    composer: 'Traditional',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 3,
    melody:
      'C4q. C4q. | C4q D4e E4q. | E4q D4e E4q F4e | G4h. | ' +
      'C5e C5e C5e G4e G4e G4e | E4e E4e E4e C4e C4e C4e | G4q F4e E4q D4e | C4h.',
  },
  {
    id: 'alle-meine-entchen',
    title: 'Alle meine Entchen',
    composer: 'Traditional (German)',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 4,
    melody:
      'C4e D4e E4e F4e G4q G4q | A4e A4e A4e A4e G4h | A4e A4e A4e A4e G4h | F4e F4e F4e F4e E4q E4q | ' +
      'D4e D4e D4e D4e C4h',
  },
  {
    id: 'when-the-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American spiritual)',
    difficulty: 'beginner',
    category: 'folk',
    fifths: 0,
    beats: 2,
    melody:
      're C4e E4e F4e | G4h | re C4e E4e F4e | G4h | ' +
      're C4e E4e F4e | G4q E4q | C4q E4q | D4h | ' +
      're E4e E4e D4e | C4h | E4q G4q | G4e F4q. | ' +
      'rq E4e F4e | G4q E4q | C4q D4q | C4h',
  },
  {
    id: 'pop-goes-the-weasel',
    title: 'Pop Goes the Weasel',
    composer: 'Traditional (English)',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 0,
    beats: 3,
    melody:
      'C4q C4e D4q D4e | E4e G4e E4e C4q. | C4q C4e D4q D4e | E4q. C4e rq | ' +
      'C4q C4e D4q D4e | E4e G4e E4e C4q. | A4e rq D4q F4e | E4q. C4e rq',
  },
  {
    id: 'fuchs-gans',
    title: 'Fuchs, du hast die Gans gestohlen',
    composer: 'Traditional (German)',
    difficulty: 'beginner',
    category: 'nursery',
    fifths: 2,
    beats: 4,
    melody:
      'D4q E4q F#4q G4q | A4q A4q A4q A4q | B4q G4q D5q B4q | A4w | ' +
      'B4q G4q D5q B4q | A4w | A4q G4q G4q G4q | G4q F#4q F#4q F#4q | ' +
      'F#4q E4q F#4q E4q | D4q F#4q A4h | A4q G4q G4q G4q | G4q F#4q F#4q F#4q | ' +
      'F#4q E4q F#4q E4q | D4w',
  },
  {
    id: 'sur-le-pont',
    title: "Sur le pont d'Avignon",
    composer: 'Traditional (French)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 2,
    melody:
      'G4e G4e G4q | A4e A4e A4q | B4e. C5s D5e G4e | F#4e. G4s A4e D4e | ' +
      'G4e G4e G4q | A4e A4e A4q | B4e. C5s D5e G4e | A4e F#4e G4e re',
  },
  {
    id: 'we-wish-you',
    title: 'We Wish You a Merry Christmas',
    composer: 'Traditional (English)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 3,
    melody:
      'rh D4q | G4q G4e A4e G4e F#4e | E4q E4q E4q | A4q A4e B4e A4e G4e | ' +
      'F#4q D4q D4q | B4q B4e C5e B4e A4e | G4q E4q D4e D4e | E4q A4q F#4q | ' +
      'G4h.',
  },
  {
    id: 'silent-night',
    title: 'Silent Night',
    composer: 'Franz Xaver Gruber',
    difficulty: 'easy',
    category: 'folk',
    fifths: 0,
    beats: 3,
    melody:
      'G4q. A4e G4q | E4h. | G4q. A4e G4q | E4h. | ' +
      'D5h D5q | B4h. | C5h C5q | G4h. | ' +
      'A4h A4q | C5q. B4e A4q | G4q. A4e G4q | E4h. | ' +
      'A4h A4q | C5q. B4e A4q | G4q. A4e G4q | E4h. | ' +
      'D5h D5q | F5q. D5e B4q | C5h. | E5h rq | ' +
      'C5q. G4e E4q | G4q. F4e D4q | C4h.~ | C4h rq',
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditional (New Britain)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 3,
    melody:
      'rh D4q | G4h B4e G4e | B4h A4q | G4h E4q | ' +
      'D4h D4q | G4h B4e G4e | B4h A4q | D5h B4q | ' +
      'D5q. B4e D5e B4e | G4h D4q | E4q. G4e G4e E4e | D4h D4q | ' +
      'G4h B4e G4e | B4h A4q | G4h.',
  },
  {
    id: 'auld-lang-syne',
    title: 'Auld Lang Syne',
    composer: 'Traditional (Scottish)',
    difficulty: 'easy',
    category: 'folk',
    fifths: -1,
    beats: 4,
    melody:
      'rh. C4q | F4q. F4e F4q A4q | G4q. F4e G4q A4q | F4q. F4e A4q C5q | ' +
      'D5h. D5q | C5q. A4e A4q F4q | G4q. F4e G4q A4q | F4q. D4e D4q C4q | ' +
      'F4h. D5q | C5q. A4e A4q F4q | G4q. F4e G4q D5q | C5q. A4e A4q C5q | ' +
      'D5h. F5q | C5q. A4e A4q F4q | G4q. F4e G4q A4q | F4q. D4e D4q C4q | ' +
      'F4h. rq',
  },
  {
    id: 'scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditional (English)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 0,
    mode: 'dorian',
    beats: 3,
    melody:
      'D4h D4q | A4e A4q. A4q | E4q. F4e E4q | D4h. | ' +
      'rq A4q C5q | D5h C5q | A4q B4q G4q | A4h D4q | ' +
      'D4h D4q | C5h A4q | A4q G4q F4q | E4h. | ' +
      'D4h A4q | G4h F4q | E4q D4q C4q | D4h.',
  },
  {
    id: 'o-tannenbaum',
    title: 'O Tannenbaum',
    composer: 'Traditional (German)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 3,
    melody:
      'rh re D4e | G4e. G4s G4q A4q | B4e. B4s B4q. B4e | A4e B4e C5q F#4q | ' +
      'A4q G4q re D5e | D5e B4e E5q. D5e | D5e C5e C5q. C5e | C5e A4e D5q. C5e | ' +
      'C5e B4e B4q re D4e | G4e. G4s G4q A4q | B4e. B4s B4q. B4e | A4e B4e C5q F#4q | ' +
      'A4q G4h',
  },
  {
    id: 'away-in-a-manger',
    title: 'Away in a Manger',
    composer: 'Traditional',
    difficulty: 'easy',
    category: 'folk',
    fifths: -1,
    beats: 3,
    melody:
      'rh C4q | F4q F4q G4e A4e | F4q F4q A4e Bb4e | C5q C5q D5q | ' +
      'Bb4h G4e A4e | Bb4q Bb4q C5q | A4q A4q F4e A4e | G4q D4q F4q | ' +
      'E4h C4q | F4q F4q G4e A4e | F4q F4q A4e Bb4e | C5q C5q D5q | ' +
      'Bb4h G4e A4e | Bb4q Bb4q C5q | A4q A4q F4e A4e | G4q D4q E4q | ' +
      'F4h rq',
  },
  {
    id: 'brahms-lullaby',
    title: "Brahms' Lullaby",
    composer: 'Johannes Brahms',
    difficulty: 'easy',
    category: 'classical',
    fifths: -3,
    beats: 3,
    melody:
      'rh G4e G4e | Bb4q. G4e G4q | Bb4q rq G4e Bb4e | Eb5q D5q. C5e | ' +
      'C5q Bb4q F4e G4e | Ab4q F4q F4e G4e | Ab4q rq F4e Ab4e | D5e C5e Bb4q D5q | ' +
      'Eb5q rq Eb4e Eb4e | Eb5h C5e Ab4e | Bb4h G4e Eb4e | Ab4q Bb4q C5q | ' +
      'Bb4h Eb4e Eb4e | Eb5h C5e Ab4e | Bb4h G4e Eb4e | Ab4q Bb4q G4q | ' +
      'F4q Eb4h',
  },
  {
    id: 'o-come-all-ye-faithful',
    title: 'O Come, All Ye Faithful',
    composer: 'John Francis Wade',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 4,
    melody:
      'rh. G4q | G4h D4q G4q | A4h D4h | B4q A4q B4q C5q | ' +
      'B4h A4q G4q | G4h F#4q E4q | F#4q G4q A4q B4q | F#4h E4q. D4e | ' +
      'D4w | D5h C5q B4q | C5h B4h | A4q B4q G4q A4q | ' +
      'F#4h D4q G4q | G4q F#4q G4q A4q | G4h D4q B4q | B4q A4q B4q C5q | ' +
      'B4h A4q B4q | C5q B4q A4q G4q | F#4h G4q C5q | B4h A4q. G4e | ' +
      'G4w',
  },
  {
    id: 'skye-boat-song',
    title: 'The Skye Boat Song',
    composer: 'Traditional (Scottish)',
    difficulty: 'easy',
    category: 'folk',
    fifths: 1,
    beats: 3,
    melody:
      'D4q. E4e D4q | G4h G4q | A4q. B4e A4q | D5h. | ' +
      'B4q. A4e B4q | E4h E4q | D4h.~ | D4h. | ' +
      'D4q. E4e D4q | G4h G4q | A4q. B4e A4q | D5h. | ' +
      'B4q. A4e B4q | E4h E4q | G4h.~ | G4h.',
  },
  {
    id: 'it-came-upon-midnight-clear',
    title: 'It Came Upon the Midnight Clear',
    composer: 'Richard Storrs Willis',
    difficulty: 'intermediate',
    category: 'folk',
    fifths: -1,
    beats: 4,
    melody:
      'rh. F4e G4e | A4q G4q F4q G4e A4e | Bb4q A4q G4q C5q | C5q A4q Bb4e C5e D5q | ' +
      'C5h. A4e Bb4e | C5q C5q A4q F4q | Bb4q A4q G4q F4e G4e | A4e Bb4e C5q A4q G4q | ' +
      'F4h. F4q | E4q D4q E4q G4q | F4q. E4e D4q A4q | G4q F4q E4q D4q | ' +
      'C4h. C4q | C5q Bb4q A4q G4e A4e | Bb4q A4q G4q F4e G4e | A4e Bb4e C5q A4q G4q | ' +
      'F4h. rq',
  },
  {
    id: 'joy-to-the-world',
    title: 'Joy to the World',
    composer: 'Lowell Mason, after Handel',
    difficulty: 'intermediate',
    category: 'folk',
    fifths: 2,
    beats: 2,
    melody:
      'D5q C#5e. B4s | A4q. G4e | F#4q E4q | D4q. A4e | ' +
      'B4q. B4e | C#5q. C#5e | D5h~ | D5q. D5e | ' +
      'D5e C#5e B4e A4e | A4e. G4s F#4e D5e | D5e C#5e B4e A4e | A4e. G4s F#4e F#4e | ' +
      'F#4e F#4e F#4e F#4s G4s | A4q. G4s F#4s | E4e E4e E4e E4s F#4s | G4q. F#4s E4s | ' +
      'F#4e D5q B4e | A4e. G4s F#4e G4e | F#4q E4q | D4h',
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English)',
    difficulty: 'intermediate',
    category: 'folk',
    fifths: 1,
    mode: 'minor',
    beats: 3,
    melody:
      'rh re E4e | G4q A4e B4e C5e B4e | A4q F#4e D4e E4e F#4e | G4q E4e E4e D#4e E4e | ' +
      'F#4q D#4e B3q E4e | G4q A4e B4e C5e B4e | A4q F#4e D4e E4e F#4e | G4e F#4e E4e D#4e C#4e D#4e | ' +
      'E4q. E4q re | D5q. D5e C#5e B4e | A4q F#4e D4e E4e F#4e | G4q E4e E4e D#4e E4e | ' +
      'F#4q D#4e B3q. | D5q. D5e C#5e B4e | A4q F#4e D4e E4e F#4e | G4e F#4e E4e D#4e C#4e D#4e | ' +
      'E4h.',
  },
  {
    id: 'danny-boy',
    title: 'Danny Boy (Londonderry Air)',
    composer: 'Traditional (Irish)',
    difficulty: 'intermediate',
    category: 'folk',
    fifths: -3,
    beats: 4,
    melody:
      'rh re D4e Eb4e F4e | G4q. F4e G4e C5e Bb4e G4e | F4e Eb4e C4q re Eb4e G4e Ab4e | Bb4q. C5e Bb4e G4e Eb4e G4e | ' +
      'F4h re D4e Eb4e F4e | G4q. F4e G4e C5e Bb4e G4e | F4e Eb4e C4e Bn3e C4e D4e Eb4e F4e | G4q. Ab4e G4e F4e Eb4e F4e | ' +
      'Eb4h re Bb4e C5e D5e | Eb5q. D5e D5e C5e Bb4e G4e | Bb4e G4e Eb4q re Bb4e C5e D5e | Eb5q. D5e D5e C5e Bb4e G4e | ' +
      'F4h re Bb4e Bb4e Bb4e | G5q. F5e F5e Eb5e C5e Eb5e | Bb4e G4e Eb4q re D4e Eb4e F4e | G4e C5e Bb4e G4e F4e Eb4e C4e D4e | ' +
      'Eb4w',
  },
  {
    id: 'eine-kleine',
    title: 'Eine kleine Nachtmusik (theme)',
    composer: 'Wolfgang Amadeus Mozart',
    difficulty: 'intermediate',
    category: 'classical',
    fifths: 1,
    beats: 4,
    melody:
      'G4q re D4e G4q re D4e | G4e D4e G4e B4e D5q rq | C5q re A4e C5q re A4e | C5e A4e F#4e A4e D4q rq',
  },
  {
    id: 'fur-elise',
    title: 'Für Elise (theme)',
    composer: 'Ludwig van Beethoven',
    difficulty: 'intermediate',
    category: 'classical',
    fifths: 0,
    mode: 'minor',
    beats: 3,
    melody:
      'rh E5e D#5e | E5e D#5e E5e B4e Dn5e C5e | A4q re C4e E4e A4e | B4q re E4e G#4e B4e | ' +
      'C5q re E4e E5e D#5e | E5e D#5e E5e B4e Dn5e C5e | A4q re C4e E4e A4e | B4q re E4e C5e B4e | ' +
      'A4h.',
  },
];
