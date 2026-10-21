// The scale and chord dictionary screen (src/scales). The names of scales and chords are in theory.en.ts.
export const dictionaryEn = {
  'dict.title': 'Scale and chord dictionary',
  'dict.subtitle': 'Choose a scale, see it on the staff and the keys, hear it, and find the chords that belong to it.',
  'dict.tab.scales': 'Scales',
  'dict.tab.chords': 'Chords',
  'dict.all': 'All',

  'dict.search': 'Search scales',
  'dict.search.placeholder': 'Try: C Dorian, A minor, Shur',
  'dict.search.found': 'Scales found: {count}',
  'dict.search.none': 'No scale matches “{query}”.',
  'dict.categories': 'Groups of scales',
  'dict.scalesList': 'Scales in this group',
  'dict.root': 'Root note',
  'dict.root.koron': 'A quarter tone lower (koron)',
  'dict.root.koronHint': 'Only for a note without a sharp or flat',

  'dict.koron': 'koron',
  'dict.sori': 'sori',

  'dict.scale.title': '{root} {scale}',
  'dict.steps': 'The steps of the scale, in tones',
  'dict.step.aria': '{note}, degree {degree}, a step of {tones} tones',

  'dict.persian.note':
    'Persian modes are shown as a teaching model: a koron is a quarter tone lower than the written note, a sori a quarter tone higher. Real pitches vary with the dastgah, the school and the performer.',
  'dict.persian.unreviewed': 'These pitches have not been checked by an expert yet.',
  'dict.persian.piano': 'On the piano, a koron or sori note is played on the key of its letter.',

  'dict.chords.heading': 'Chords of this scale',
  'dict.chords.count': 'Chords: {count}',
  'dict.chords.family': 'Kind of chord',
  'dict.chords.degree': 'Chords on',
  'dict.chords.allDegrees': 'Every degree',
  'dict.chords.degreeOption': 'Degree {degree} ({note})',
  'dict.chords.primary': 'Main chords only (degrees 1, 4 and 5)',
  'dict.chords.inversions': 'Show inversions',
  'dict.chords.empty': 'No chord of this kind fits the scale.',
  'dict.chords.quarter':
    'Quarter tones in this mode: {count}. A quarter tone is not the root of a chord, and no chord uses one, because chords are played on the piano.',
  'dict.card.degree': 'Degree {degree}',
  'dict.card.notes': 'Notes: {count}',
  'dict.card.main': 'Main chord',
  'dict.card.listen': 'Hear {chord}',
} as const;
