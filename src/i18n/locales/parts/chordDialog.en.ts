// The chord dialog of the dictionary (src/scales/chordDialog.ts). The names of chords are in theory.en.ts.
export const chordDialogEn = {
  'cd.sub': 'Degree {degree} of the scale, {roman}',
  'cd.notes': 'Notes',

  'cd.turns': 'Turns of the chord',
  'cd.turn.0': 'Root position',
  'cd.turn.1': 'First inversion',
  'cd.turn.2': 'Second inversion',
  'cd.turn.3': 'Third inversion',
  'cd.turn.4': 'Fourth inversion',
  'cd.turn.5': 'Fifth inversion',

  'cd.staff': 'The chord on the staff',
  'cd.keys': 'The chord on the keys',

  'cd.play': 'Play chord',
  'cd.arpeggio': 'Arpeggio',
  'cd.midi': 'Download MIDI',
  'cd.midi.saved': 'Saved {file}.',

  'cd.guitar': 'On the guitar',
  'cd.guitar.tuning': 'Standard tuning, low string on the left: {notes}.',
  'cd.guitar.none': 'No guitar shape was found for this chord.',
  'cd.shape.open': 'Open',
  'cd.shape.barre': 'Barre',
  'cd.shape.movable': 'Movable',
  'cd.shape.fromFret': 'From fret {fret}',
  'cd.shape.hear': 'Hear',
  'cd.shape.hearAria': 'Hear the {kind} shape of {chord}',
  'cd.shape.aria': 'Guitar shape for {chord}: {kind}, frets from the low string: {frets}.',
  'cd.shape.muted': 'muted',
} as const;
