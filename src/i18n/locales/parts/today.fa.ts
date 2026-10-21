import type { todayEn } from './today.en';

// Typed against the English part, so a string missing here fails the build.
export const todayFa: Record<keyof typeof todayEn, string> = {
  'menu.today.title': 'امروز',
  'menu.today.progress': '{done} از {total} انجام شد',
  'menu.today.detail': 'برنامه‌ی حدود {minutes} دقیقه‌ای شما',
  'menu.today.go': 'باز کردن',

  'today.title': 'امروز',
  'today.subtitle': 'برنامه‌ای کوتاه برای امروز، ساخته‌شده از آنچه تمرین کرده‌اید: حدود {minutes} دقیقه.',
  'today.progress': '{done} از {total} انجام شد',
  'today.all': 'کارهای امروز تمام شد. آفرین!',

  'today.block.notes': 'آزمون نت',
  'today.block.ear': 'تمرین گوش',
  'today.block.chords': 'آکوردخوان',
  'today.block.rhythm': 'تمرین ریتم',
  'today.block.scales': 'گام‌ها و آکوردها',
  'today.block.levels': 'خواندن و نواختن',

  'today.reason.due': '{count} مورد برای مرور دوباره، طبق حافظه‌ی تمرین.',
  'today.reason.leanEarly': 'ضربه‌های شما بیشتر زود است.',
  'today.reason.leanLate': 'ضربه‌های شما بیشتر دیر است.',
  'today.reason.offBeat': 'بسیاری از ضربه‌هایتان سر ضرب نیست.',
  'today.reason.core': 'خواندن و نواختن قلب تمرین است.',
  'today.reason.rotation': 'برای امروز یک تنوع.',

  'today.minutes': '{n} دقیقه',
  'today.start': 'شروع',
  'today.done': 'انجام شد',
  'today.undo': 'انجام نشده',
  'today.remake': 'برنامه‌ی دیگر',
};
