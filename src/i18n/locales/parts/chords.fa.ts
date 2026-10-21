import type { chordsEn } from './chords.en';

// Typed against the English part, so a string missing here fails the build.
export const chordsFa: Record<keyof typeof chordsEn, string> = {
  'menu.chords.title': 'آکوردخوان',
  'menu.chords.desc': 'یک آکورد بزنید و نامش را ببینید، یا آکوردها را با زدن نام ببرید.',

  'chords.title': 'آکوردخوان',
  'chords.subtitle': 'چند کلید را با هم روی کیبورد میدی، صفحه‌کلید رایانه یا پیانوی پایین بزنید و نام آکورد را ببینید.',
  'chords.tabs': 'چه کنیم',
  'chords.tab.detect': 'نام آکوردم',
  'chords.tab.quiz': 'آزمون',

  'chords.detect.none': 'سه کلید یا بیشتر را با هم بزنید.',
  'chords.detect.unknown': 'این نت‌ها آکوردی از فرهنگ‌نامه نمی‌سازند.',
  'chords.notes': 'نت‌ها: {notes}',
  'chords.keys': 'کلیدهایی که پایین‌اند',
  'chords.clear': 'رها کردن همه‌ی کلیدها',

  'chords.quiz.ask': 'این آکورد را بزنید',
  'chords.quiz.hint': 'نت‌هایش را با هم بزنید. هر اکتاوی درست است.',
  'chords.quiz.bass': 'با {note} در پایین‌ترین جا',
  'chords.quiz.right': 'درست!',
  'chords.quiz.wrong': 'نه کاملاً. نت‌ها این‌ها هستند: {notes}.',
  'chords.quiz.show': 'نشان دادن نت‌ها',
  'chords.quiz.next': 'آکورد بعدی',
  'chords.stages': 'مرحله',
  'chords.stage': 'مرحله‌ی {n}',
  'chords.progress': '{answered} از {limit} پاسخ، {percent} درست',
  'chords.unlocked': 'مرحله‌ی {n} باز شد.',
};
