import type { persianEn } from './persian.en';

// Typed against the English part, so a string missing here fails the build. Terms to be checked by the owner.
export const persianFa: Record<keyof typeof persianEn, string> = {
  'menu.persian.title': 'موسیقی ایرانی',
  'menu.persian.desc': 'دستگاه‌ها و آوازها، ربع‌پرده‌های کرن و سری، و تمرین گوش برای آن‌ها.',

  'persian.title': 'موسیقی ایرانی',
  'persian.subtitle': 'هفت دستگاه و پنج آواز به شکل الگوی آموزشی روی پیانو، و تمرین گوش برای ربع‌پرده‌ها.',
  'persian.draft': 'بلندی نت‌ها الگویی تقریبی است و هنوز یک متخصص آن را بررسی نکرده است. بلندی واقعی با دستگاه، مکتب و نوازنده فرق می‌کند.',

  'persian.lessons': 'خواندن درس‌ها',
  'persian.modes': 'گام‌ها',
  'persian.dastgah': 'دستگاه',
  'persian.avaz': 'آواز وابسته به {parent}',
  'persian.openMode': 'باز کردن {mode} روی {root} در فرهنگ‌نامه‌ی گام',

  'persian.ear': 'تمرین گوش: ربع‌پرده',
  'persian.stages': 'مرحله',
  'persian.stage': 'مرحله‌ی {n}',
  'persian.q.order': 'دو نت. کدام یک پایین‌تر است؟',
  'persian.q.koronOrFlat': 'دو نت. نت دوم کرن است (کمی پایین‌تر) یا بمل (یک نیم‌پرده پایین‌تر)؟',
  'persian.q.soriOrSharp': 'دو نت. نت دوم سری است (کمی بالاتر) یا دیز (یک نیم‌پرده بالاتر)؟',
  'persian.q.motif': 'دو نغمه‌ی کوتاه. کدام یک کرن دارد؟',
  'persian.a.first': 'اولی',
  'persian.a.second': 'دومی',
  'persian.a.koron': 'کرن',
  'persian.a.flat': 'بمل',
  'persian.a.sori': 'سری',
  'persian.a.sharp': 'دیز',
  'persian.hear': 'شنیدن دوباره',
  'persian.next': 'پرسش بعدی',
  'persian.right': 'درست!',
  'persian.wrong': 'این بار نشد. پاسخ این است: {answer}.',
  'persian.progress': '{answered} از {limit} پاسخ، {percent} درست',
  'persian.unlocked': 'مرحله‌ی {n} باز شد.',
  'persian.noSound': 'صدای پیانو بارگذاری نشد، پس چیزی برای شنیدن نیست.',
};
