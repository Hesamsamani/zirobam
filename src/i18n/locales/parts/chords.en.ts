// The chord reader: a detector and a quiz (src/chords).
export const chordsEn = {
  'menu.chords.title': 'Chord reader',
  'menu.chords.desc': 'Play a chord and see its name, or name chords by playing them.',

  'chords.title': 'Chord reader',
  'chords.subtitle': 'Play keys together on your MIDI keyboard, the computer keyboard or the piano below, and see the name of the chord.',
  'chords.tabs': 'What to do',
  'chords.tab.detect': 'Name my chord',
  'chords.tab.quiz': 'Quiz',

  'chords.detect.none': 'Press three or more keys together.',
  'chords.detect.unknown': 'These notes do not make a chord in the dictionary.',
  'chords.notes': 'Notes: {notes}',
  'chords.keys': 'The keys that are down',
  'chords.clear': 'Let go of all keys',

  'chords.quiz.ask': 'Play this chord',
  'chords.quiz.hint': 'Press its notes together. Any octave will do.',
  'chords.quiz.bass': 'with {note} lowest',
  'chords.quiz.right': 'Right!',
  'chords.quiz.wrong': 'Not quite. The notes are {notes}.',
  'chords.quiz.show': 'Show the notes',
  'chords.quiz.next': 'Next chord',
  'chords.stages': 'Stage',
  'chords.stage': 'Stage {n}',
  'chords.progress': '{answered} of {limit} answered, {percent} right',
  'chords.unlocked': 'Stage {n} is open now.',
} as const;
