import type { updateEn } from './update.en';

// Typed against the English part, so a string missing here fails the build.
export const updateFa: Record<keyof typeof updateEn, string> = {
  'pwa.update.ready': 'نسخهٔ تازهٔ زیر و بم آماده است.',
  'pwa.update.reload': 'بارگذاری دوباره',
  'pwa.update.later': 'بعداً',
};
