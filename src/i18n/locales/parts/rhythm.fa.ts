import type { rhythmEn } from './rhythm.en';

// Typed against the English part, so a string missing here fails the build.
export const rhythmFa: Record<keyof typeof rhythmEn, string> = {
  'menu.rhythm.title': 'تمرین ریتم',
  'menu.rhythm.desc': 'ریتمی را که می‌بینید همراه با ضرب‌ها بزنید.',

  'rhythm.title': 'تمرین ریتم',
  'rhythm.subtitle': 'ریتم را ببینید، به شمارش ابتدایی گوش بدهید و بعد هر نت را با فاصله، پد یا یک کلید صفحه‌کلید بزنید. برای سکوت ضربه نمی‌زنید.',
  'rhythm.levels': 'سطح',
  'rhythm.level': 'سطح {n}',
  'rhythm.start': 'شروع',
  'rhythm.again': 'دوباره',
  'rhythm.new': 'ریتم تازه',
  'rhythm.stop': 'توقف',
  'rhythm.pad': 'ضربه',
  'rhythm.staff': 'ریتمی که باید بزنید',

  'rhythm.state.idle': 'شروع را بزنید.',
  'rhythm.state.count': 'شمارش ابتدایی…',
  'rhythm.state.tap': 'ریتم را بزنید.',
  'rhythm.state.noSound': 'ضرب‌ها پخش نشد، پس چیزی برای همراهی نیست.',

  'rhythm.result': 'عالی {perfect}، خوب {good}، زود {early}، دیر {late}، از دست رفته {missed}، ضربه‌ی اضافه {extra}.',
  'rhythm.passed': 'آفرین! سر وقت بود.',
  'rhythm.failed': 'هنوز کاملاً سر وقت نیست. دوباره امتحان کنید.',
  'rhythm.unlocked': 'سطح {n} باز شد.',
  'rhythm.leaning.early': 'تمایل دارید زودتر بزنید.',
  'rhythm.leaning.late': 'تمایل دارید دیرتر بزنید.',

  'rhythm.delay': 'تأخیر این دستگاه: {ms} میلی‌ثانیه',
  'rhythm.calibrate': 'اندازه‌گیری تأخیر',
  'rhythm.calibrate.hint': 'همراه هشت ضرب بزنید. فاصله‌ی ضربه‌ی شما تا صدا از این پس کم می‌شود.',
  'rhythm.calibrate.reset': 'برگرداندن تأخیر',
  'rhythm.calibrate.done': 'تأخیر {ms} میلی‌ثانیه است.',
  'rhythm.calibrate.running': 'همراه ضرب‌ها بزنید…',
};
