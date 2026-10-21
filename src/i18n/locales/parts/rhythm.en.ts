// The rhythm trainer (src/rhythm).
export const rhythmEn = {
  'menu.rhythm.title': 'Rhythm trainer',
  'menu.rhythm.desc': 'Tap the rhythm you see, in time with the clicks.',

  'rhythm.title': 'Rhythm trainer',
  'rhythm.subtitle': 'Look at the rhythm, listen to the count-in, then tap each note with Space, the pad or a key of your keyboard. A rest has no tap.',
  'rhythm.levels': 'Level',
  'rhythm.level': 'Level {n}',
  'rhythm.start': 'Start',
  'rhythm.again': 'Again',
  'rhythm.new': 'New rhythm',
  'rhythm.stop': 'Stop',
  'rhythm.pad': 'Tap',
  'rhythm.staff': 'The rhythm to tap',

  'rhythm.state.idle': 'Press Start.',
  'rhythm.state.count': 'Count in…',
  'rhythm.state.tap': 'Tap the rhythm.',
  'rhythm.state.noSound': 'The clicks could not be played, so there is nothing to tap along with.',

  'rhythm.result': 'Perfect {perfect}, good {good}, early {early}, late {late}, missed {missed}, extra taps {extra}.',
  'rhythm.passed': 'Well done! That was on time.',
  'rhythm.failed': 'Not quite on time yet. Try again.',
  'rhythm.unlocked': 'Level {n} is open now.',
  'rhythm.leaning.early': 'You tend to tap early.',
  'rhythm.leaning.late': 'You tend to tap late.',

  'rhythm.delay': 'Delay of this device: {ms} ms',
  'rhythm.calibrate': 'Measure the delay',
  'rhythm.calibrate.hint': 'Tap along with eight clicks. The delay between your tap and the sound is taken off from then on.',
  'rhythm.calibrate.reset': 'Reset the delay',
  'rhythm.calibrate.done': 'The delay is {ms} ms.',
  'rhythm.calibrate.running': 'Tap along with the clicks…',
} as const;
