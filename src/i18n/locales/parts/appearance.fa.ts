import type { appearanceEn } from './appearance.en';

// Typed against the English part, so a string missing here fails the build.
export const appearanceFa: Record<keyof typeof appearanceEn, string> = {
  'appearance.title': 'ظاهر',
  'appearance.theme': 'حالت نمایش',
  'appearance.theme.dark': 'تیره',
  'appearance.theme.light': 'روشن',
  'appearance.theme.system': 'مطابق دستگاه',
  'appearance.accent': 'رنگ برجسته',
  'appearance.accent.brass': 'برنجی',
  'appearance.accent.violet': 'بنفش',
  'appearance.accent.blue': 'آبی',
  'appearance.accent.rose': 'صورتی',
  'appearance.accent.copper': 'مسی',
  'appearance.accent.silver': 'نقره‌ای',
};
