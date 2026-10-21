// The scale finder and the circle of fifths in the dictionary (src/scales/finderPanel.ts, circleOfFifths.ts).
export const finderEn = {
  'dict.tab.find': 'Find',

  'find.title': 'Find a scale',
  'find.hint': 'Choose the notes you have, or press them on your MIDI keyboard. The scales that hold all of them are listed, the closest fit first.',
  'find.notes': 'Notes',
  'find.clear': 'Clear',
  'find.none': 'No note chosen yet.',
  'find.empty': 'No scale holds all these notes.',
  'find.found': 'Scales found: {count}',
  'find.exact': 'exactly these notes',
  'find.more': '{count} more notes',

  'circle.title': 'Circle of fifths',
  'circle.hint': 'Press a key to open its scale. Outside: the major keys. Inside: their relative minors. The small number is the key signature.',
  'circle.aria': 'Circle of fifths',
} as const;
