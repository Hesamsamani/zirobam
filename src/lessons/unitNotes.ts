import { h, list, p, staff, terms, tip } from './build';
import type { Unit } from './types';

/** Unit 1: reading pitch from the staff. {C} style words follow the note names the student chose. */
export const NOTES_UNIT: Unit = {
  id: 'notes',
  title: { en: `Reading notes`, fa: `خواندن نت` },
  summary: {
    en: `The staff, the clefs, note names, accidentals and key signatures: everything you need to read pitch.`,
    fa: `حامل، کلیدها، نام نت‌ها، علامت‌های تغییر و آرمور: هر آنچه برای خواندن زیر و بمی لازم دارید.`,
  },
  lessons: [
    {
      id: 'staff',
      unit: 'notes',
      minutes: 3,
      title: { en: `The staff`, fa: `حامل` },
      summary: { en: `Five lines, four spaces, and what height means.`, fa: `پنج خط، چهار فاصله و معنای ارتفاع نت.` },
      blocks: [
        p(
          `Music is written on a staff: five horizontal lines with four spaces between them. We count lines and spaces from the bottom, so the lowest line is line 1 and the highest is line 5.`,
          `موسیقی روی حامل نوشته می‌شود: پنج خط افقی با چهار فاصله میان آن‌ها. خط‌ها و فاصله‌ها را از پایین می‌شماریم، پس پایین‌ترین خط، خط اول و بالاترین خط، خط پنجم است.`
        ),
        staff(
          { clef: 'treble', notes: 'E4q F4q G4q A4q B4q', free: true },
          `A note sits either on a line or in a space. Here the notes go: line, space, line, space, line.`,
          `هر نت یا روی یک خط می‌نشیند یا در یک فاصله. این‌جا نت‌ها به این ترتیب‌اند: خط، فاصله، خط، فاصله، خط.`
        ),
        h(`Height is pitch`, `ارتفاع یعنی زیر و بمی`),
        p(
          `The higher a note sits on the staff, the higher it sounds. Going from a line to the space above it, or from a space to the line above it, takes you to the next note name.`,
          `هرچه نت روی حامل بالاتر باشد، صدایش زیرتر است. رفتن از یک خط به فاصله‌ی بالای آن، یا از یک فاصله به خط بالای آن، شما را به نت بعدی می‌برد.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q | G4q F4q E4q D4q' },
          `Notes climbing the staff sound higher, notes falling sound lower. Press Play to hear it.`,
          `نت‌هایی که روی حامل بالا می‌روند زیرتر می‌شوند و نت‌هایی که پایین می‌آیند بم‌تر. برای شنیدن، دکمه‌ی پخش را بزنید.`,
          { listen: true }
        ),
        tip(
          `Think of the staff as a ladder. You will not need the note names yet: just practise seeing whether the next note is higher, lower or the same.`,
          `حامل را مثل یک نردبان ببینید. هنوز به نام نت‌ها نیازی نیست؛ فقط تمرین کنید که ببینید نت بعدی بالاتر است، پایین‌تر است یا هم‌ارتفاع.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'treble-clef',
      unit: 'notes',
      minutes: 4,
      title: { en: `The treble clef`, fa: `کلید سل` },
      summary: { en: `The curl that marks the note G, and the notes on every line and space.`, fa: `خمِ کلید که جای نت سل را نشان می‌دهد و نت‌های همه‌ی خط‌ها و فاصله‌ها.` },
      blocks: [
        p(
          `Without a clef the lines have no names. The treble clef, also called the G clef, fixes them. Its curl wraps around the second line from the bottom, and that line is the note {G} above middle C.`,
          `بدون کلید، خط‌های حامل نامی ندارند. کلید سل نام آن‌ها را مشخص می‌کند. خمِ این کلید دور خط دوم از پایین می‌پیچد و آن خط همان نت {G} بالای دوی میانی است.`
        ),
        staff(
          { clef: 'treble', notes: 'G4w' },
          `The curl of the clef circles the second line: that line is {G}.`,
          `خمِ کلید دور خط دوم می‌چرخد؛ آن خط {G} است.`,
          { names: true, listen: true }
        ),
        h(`The lines and the spaces`, `خط‌ها و فاصله‌ها`),
        p(
          `From the bottom, the five lines are {E} {G} {B} {D} {F}. The four spaces are {F} {A} {C} {E}.`,
          `از پایین، پنج خط این نت‌ها هستند: {E} {G} {B} {D} {F}. چهار فاصله هم این‌ها: {F} {A} {C} {E}.`
        ),
        staff(
          { clef: 'treble', notes: 'E4q G4q B4q D5q F5q', free: true },
          `The five lines, from the bottom up.`,
          `پنج خط، از پایین به بالا.`,
          { names: true }
        ),
        staff(
          { clef: 'treble', notes: 'F4q A4q C5q E5q', free: true },
          `The four spaces, from the bottom up.`,
          `چهار فاصله، از پایین به بالا.`,
          { names: true }
        ),
        p(
          `Many students remember the lines with the phrase "Every Good Boy Does Fine" and the spaces as the word FACE. That works for letter names; if you use another naming system, make up your own phrase.`,
          `بسیاری از هنرجوها خط‌ها را با جمله‌ی انگلیسی Every Good Boy Does Fine و فاصله‌ها را با واژه‌ی FACE به خاطر می‌سپارند. این روش برای نام‌گذاری با حرف است؛ اگر از نام‌گذاری دیگری استفاده می‌کنید، جمله‌ی خودتان را بسازید.`
        ),
        tip(
          `You do not have to memorise all nine at once. Learn {G} on line 2 first, then count up or down from it.`,
          `لازم نیست هر نُه نت را یک‌جا حفظ کنید. اول {G} روی خط دوم را یاد بگیرید، بعد از آن بالا یا پایین بشمارید.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'bass-clef',
      unit: 'notes',
      minutes: 4,
      title: { en: `The bass clef`, fa: `کلید فا` },
      summary: { en: `The clef for low notes, marked by two dots around the note F.`, fa: `کلید صداهای بم، با دو نقطه دور نت فا.` },
      blocks: [
        p(
          `The bass clef, also called the F clef, is used for the lower notes. Its two dots sit above and below the fourth line from the bottom, and that line is the note {F} below middle C.`,
          `کلید فا برای صداهای بم‌تر به کار می‌رود. دو نقطه‌ی آن بالا و پایین خط چهارم از پایین قرار می‌گیرند و آن خط همان نت {F} زیر دوی میانی است.`
        ),
        staff(
          { clef: 'bass', notes: 'F3w' },
          `The two dots of the clef surround the fourth line: that line is {F}.`,
          `دو نقطه‌ی کلید دور خط چهارم را گرفته‌اند؛ آن خط {F} است.`,
          { names: true, listen: true }
        ),
        p(
          `From the bottom, the lines are {G} {B} {D} {F} {A} and the spaces are {A} {C} {E} {G}.`,
          `از پایین، خط‌ها {G} {B} {D} {F} {A} هستند و فاصله‌ها {A} {C} {E} {G}.`
        ),
        staff(
          { clef: 'bass', notes: 'G2q B2q D3q F3q A3q', free: true },
          `The five lines of the bass staff.`,
          `پنج خط حامل کلید فا.`,
          { names: true }
        ),
        staff(
          { clef: 'bass', notes: 'A2q C3q E3q G3q', free: true },
          `The four spaces of the bass staff.`,
          `چهار فاصله‌ی حامل کلید فا.`,
          { names: true }
        ),
        h(`Same place, different note`, `جای یکسان، نت متفاوت`),
        p(
          `A note on the bottom line is {E} in the treble clef but {G} in the bass clef. The clef decides, so always look at it first.`,
          `نتی که روی پایین‌ترین خط است در کلید سل {E} است و در کلید فا {G}. کلید تعیین‌کننده است، پس همیشه اول به آن نگاه کنید.`
        ),
        staff(
          { clef: 'grand', notes: 'E4w', lower: 'G2w' },
          `Both notes sit on the bottom line of their staff, but they are different notes.`,
          `هر دو نت روی پایین‌ترین خط حامل خودشان‌اند ولی دو نت متفاوت‌اند.`,
          { names: true }
        ),
        tip(
          `For the bass staff, memorise {F} on line 4 and count from there. The phrases "Good Boys Do Fine Always" (lines) and "All Cows Eat Grass" (spaces) also help.`,
          `برای کلید فا، {F} روی خط چهارم را حفظ کنید و از آن‌جا بشمارید. جمله‌های انگلیسی Good Boys Do Fine Always برای خط‌ها و All Cows Eat Grass برای فاصله‌ها هم کمک می‌کنند.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'middle-c',
      unit: 'notes',
      minutes: 4,
      title: { en: `Middle C and the grand staff`, fa: `دوی میانی و حامل بزرگ` },
      summary: { en: `How the two staves join, and the note that sits between them.`, fa: `چگونه دو حامل به هم می‌پیوندند و نتی که میان آن‌هاست.` },
      blocks: [
        p(
          `Piano music uses two staves joined by a brace, the grand staff. The upper one has a treble clef and is usually played by the right hand. The lower one has a bass clef and is usually played by the left hand.`,
          `موسیقی پیانو از دو حامل استفاده می‌کند که با یک آکولاد به هم وصل شده‌اند و حامل بزرگ نام دارد. حامل بالایی کلید سل دارد و معمولاً با دست راست نواخته می‌شود. حامل پایینی کلید فا دارد و معمولاً با دست چپ نواخته می‌شود.`
        ),
        p(
          `Between the two staves lies middle C. In the treble clef it sits on a short extra line below the staff. In the bass clef it sits on a short extra line above the staff. It is the same key on the piano either way.`,
          `دوی میانی میان این دو حامل است. در کلید سل روی یک خط کوتاهِ اضافی زیر حامل می‌نشیند و در کلید فا روی یک خط کوتاهِ اضافی بالای حامل. در هر دو حالت یک کلید پیانو را می‌زنید.`
        ),
        staff(
          { clef: 'grand', notes: 'C4w', lower: 'C4w' },
          `Middle C, written in the treble clef (above) and in the bass clef (below). The sound is the same.`,
          `دوی میانی، یک بار در کلید سل (بالا) و یک بار در کلید فا (پایین). صدا یکی است.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'grand', notes: 'D4q E4q F4q G4q', lower: 'B3q A3q G3q F3q' },
          `From middle C the right hand moves up and the left hand moves down.`,
          `از دوی میانی، دست راست بالا می‌رود و دست چپ پایین می‌آید.`,
          { names: true }
        ),
        tip(
          `Middle C is your home base. Whenever you are lost, find middle C and count from it.`,
          `دوی میانی خانه‌ی شماست. هر وقت گم شدید، دوی میانی را پیدا کنید و از آن بشمارید.`
        ),
      ],
      actions: ['quiz', 'levels'],
    },
    {
      id: 'note-names',
      unit: 'notes',
      minutes: 3,
      title: { en: `Note names`, fa: `نام نت‌ها` },
      summary: { en: `Seven names that repeat, written as letters or as Do Re Mi.`, fa: `هفت نام که تکرار می‌شوند، با حرف یا با دو، ر، می.` },
      blocks: [
        p(
          `Music uses only seven note names. After the seventh the names start again from the beginning, and the sound comes back an octave higher.`,
          `در موسیقی فقط هفت نام برای نت‌ها به کار می‌رود. بعد از نام هفتم دوباره از اول شروع می‌کنیم و صدا یک اکتاو بالاتر برمی‌گردد.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q | G4q A4q B4q C5q' },
          `The seven names in order, and then {C} again.`,
          `هفت نام به ترتیب، و بعد دوباره {C}.`,
          { names: true, listen: true }
        ),
        p(
          `There are two ways to say them. Letters go A B C D E F G. Solfège uses syllables: Do Re Mi Fa Sol La Si. In Persian music teaching the syllables are written دو، ر، می، فا، سل، لا، سی.`,
          `برای گفتن این نام‌ها دو راه هست. با حرف: A B C D E F G. با هجا که به آن سلفژ می‌گویند: دو، ر، می، فا، سل، لا، سی. در آموزش موسیقی ایرانی معمولاً هجاها را به همین شکل می‌نویسند.`
        ),
        terms(
          [`C D E F G A B`, `Letters: C is the same note as Do.`, `حرف‌ها: C همان دو است.`],
          [`Do Re Mi Fa Sol La Si`, `Solfège: Do is the first note of the major scale.`, `سلفژ: دو نخستین نت گام ماژور است.`]
        ),
        tip(
          `You can switch between the systems in the settings (Note names) at any time. This whole course follows your choice.`,
          `هر وقت خواستید می‌توانید در تنظیمات (نام نت‌ها) از یک روش به روش دیگر بروید. تمام این درس‌ها از انتخاب شما پیروی می‌کنند.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'landmarks',
      unit: 'notes',
      minutes: 3,
      title: { en: `Landmark notes`, fa: `نت‌های راهنما` },
      summary: { en: `Read fast by knowing a few notes by sight and counting from them.`, fa: `با شناختن چند نت در یک نگاه و شمردن از روی آن‌ها، سریع بخوانید.` },
      blocks: [
        p(
          `Counting up from the bottom line every time is slow. Good readers learn a few landmark notes by sight and count from the nearest one.`,
          `هر بار از پایین‌ترین خط شمردن کند است. خوانندگان خوب چند نت راهنما را با یک نگاه می‌شناسند و از نزدیک‌ترین آن‌ها می‌شمارند.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q G4q C5q', free: true },
          `In the treble clef: middle C below the staff, {G} on line 2, and the {C} in the third space.`,
          `در کلید سل: دوی میانی زیر حامل، {G} روی خط دوم و {C} در فاصله‌ی سوم.`,
          { names: true }
        ),
        staff(
          { clef: 'bass', notes: 'C3q F3q C4q', free: true },
          `In the bass clef: the {C} in the second space, {F} on line 4, and middle C above the staff.`,
          `در کلید فا: {C} در فاصله‌ی دوم، {F} روی خط چهارم و دوی میانی بالای حامل.`,
          { names: true }
        ),
        p(
          `To read any other note, find the nearest landmark and count the lines and spaces in between. A note one step above {G} is {A}; one step below is {F}.`,
          `برای خواندن هر نت دیگر، نزدیک‌ترین نت راهنما را پیدا کنید و خط‌ها و فاصله‌های میان آن دو را بشمارید. نتی که یک پله بالاتر از {G} است {A} است و یک پله پایین‌تر {F}.`
        ),
        tip(
          `Landmarks are exactly what the note quiz trains. Try a few rounds after this lesson.`,
          `نت‌های راهنما همان چیزی است که آزمون نت‌شناسی تمرین می‌دهد. بعد از این درس چند دور آن را امتحان کنید.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'ledger-lines',
      unit: 'notes',
      minutes: 3,
      title: { en: `Ledger lines`, fa: `خط‌های کمکی` },
      summary: { en: `Short extra lines for notes above or below the staff.`, fa: `خط‌های کوتاه اضافی برای نت‌های بالا یا پایین حامل.` },
      blocks: [
        p(
          `The staff has only five lines, but music goes higher and lower than that. For those notes we draw short extra lines called ledger lines, just wide enough for the note.`,
          `حامل فقط پنج خط دارد ولی موسیقی بالاتر و پایین‌تر از آن هم می‌رود. برای آن نت‌ها خط‌های کوتاهی می‌کشیم که خط کمکی نام دارند و فقط به اندازه‌ی خود نت پهن‌اند.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q A5q C6q', free: true },
          `Treble clef: middle C has one ledger line below. {A} has one above, {C} has two.`,
          `کلید سل: دوی میانی یک خط کمکی زیرش دارد. {A} یکی بالایش دارد و {C} دوتا.`,
          { names: true }
        ),
        staff(
          { clef: 'bass', notes: 'C2q E2q C4q', free: true },
          `Bass clef: {E} has one ledger line below and {C} has two. Middle C has one above.`,
          `کلید فا: {E} یک خط کمکی زیرش دارد و {C} دوتا. دوی میانی یکی بالایش دارد.`,
          { names: true }
        ),
        p(
          `Count ledger lines exactly like staff lines: line, space, line, space. The first space above the staff is followed by the first ledger line.`,
          `خط‌های کمکی را درست مثل خط‌های حامل بشمارید: خط، فاصله، خط، فاصله. بعد از اولین فاصله‌ی بالای حامل، اولین خط کمکی می‌آید.`
        ),
        tip(
          `Treat the common ledger-line notes as landmarks: middle C, {A} and {C} above the treble staff, {E} and {C} below the bass staff.`,
          `نت‌های پرکاربرد خط کمکی را هم نت راهنما بدانید: دوی میانی، {A} و {C} بالای حامل کلید سل، {E} و {C} زیر حامل کلید فا.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'octaves',
      unit: 'notes',
      minutes: 3,
      title: { en: `Octaves`, fa: `اکتاو` },
      summary: { en: `Same name, higher or lower, and the numbers that tell them apart.`, fa: `نام یکسان، بالاتر یا پایین‌تر، و شماره‌هایی که آن‌ها را از هم جدا می‌کنند.` },
      blocks: [
        p(
          `Two notes with the same name, eight steps apart, are an octave apart. They sound like the same note, one higher and one lower. This is why the note names repeat.`,
          `دو نت با نام یکسان که هشت پله از هم فاصله دارند، یک اکتاو با هم فاصله دارند. این دو مثل یک نت به گوش می‌رسند، یکی زیرتر و دیگری بم‌تر. نام‌ها به همین دلیل تکرار می‌شوند.`
        ),
        p(
          `To tell the octaves apart we add a number: middle C is {C4}, the next {C} up is {C5}, the one below is {C3}. The number goes up by one at every {C}.`,
          `برای این‌که اکتاوها را از هم جدا کنیم یک شماره اضافه می‌کنیم: دوی میانی {C4} است، {C} بعدی بالاتر {C5} و {C} پایین‌تر {C3}. شماره در هر {C} یکی زیاد می‌شود.`
        ),
        staff(
          { clef: 'grand', notes: 'rw | C4w | C5w | C6w', lower: 'C2w | C3w | rw | rw' },
          `Five Cs, from low to high. Each one is an octave above the one before.`,
          `پنج {C} از بم به زیر. هر کدام یک اکتاو بالاتر از قبلی است.`,
          { names: 'octave', listen: true }
        ),
        tip(
          `Count the steps between two notes of the same name: {C} {D} {E} {F} {G} {A} {B} {C} is eight notes, which is why it is called an octave.`,
          `پله‌های میان دو نت هم‌نام را بشمارید: {C} {D} {E} {F} {G} {A} {B} {C} هشت نت است و به همین دلیل اکتاو (هشتم) نام دارد.`
        ),
      ],
      actions: ['quiz'],
    },
    {
      id: 'accidentals',
      unit: 'notes',
      minutes: 5,
      title: { en: `Sharps, flats and naturals`, fa: `دیز، بمل و بکار` },
      summary: { en: `Signs that move a note up or down by a half step.`, fa: `علامت‌هایی که نت را نیم‌پرده بالا یا پایین می‌برند.` },
      blocks: [
        p(
          `Between most neighbouring note names there is another note. A sign in front of a note changes it by a half step, the smallest distance on the piano.`,
          `میان بیشتر نت‌های همسایه نت دیگری هم هست. علامتی که جلوی نت می‌آید آن را یک نیم‌پرده تغییر می‌دهد؛ نیم‌پرده کوچک‌ترین فاصله در پیانوست.`
        ),
        terms(
          [`♯`, `Sharp: raises the note by a half step.`, `دیز: نت را نیم‌پرده بالا می‌برد.`],
          [`♭`, `Flat: lowers the note by a half step.`, `بمل: نت را نیم‌پرده پایین می‌آورد.`],
          [`♮`, `Natural: cancels a sharp or flat.`, `بکار: دیز یا بمل را لغو می‌کند.`]
        ),
        staff(
          { clef: 'treble', notes: 'F4q F#4q Fn4q Bb4q' },
          `{F}, then {F#}, then the natural sign brings it back to {F}, then {Bb}.`,
          `ابتدا {F}، بعد {F#}، بعد علامت بکار آن را به {F} برمی‌گرداند و آخر {Bb}.`,
          { names: true, listen: true }
        ),
        h(`How long a sign lasts`, `اعتبار علامت`),
        p(
          `The sign is written before the note, and it holds for every note of the same pitch until the end of the measure. The next barline cancels it. Another octave is a different pitch, so it needs its own sign.`,
          `علامت قبل از نت نوشته می‌شود و برای همه‌ی نت‌های هم‌ارتفاع تا پایان همان میزان معتبر است. خط میزان بعدی آن را لغو می‌کند. اکتاو دیگر ارتفاع دیگری است و علامت خودش را لازم دارد.`
        ),
        staff(
          { clef: 'treble', notes: 'F#4q F#4q F4q F4q | F4w' },
          `The second {F#} needs no new sign. A natural sign is needed to get back to {F} inside the measure; the next measure begins fresh.`,
          `برای {F#} دوم علامت تازه‌ای لازم نیست. برای برگشتن به {F} در همان میزان علامت بکار لازم است و میزان بعد از نو شروع می‌شود.`,
          { names: true }
        ),
        p(
          `The same key can have two names. {C#} and {Db} are the same black key on the piano; which one is written depends on the music around it. Such notes are called enharmonic.`,
          `یک کلید می‌تواند دو نام داشته باشد. {C#} و {Db} روی پیانو یک کلید سیاه‌اند و این‌که کدام نوشته شود به موسیقی اطراف آن بستگی دارد. به چنین نت‌هایی هم‌صدا (انهارمونیک) می‌گویند.`
        ),
      ],
      actions: ['levels'],
    },
    {
      id: 'key-signatures',
      unit: 'notes',
      minutes: 5,
      title: { en: `Key signatures`, fa: `آرمور` },
      summary: { en: `Sharps or flats at the start of the line that apply to the whole piece.`, fa: `دیزها یا بمل‌های ابتدای خط که برای کل قطعه معتبرند.` },
      blocks: [
        p(
          `Writing a sharp every time would clutter the page. If a piece uses {F#} all the time, the sharp is written once at the start of every line, next to the clef. This group of signs is the key signature.`,
          `اگر قطعه‌ای همیشه {F#} به کار ببرد، نوشتن دیز در هر بار صفحه را شلوغ می‌کند. به جای آن، دیز یک بار در ابتدای هر خط، کنار کلید، نوشته می‌شود. این مجموعه‌ی علامت‌ها آرمور است.`
        ),
        p(
          `A key signature works on every octave and in every measure, until another one replaces it. You do not repeat the sign in front of each note.`,
          `آرمور در همه‌ی اکتاوها و همه‌ی میزان‌ها معتبر است تا وقتی که آرمور دیگری جایش را بگیرد. جلوی هر نت لازم نیست علامت را دوباره بنویسید.`
        ),
        staff(
          { clef: 'treble', fifths: 1, notes: 'G4q A4q B4q C5q | D5q E5q F#5q G5q' },
          `One sharp at the start: {F#}. The {F#} in the second measure has no sign of its own, because the key signature already covers it. This is the key of {G} major.`,
          `یک دیز در ابتدا: {F#}. برای {F#} میزان دوم علامت جداگانه‌ای نیست چون آرمور آن را پوشش می‌دهد. این گام {G} ماژور است.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'treble', fifths: -1, notes: 'F4q G4q A4q Bb4q | C5q D5q E5q F5q' },
          `One flat at the start: {Bb}. This is the key of {F} major.`,
          `یک بمل در ابتدا: {Bb}. این گام {F} ماژور است.`,
          { names: true, listen: true }
        ),
        h(`Which key is it?`, `این چه گامی است؟`),
        terms(
          [`0`, `No sharps or flats: {C} major`, `بدون دیز و بمل: گام {C} ماژور`],
          [`1 ♯`, `{G} major (sharp: {F#})`, `گام {G} ماژور (دیز: {F#})`],
          [`2 ♯`, `{D} major (sharps: {F#} {C#})`, `گام {D} ماژور (دیزها: {F#} {C#})`],
          [`1 ♭`, `{F} major (flat: {Bb})`, `گام {F} ماژور (بمل: {Bb})`],
          [`2 ♭`, `{Bb} major (flats: {Bb} {Eb})`, `گام {Bb} ماژور (بمل‌ها: {Bb} {Eb})`]
        ),
        p(
          `Sharps always appear in the same order: {F} {C} {G} {D} {A} {E} {B}. Flats appear in the reverse order: {B} {E} {A} {D} {G} {C} {F}.`,
          `دیزها همیشه به همین ترتیب می‌آیند: {F} {C} {G} {D} {A} {E} {B}. بمل‌ها به ترتیب عکس: {B} {E} {A} {D} {G} {C} {F}.`
        ),
        tip(
          `A quick rule for sharps: the major key is one half step above the last sharp. For flats (two or more): the major key is the name of the second-to-last flat.`,
          `یک راه سریع برای دیزها: گام ماژور یک نیم‌پرده بالاتر از آخرین دیز است. برای بمل‌ها (دو بمل یا بیشتر): نام گام ماژور همان نام یکی‌مانده‌به‌آخرین بمل است.`
        ),
      ],
      actions: ['levels'],
    },
    {
      id: 'steps-skips',
      unit: 'notes',
      minutes: 4,
      title: { en: `Steps, skips and leaps`, fa: `پله، جهش کوچک و جهش بزرگ` },
      summary: { en: `Read the distance between notes by the shape they make.`, fa: `فاصله‌ی میان نت‌ها را از روی شکلشان بخوانید.` },
      blocks: [
        p(
          `You rarely need to read every note on its own. It is faster to read the movement: does the next note stay, step, skip or leap?`,
          `کمتر پیش می‌آید که لازم باشد هر نت را جداگانه بخوانید. خواندنِ حرکت سریع‌تر است: نت بعدی می‌ماند، یک پله می‌رود، یک خط را می‌پرد یا جهش بزرگ می‌کند؟`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q' },
          `Steps: each note moves to the next line or space. Notes look like a staircase.`,
          `حرکت پله‌ای: هر نت به خط یا فاصله‌ی بعدی می‌رود. نت‌ها مثل پلکان دیده می‌شوند.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C4q E4q G4q B4q' },
          `Skips: each note jumps over one line or space. They are all on lines or all in spaces.`,
          `جهش کوچک: هر نت از روی یک خط یا فاصله می‌پرد. همه‌ی نت‌ها یا روی خط‌اند یا در فاصله.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C4q G4q C5q G4q' },
          `Leaps: larger jumps. Count the lines and spaces between the notes.`,
          `جهش بزرگ: پرش‌های بزرگ‌تر. خط‌ها و فاصله‌های میان نت‌ها را بشمارید.`,
          { names: true, listen: true }
        ),
        p(
          `Musicians name the distance between two notes by counting both of them. A step is a second, a skip is a third, and the next ones are a fourth, a fifth and so on. Eight steps from one note to the next of the same name is an octave.`,
          `نوازندگان فاصله‌ی دو نت را با شمردن هر دوی آن‌ها نام می‌برند. یک پله فاصله‌ی دوم است، یک جهش کوچک فاصله‌ی سوم، و بعد چهارم و پنجم و همین‌طور تا هشتم که همان اکتاو است.`
        ),
        tip(
          `Before you play a phrase, look at its shape from left to right. Reading shapes and landmarks together is what sight-reading is.`,
          `پیش از نواختن یک عبارت، شکل آن را از چپ به راست ببینید. خواندن هم‌زمان شکل‌ها و نت‌های راهنما همان خواندن آنی (سایت‌ریدینگ) است.`
        ),
      ],
      actions: ['levels', 'quiz'],
    },
    {
      id: 'first-tune',
      unit: 'notes',
      minutes: 3,
      title: { en: `Your first tune`, fa: `اولین ملودی` },
      summary: { en: `Put it all together by reading a real melody.`, fa: `هر آنچه آموختید را با خواندن یک ملودی واقعی کنار هم بگذارید.` },
      blocks: [
        p(
          `You now know enough to read a whole melody. This is a traditional nursery tune, written in the treble clef with only five different notes.`,
          `اکنون برای خواندن یک ملودی کامل به اندازه‌ی کافی می‌دانید. این یک آهنگ کودکانه‌ی سنتی است که در کلید سل و فقط با پنج نت متفاوت نوشته شده.`
        ),
        staff(
          { clef: 'treble', notes: 'E4q D4q C4q D4q | E4q E4q E4h | D4q D4q D4h | E4q G4q G4h' },
          `Read it in three steps: the shape, then the first note, then the steps and skips.`,
          `در سه گام بخوانید: اول شکل، بعد نت اول، بعد پله‌ها و جهش‌ها.`,
          { names: true, listen: true }
        ),
        list(
          [`Find the first note, then say the others as you move along the shape.`, `نت اول را پیدا کنید و بعد با دنبال کردن شکل، بقیه را بگویید.`],
          [`Spot the repeated notes: a repeat is just a note on the same line or space.`, `نت‌های تکراری را ببینید؛ تکرار یعنی نتی روی همان خط یا فاصله.`],
          [`Play it slowly with the song steps in the Songs section, then try without the names.`, `در بخش «آهنگ‌ها» آن را با مرحله‌های آموزشی آهسته بنوازید، و بعد بدون نام نت‌ها امتحان کنید.`]
        ),
        p(
          `The same tune is waiting in the Songs section, with a practice mode that breaks it into small steps for you.`,
          `همین آهنگ در بخش «آهنگ‌ها» منتظر شماست، با حالت تمرینی که آن را برایتان به گام‌های کوچک تقسیم می‌کند.`
        ),
      ],
      actions: ['songs', 'quiz'],
    },
  ],
};
