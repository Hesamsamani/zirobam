import type { uiEn } from './ui.en';

// Typed against the English part, so a key missing here fails the build.
export const uiFa: Record<keyof typeof uiEn, string> = {
  'dialog.close': 'بستن',
};
