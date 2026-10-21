// The mistake heat map on the progress screen (src/stats/heatmapView.ts).
export const heatmapEn = {
  'heat.title': 'Where you slip',
  'heat.period': 'The last eight weeks.',
  'heat.empty': 'Nothing to show yet. Play the note quiz, the ear training, the chord reader, a scale or a piece, and the notes you miss will show up here.',

  'heat.keys': 'The keys, darker the more you miss them',
  'heat.keys.aria': 'A keyboard: the keys you miss most are coloured',
  'heat.notes': 'Notes you miss most',
  'heat.chords': 'Chords you miss most',
  'heat.slip': '{name}: missed {missed} of {asked} ({percent})',
  'heat.none': 'No note is missed often.',

  'heat.rhythm': 'Rhythm',
  'heat.rhythm.line': 'On time {hits}, early {early}, late {late}, not played {missed}.',
  'heat.rhythm.early': 'You tend to tap early.',
  'heat.rhythm.late': 'You tend to tap late.',

  'heat.trend': 'Week by week',
  'heat.trend.aria': 'Share of answers that were right in each of the last eight weeks: {values}',
  'heat.trend.noData': 'no data',
} as const;
