export const en = {
  'app.title': 'Sight Reading',
  'app.documentTitle': 'Sight Reading Practice',
  'options.title': 'Options',
  'options.language': 'Language',
  'progress.moreToAdvance': '{n} more to advance',
} as const;

export type MessageKey = keyof typeof en;
