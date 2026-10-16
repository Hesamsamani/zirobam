import { fingers, h, keys, list, p, staff, terms, tip } from './build';
import type { Unit } from './types';

/** Unit 3: the instrument. Key pictures are clickable, so the student can hear what they read. */
export const PIANO_UNIT: Unit = {
  id: 'piano',
  title: { en: `Playing the piano`, fa: `نواختن پیانو` },
  summary: {
    en: `The keyboard, sitting and hand position, fingering, both hands, touch, scales and the pedal.`,
    fa: `صفحه‌کلید، نشستن و حالت دست، انگشت‌گذاری، دو دست، لمس کلید، گام‌ها و پدال.`,
  },
  lessons: [
    {
      id: 'meet-the-keyboard',
      unit: 'piano',
      minutes: 3,
      title: { en: `Meet the keyboard`, fa: `آشنایی با صفحه‌کلید` },
      summary: { en: `White keys, black keys and the pattern they make.`, fa: `کلیدهای سفید و سیاه و الگویی که می‌سازند.` },
      blocks: [
        p(
          `A full piano has 88 keys: 52 white and 36 black. Keys to the left sound lower and keys to the right sound higher. Many keyboards and digital pianos are smaller, with 61 or 76 keys; they work the same way.`,
          `یک پیانوی کامل ۸۸ کلید دارد: ۵۲ سفید و ۳۶ سیاه. کلیدهای سمت چپ بم‌ترند و کلیدهای سمت راست زیرتر. بسیاری از کیبوردها و پیانوهای دیجیتال کوچک‌ترند و ۶۱ یا ۷۶ کلید دارند؛ اما کار آن‌ها یکی است.`
        ),
        keys(
          'C4',
          'B4',
          { names: 'none' },
          `One octave of the keyboard. Click the keys to hear them: left is lower, right is higher.`,
          `یک اکتاو از صفحه‌کلید. روی کلیدها بزنید تا صدایشان را بشنوید؛ چپ بم‌تر و راست زیرتر.`
        ),
        p(
          `Look at the black keys: they come in groups of two and groups of three. This pattern repeats along the whole keyboard and is the map you will use to find every note.`,
          `به کلیدهای سیاه نگاه کنید؛ آن‌ها در دسته‌های دوتایی و سه‌تایی قرار دارند. این الگو در تمام صفحه‌کلید تکرار می‌شود و نقشه‌ای است که برای پیدا کردن همه‌ی نت‌ها به کار می‌برید.`
        ),
        tip(
          `The piano's full name, pianoforte, means "soft-loud": it can play both softly and loudly, depending on how you touch the keys.`,
          `نام کامل پیانو، «پیانوفورته»، یعنی «آرام و بلند»: بسته به لمس شما هم آرام می‌نوازد و هم بلند.`
        ),
      ],
    },
    {
      id: 'finding-notes',
      unit: 'piano',
      minutes: 4,
      title: { en: `Finding notes`, fa: `پیدا کردن نت‌ها` },
      summary: { en: `Use the groups of black keys to find any white key.`, fa: `با دسته‌های کلید سیاه هر کلید سفید را پیدا کنید.` },
      blocks: [
        p(
          `Two white keys have a clear address. {C} is the white key just to the left of a group of two black keys. {F} is the white key just to the left of a group of three black keys.`,
          `دو کلید سفید نشانی روشنی دارند. {C} کلید سفیدی است که درست سمت چپ دسته‌ی دوتایی سیاه‌ها قرار دارد. {F} کلید سفیدی است که درست سمت چپ دسته‌ی سه‌تایی سیاه‌ها قرار دارد.`
        ),
        keys(
          'C4',
          'B4',
          { names: 'none', marks: { C4: '{C}', F4: '{F}' } },
          `{C} to the left of the two black keys, {F} to the left of the three.`,
          `کلید {C} سمت چپ دو سیاه و کلید {F} سمت چپ سه سیاه.`
        ),
        p(
          `Count from them. {D} sits between the two black keys of the pair. {E} is to the right of the pair. {G} and {A} sit between the black keys of the group of three, and {B} is the white key to the right of that group.`,
          `از روی آن‌ها بشمارید. {D} میان دو کلید سیاهِ دسته‌ی دوتایی است. {E} سمت راست آن دسته است. {G} و {A} میان کلیدهای سیاه دسته‌ی سه‌تایی هستند و {B} کلید سفید سمت راست آن دسته است.`
        ),
        keys(
          'C4',
          'B4',
          { names: 'white' },
          `All seven white keys, with their names.`,
          `هر هفت کلید سفید، با نامشان.`
        ),
        tip(
          `Without looking at the names, find every {C} on the keyboard. Then find every {F}. Do this a few times and you will not get lost on the keys again.`,
          `بدون نگاه کردن به نام‌ها، همه‌ی {C}‌های صفحه‌کلید را پیدا کنید. بعد همه‌ی {F}‌ها را. چند بار که این کار را بکنید دیگر روی کلیدها گم نمی‌شوید.`
        ),
      ],
      actions: ['xylophone'],
    },
    {
      id: 'black-keys',
      unit: 'piano',
      minutes: 3,
      title: { en: `The black keys`, fa: `کلیدهای سیاه` },
      summary: { en: `Each black key has two names, a sharp and a flat.`, fa: `هر کلید سیاه دو نام دارد، یک دیز و یک بمل.` },
      blocks: [
        p(
          `A black key is named after its white neighbours. It is the sharp of the white key on its left and the flat of the white key on its right. That gives every black key two names.`,
          `هر کلید سیاه از روی همسایه‌های سفیدش نام می‌گیرد. آن، دیزِ کلید سفید سمت چپش و بملِ کلید سفید سمت راستش است. به این ترتیب هر کلید سیاه دو نام دارد.`
        ),
        keys(
          'C4',
          'B4',
          { names: 'all' },
          `The five black keys, each with its sharp name and its flat name.`,
          `پنج کلید سیاه، هر کدام با نام دیز و نام بملش.`
        ),
        p(
          `Between {E} and {F} and between {B} and {C} there is no black key. These pairs are a half step apart already. Everywhere else the white keys are a whole step apart, with a black key in the middle.`,
          `میان {E} و {F} و میان {B} و {C} کلید سیاهی نیست. این جفت‌ها همین‌طوری هم یک نیم‌پرده با هم فاصله دارند. در بقیه‌جاها فاصله‌ی کلیدهای سفید یک پرده است و یک کلید سیاه در میانشان قرار دارد.`
        ),
        tip(
          `Which name is used, sharp or flat, depends on the key signature of the piece. The key on the piano is the same.`,
          `این‌که دیز نوشته شود یا بمل به آرمور قطعه بستگی دارد. کلید روی پیانو یکی است.`
        ),
      ],
    },
    {
      id: 'staff-and-keys',
      unit: 'piano',
      minutes: 3,
      title: { en: `From the staff to the keys`, fa: `از حامل تا کلیدها` },
      summary: { en: `See how a note on the page becomes a key under your finger.`, fa: `ببینید یک نت روی صفحه چطور تبدیل به کلید زیر انگشت می‌شود.` },
      blocks: [
        p(
          `Each step up the staff is the next white key to the right. Each step down is the next white key to the left. Notes on the same line or space are the same key.`,
          `هر پله بالا رفتن روی حامل، کلید سفید بعدی سمت راست است. هر پله پایین آمدن، کلید سفید بعدی سمت چپ. نت‌هایی که روی یک خط یا فاصله‌اند، یک کلیدند.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q E4q G4q C5q' },
          `Four notes on the staff…`,
          `چهار نت روی حامل…`,
          { names: true, listen: true }
        ),
        keys(
          'C4',
          'C5',
          { names: 'white', marks: { C4: '', E4: '', G4: '', C5: '' } },
          `…and the same four keys on the piano.`,
          `…و همان چهار کلید روی پیانو.`
        ),
        p(
          `Middle C is the {C} nearest to the middle of the keyboard. The treble clef notes you have seen so far are to its right; the bass clef notes are to its left.`,
          `دوی میانی نزدیک‌ترین {C} به وسط صفحه‌کلید است. نت‌های کلید سل که تا حالا دیده‌اید سمت راست آن هستند و نت‌های کلید فا سمت چپ.`
        ),
      ],
      actions: ['quiz', 'levels'],
    },
    {
      id: 'sitting-and-hands',
      unit: 'piano',
      minutes: 4,
      title: { en: `Sitting and hand shape`, fa: `نشستن و حالت دست` },
      summary: { en: `A relaxed body is the basis of good tone and no pain.`, fa: `بدن آرام پایه‌ی صدای خوب و نداشتن درد است.` },
      blocks: [
        p(
          `Good posture lets you play for a long time without strain. Take a minute to set up before you play.`,
          `نشستن درست به شما اجازه می‌دهد بدون فشار مدت زیادی بنوازید. پیش از نواختن یک دقیقه برای آماده شدن وقت بگذارید.`
        ),
        h(`Your body`, `بدن`),
        list(
          [`Sit on the front half of the bench, with your back straight but not stiff.`, `روی نیمه‌ی جلویی نیمکت بنشینید، با پشت صاف ولی نه خشک.`],
          [`Sit at about an arm's length from the keys, in front of middle C.`, `حدود یک بازو با کلیدها فاصله بگیرید و جلوی دوی میانی بنشینید.`],
          [`Your forearms should be level with the keys, with the elbows slightly away from the body.`, `ساعدها باید هم‌سطح کلیدها باشند و آرنج‌ها کمی از بدن فاصله داشته باشند.`],
          [`Keep your shoulders low and loose, and your feet flat on the floor.`, `شانه‌ها را پایین و شل نگه دارید و کف پاها روی زمین باشد.`]
        ),
        h(`Your hands`, `دست‌ها`),
        list(
          [`Curve your fingers as if you were holding a small ball.`, `انگشت‌ها را طوری خم کنید که انگار توپ کوچکی در دست دارید.`],
          [`Play with the soft tip of each finger, not the flat pad.`, `با نوک نرم هر انگشت بنوازید، نه با کف تخت آن.`],
          [`Keep your wrists level with your hand: not drooping, not raised.`, `مچ‌ها هم‌سطح دست باشند، نه افتاده و نه بالا.`],
          [`Keep your nails short, so they do not click on the keys.`, `ناخن‌ها را کوتاه نگه دارید تا روی کلیدها صدا نکنند.`]
        ),
        tip(
          `If you feel pain or tightness in your hands, wrists or shoulders, stop and rest. Playing should never hurt.`,
          `اگر در دست‌ها، مچ‌ها یا شانه‌ها درد یا گرفتگی حس کردید، بایستید و استراحت کنید. نواختن هرگز نباید درد داشته باشد.`
        ),
      ],
    },
    {
      id: 'finger-numbers',
      unit: 'piano',
      minutes: 3,
      title: { en: `Finger numbers`, fa: `شماره‌ی انگشت‌ها` },
      summary: { en: `Each finger has a number, the same in both hands.`, fa: `هر انگشت یک شماره دارد که در هر دو دست یکی است.` },
      blocks: [
        p(
          `Piano music tells you which finger to use with small numbers above or below the notes. Fingers are numbered from the thumb: 1 is the thumb, 2 the index finger, 3 the middle finger, 4 the ring finger and 5 the little finger. The numbers are the same on both hands.`,
          `در نت‌های پیانو با عددهای کوچک بالا یا پایین نت‌ها می‌گویند با کدام انگشت بنوازید. انگشت‌ها از شست شماره می‌خورند: ۱ شست، ۲ اشاره، ۳ میانی، ۴ انگشتر و ۵ انگشت کوچک. شماره‌ها در هر دو دست یکسان‌اند.`
        ),
        fingers(
          `Both hands seen from above, with the finger numbers.`,
          `هر دو دست از بالا، با شماره‌ی انگشت‌ها.`
        ),
        p(
          `Good fingering makes passages smooth. When a piece does not tell you, choose the fingering that keeps your hand comfortable and write it in. Use the same fingers every time you play the passage.`,
          `انگشت‌گذاری خوب قطعه را روان می‌کند. وقتی قطعه چیزی نمی‌گوید، انگشت‌گذاری‌ای را انتخاب کنید که دست شما را راحت نگه دارد و آن را بنویسید. هر بار که آن قسمت را می‌نوازید همان انگشت‌ها را به کار ببرید.`
        ),
      ],
    },
    {
      id: 'five-finger-position',
      unit: 'piano',
      minutes: 4,
      title: { en: `The five-finger position`, fa: `وضعیت پنج‌انگشتی` },
      summary: { en: `Rest each hand on five neighbouring keys. Your first real playing position.`, fa: `هر دست را روی پنج کلید کنار هم بگذارید. اولین وضعیت واقعی نواختن.` },
      blocks: [
        p(
          `Put your right thumb on middle C and let each of your other fingers rest on the next white key: 1 on {C}, 2 on {D}, 3 on {E}, 4 on {F}, 5 on {G}. Your hand stays in one place; each finger plays its own key.`,
          `شست دست راست را روی دوی میانی بگذارید و هر یک از انگشت‌های دیگر را روی کلید سفید بعدی رها کنید: ۱ روی {C}، ۲ روی {D}، ۳ روی {E}، ۴ روی {F}، ۵ روی {G}. دست در جای خود می‌ماند و هر انگشت کلید خودش را می‌زند.`
        ),
        keys(
          'C4',
          'G4',
          { names: 'white', marks: { C4: '1', D4: '2', E4: '3', F4: '4', G4: '5' } },
          `Right hand: thumb (1) on middle C, little finger (5) on {G}.`,
          `دست راست: شست (۱) روی دوی میانی، انگشت کوچک (۵) روی {G}.`
        ),
        p(
          `The left hand mirrors it. Put the little finger on the {C} below middle C and the thumb on {G}: 5 on {C}, 4 on {D}, 3 on {E}, 2 on {F}, 1 on {G}.`,
          `دست چپ آینه‌ی آن است. انگشت کوچک را روی {C} زیر دوی میانی بگذارید و شست را روی {G}: ۵ روی {C}، ۴ روی {D}، ۳ روی {E}، ۲ روی {F}، ۱ روی {G}.`
        ),
        keys(
          'C3',
          'G3',
          { names: 'white', marks: { C3: '5', D3: '4', E3: '3', F3: '2', G3: '1' } },
          `Left hand: little finger (5) on {C}, thumb (1) on {G}.`,
          `دست چپ: انگشت کوچک (۵) روی {C}، شست (۱) روی {G}.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q | G4q F4q E4q D4q | C4w' },
          `Right hand, up and down the five notes. Fingers: 1 2 3 4 | 5 4 3 2 | 1.`,
          `دست راست، بالا و پایین روی پنج نت. انگشت‌ها: ۱ ۲ ۳ ۴ | ۵ ۴ ۳ ۲ | ۱.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'bass', notes: 'C3q D3q E3q F3q | G3q F3q E3q D3q | C3w' },
          `Left hand, the same pattern. Fingers: 5 4 3 2 | 1 2 3 4 | 5.`,
          `دست چپ، همان الگو. انگشت‌ها: ۵ ۴ ۳ ۲ | ۱ ۲ ۳ ۴ | ۵.`,
          { names: true, listen: true }
        ),
      ],
      actions: ['levels'],
    },
    {
      id: 'two-hands',
      unit: 'piano',
      minutes: 4,
      title: { en: `Playing with both hands`, fa: `نواختن با دو دست` },
      summary: { en: `How to read two staves at once and get your hands to cooperate.`, fa: `چگونه دو حامل را هم‌زمان بخوانید و دست‌هایتان را با هم هماهنگ کنید.` },
      blocks: [
        p(
          `On the grand staff, notes that are lined up above each other are played at the same time. Read the page from left to right, and look at both staves together.`,
          `روی حامل بزرگ، نت‌هایی که بالای هم قرار دارند هم‌زمان نواخته می‌شوند. صفحه را از چپ به راست بخوانید و هر دو حامل را با هم ببینید.`
        ),
        staff(
          { clef: 'grand', notes: 'E4q F4q G4h | G4q F4q E4h', lower: 'C3w | C3w' },
          `The right hand plays the tune, the left hand holds a long note. Play the left-hand note when the first right-hand note starts.`,
          `دست راست ملودی را می‌نوازد و دست چپ یک نت بلند را نگه می‌دارد. نت دست چپ را همراه با اولین نت دست راست بزنید.`,
          { names: true, listen: true }
        ),
        h(`A way to learn it`, `روشی برای یادگیری`),
        list(
          [`Learn each hand on its own until it is easy and you can look away from the keys.`, `هر دست را جداگانه یاد بگیرید تا راحت شود و بتوانید از کلیدها چشم بردارید.`],
          [`Put the hands together very slowly, even at half the final tempo.`, `دو دست را خیلی آهسته با هم بگذارید، حتی با نصف سرعت نهایی.`],
          [`Work on the places where the hands move together, one measure at a time.`, `روی جاهایی که دست‌ها با هم حرکت می‌کنند کار کنید، هر بار یک میزان.`],
          [`Keep looking ahead on the page, not down at your hands.`, `به جلو در صفحه نگاه کنید، نه پایین به دست‌هایتان.`]
        ),
        tip(
          `The practice mode in the Songs section uses exactly this recipe: it breaks the piece into small steps and puts them together again.`,
          `حالت تمرین در بخش «آهنگ‌ها» دقیقاً همین دستور را به کار می‌برد: قطعه را به گام‌های کوچک تقسیم می‌کند و دوباره کنار هم می‌گذارد.`
        ),
      ],
      actions: ['songs', 'levels'],
    },
    {
      id: 'touch-dynamics',
      unit: 'piano',
      minutes: 4,
      title: { en: `Touch and volume`, fa: `لمس کلید و شدت صدا` },
      summary: { en: `Soft, loud, smooth and short: how you play changes how it sounds.`, fa: `آرام، بلند، روان و کوتاه: شیوه‌ی نواختن صدا را تغییر می‌دهد.` },
      blocks: [
        p(
          `On the piano, how hard or how fast you press a key decides how loud the note is. Composers write the volume with Italian letters under the staff. They are called dynamics.`,
          `روی پیانو، میزان فشار یا سرعتِ فشردن کلید، بلندی صدا را تعیین می‌کند. آهنگسازها شدت صدا را با حرف‌های ایتالیایی زیر حامل می‌نویسند. به آن‌ها دینامیک می‌گویند.`
        ),
        terms(
          [`pp`, `pianissimo: very soft`, `پیانیسیمو: خیلی آرام`],
          [`p`, `piano: soft`, `پیانو: آرام`],
          [`mp`, `mezzo piano: medium soft`, `مزوپیانو: نسبتاً آرام`],
          [`mf`, `mezzo forte: medium loud`, `مزوفورته: نسبتاً بلند`],
          [`f`, `forte: loud`, `فورته: بلند`],
          [`ff`, `fortissimo: very loud`, `فورتیسیمو: خیلی بلند`]
        ),
        terms(
          [`cresc.`, `crescendo: gradually louder`, `کرشندو: کم‌کم بلندتر`],
          [`dim.`, `diminuendo: gradually softer`, `دیمینوئندو: کم‌کم آرام‌تر`]
        ),
        h(`Smooth or short`, `روان یا کوتاه`),
        terms(
          [`legato`, `smooth and connected: let one note flow into the next.`, `لگاتو: روان و پیوسته؛ بگذارید یک نت به نت بعدی برسد.`],
          [`staccato`, `short and detached: a dot above or below the note.`, `استاکاتو: کوتاه و جدا؛ نقطه‌ای بالا یا پایین نت.`]
        ),
        tip(
          `Try one key at three volumes: soft, medium and loud. Listen to how much control your hand has. The control matters more than the loudness.`,
          `یک کلید را با سه شدت بزنید: آرام، متوسط و بلند. گوش بدهید دست شما چقدر کنترل دارد. کنترل مهم‌تر از بلندی است.`
        ),
      ],
    },
    {
      id: 'scales',
      unit: 'piano',
      minutes: 5,
      title: { en: `Whole steps, half steps and the major scale`, fa: `پرده، نیم‌پرده و گام ماژور` },
      summary: { en: `The pattern that builds the sound of Do Re Mi.`, fa: `الگویی که صدای دو، ر، می را می‌سازد.` },
      blocks: [
        p(
          `The distance from one key to the very next key, black or white, is a half step. Two half steps make a whole step.`,
          `فاصله‌ی یک کلید تا کلید بعدی، چه سیاه و چه سفید، یک نیم‌پرده است. دو نیم‌پرده یک پرده می‌شود.`
        ),
        p(
          `A major scale is eight notes with this pattern of steps: whole, whole, half, whole, whole, whole, half. Starting on {C}, the pattern needs no black keys at all.`,
          `گام ماژور هشت نت است با این الگوی فاصله‌ها: پرده، پرده، نیم‌پرده، پرده، پرده، پرده، نیم‌پرده. اگر از {C} شروع کنید، این الگو اصلاً کلید سیاه لازم ندارد.`
        ),
        keys(
          'C4',
          'C5',
          { names: 'white', marks: { E4: '½', F4: '½', B4: '½', C5: '½' } },
          `The two half steps of the {C} major scale: {E} to {F} and {B} to {C}. All the other steps are whole steps.`,
          `دو نیم‌پرده‌ی گام {C} ماژور: {E} تا {F} و {B} تا {C}. بقیه‌ی فاصله‌ها پرده‌اند.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q | G4q A4q B4q C5q' },
          `The {C} major scale. Right-hand fingers: 1 2 3 1 2 3 4 5, the thumb passing under the hand after the third finger.`,
          `گام {C} ماژور. انگشت‌گذاری دست راست: ۱ ۲ ۳ ۱ ۲ ۳ ۴ ۵؛ شست بعد از انگشت سوم از زیر دست رد می‌شود.`,
          { names: true, listen: true }
        ),
        p(
          `To make a major scale on another note, use the same pattern. Starting on {G}, the pattern gives you one black key: {F}♯. That is why the key signature of {G} major has one sharp.`,
          `برای ساختن گام ماژور روی نت دیگر، همین الگو را به کار ببرید. اگر از {G} شروع کنید، الگو یک کلید سیاه می‌دهد: {F#}. به همین دلیل آرمور {G} ماژور یک دیز دارد.`
        ),
        staff(
          { clef: 'treble', fifths: 1, notes: 'G4q A4q B4q C5q | D5q E5q F#5q G5q' },
          `The {G} major scale with its one sharp.`,
          `گام {G} ماژور با یک دیز.`,
          { names: true, listen: true }
        ),
      ],
      actions: ['levels'],
    },
    {
      id: 'pedal',
      unit: 'piano',
      minutes: 3,
      title: { en: `The pedals`, fa: `پدال‌ها` },
      summary: { en: `What the pedals do and when to start using them.`, fa: `پدال‌ها چه می‌کنند و کی باید استفاده از آن‌ها را شروع کرد.` },
      blocks: [
        p(
          `A piano has up to three pedals, played with the feet. You will mostly use the right one.`,
          `پیانو تا سه پدال دارد که با پا زده می‌شوند. بیشتر از پدال راست استفاده می‌کنید.`
        ),
        list(
          [`Right pedal (sustain): lifts the dampers so all notes keep sounding after you lift your fingers. It makes the sound rich and connected.`, `پدال راست (سوستین): صدا خفه‌کن‌ها را بلند می‌کند و همه‌ی نت‌ها بعد از برداشتن انگشت هم می‌مانند. صدا را پر و پیوسته می‌کند.`],
          [`Left pedal (soft): makes the sound softer and gentler.`, `پدال چپ (آرام): صدا را آرام‌تر و ملایم‌تر می‌کند.`],
          [`Middle pedal: on grand pianos, it holds only the notes you were playing when you pressed it. Many pianos do not have it.`, `پدال وسط: روی پیانوهای گرند فقط نت‌هایی را نگه می‌دارد که هنگام فشردن پدال می‌نواختید. بسیاری از پیانوها آن را ندارند.`]
        ),
        h(`Using the sustain pedal`, `استفاده از پدال سوستین`),
        list(
          [`Play the note first, then press the pedal down.`, `اول نت را بزنید و بعد پدال را فشار دهید.`],
          [`Lift the pedal quickly when the harmony changes, and press it again straight away.`, `وقتی هارمونی عوض می‌شود پدال را سریع رها کنید و بلافاصله دوباره فشار دهید.`],
          [`Keep your heel on the floor and move only your toes.`, `پاشنه را روی زمین نگه دارید و فقط پنجه را حرکت دهید.`]
        ),
        tip(
          `Do not use the pedal while you are learning the notes. First get the notes and the rhythm clean, then add the pedal. Too much pedal blurs everything together.`,
          `هنگام یاد گرفتن نت‌ها از پدال استفاده نکنید. اول نت‌ها و ریتم را تمیز کنید، بعد پدال را اضافه کنید. پدال زیاد همه‌چیز را در هم می‌ریزد.`
        ),
      ],
    },
    {
      id: 'practising',
      unit: 'piano',
      minutes: 4,
      title: { en: `How to practise`, fa: `چگونه تمرین کنیم` },
      summary: { en: `Short, slow, focused and regular beats long and hurried.`, fa: `کوتاه، آهسته، متمرکز و منظم بهتر از طولانی و عجولانه است.` },
      blocks: [
        p(
          `Good practice is more about how than how long. A focused fifteen minutes every day gives better results than two hours once a week.`,
          `تمرین خوب بیشتر به چگونگی بستگی دارد تا مدت‌زمان. پانزده دقیقه‌ی متمرکز در هر روز نتیجه‌ی بهتری از دو ساعت در هفته می‌دهد.`
        ),
        list(
          [`Warm up with something easy, like a five-finger pattern or a scale.`, `با چیزی آسان گرم کنید، مثل یک الگوی پنج‌انگشتی یا یک گام.`],
          [`Pick one small piece, a measure or two, and work only on that.`, `یک قطعه‌ی کوچک انتخاب کنید، یک یا دو میزان، و فقط روی همان کار کنید.`],
          [`Play it slowly, so slowly that you make no mistakes. Repeat it correctly three times in a row.`, `آن را آن‌قدر آهسته بزنید که اشتباه نکنید. سه بار پشت سر هم درست تکرار کنید.`],
          [`Use the metronome and raise the speed a little at a time.`, `از مترونوم استفاده کنید و سرعت را هر بار کمی بالا ببرید.`],
          [`Put the pieces together, then play the whole thing once without stopping.`, `تکه‌ها را کنار هم بگذارید و بعد کل قطعه را یک بار بدون توقف بزنید.`],
          [`Finish with something you enjoy.`, `با چیزی که دوست دارید تمام کنید.`]
        ),
        tip(
          `When you make a mistake, do not go on. Stop, find the measure, and fix it slowly. Each repeated mistake teaches your hands the wrong way.`,
          `وقتی اشتباه کردید ادامه ندهید. بایستید، میزان را پیدا کنید و آهسته درستش کنید. هر اشتباهِ تکراری به دست‌هایتان راه غلط را یاد می‌دهد.`
        ),
      ],
      actions: ['songs', 'metronome'],
    },
    {
      id: 'computer-keys',
      unit: 'piano',
      minutes: 3,
      title: { en: `Playing with this app`, fa: `نواختن با این برنامه` },
      summary: { en: `Use the computer keyboard, the screen, a MIDI piano or the xylophone.`, fa: `از صفحه‌کلید رایانه، صفحه نمایش، پیانوی میدی یا زایلوفون استفاده کنید.` },
      blocks: [
        p(
          `You do not need a piano to follow the lessons. The app listens to several kinds of input, and you can use any of them.`,
          `برای دنبال کردن درس‌ها به پیانو نیاز ندارید. برنامه از چند نوع ورودی صدا می‌گیرد و می‌توانید هر کدام را به کار ببرید.`
        ),
        h(`The computer keyboard`, `صفحه‌کلید رایانه`),
        p(
          `The home row plays the white keys and the row above plays the black keys. The A key is middle C. Press Z or X to move an octave down or up.`,
          `ردیف وسط حروف کلیدهای سفید را می‌زند و ردیف بالای آن کلیدهای سیاه را. کلید A همان دوی میانی است. با Z یا X یک اکتاو پایین یا بالا بروید.`
        ),
        keys(
          'C4',
          'F5',
          {
            names: 'none',
            marks: {
              C4: 'A', D4: 'S', E4: 'D', F4: 'F', G4: 'G', A4: 'H', B4: 'J', C5: 'K', D5: 'L', E5: ';', F5: `'`,
              'C#4': 'W', 'D#4': 'E', 'F#4': 'T', 'G#4': 'Y', 'A#4': 'U', 'C#5': 'O', 'D#5': 'P',
            },
          },
          `The letters printed on the keys are the computer keys that play them.`,
          `حرف‌هایی که روی کلیدها نوشته شده، کلیدهای رایانه‌ای هستند که آن‌ها را می‌زنند.`
        ),
        h(`Other ways to play`, `راه‌های دیگر نواختن`),
        list(
          [`The on-screen piano: click or tap the keys.`, `پیانوی روی صفحه: روی کلیدها کلیک کنید یا بزنید.`],
          [`A MIDI or USB keyboard: connect it, and it works as soon as the browser lets it in.`, `کیبورد میدی یا یو‌اس‌بی: آن را وصل کنید و به محض این‌که مرورگر اجازه داد کار می‌کند.`],
          [`The xylophone: a whole row of the computer keyboard becomes a xylophone, which is a fun way to practise the notes.`, `زایلوفون: یک ردیف کامل از صفحه‌کلید رایانه تبدیل به زایلوفون می‌شود و راه سرگرم‌کننده‌ای برای تمرین نت‌هاست.`]
        ),
      ],
      actions: ['xylophone', 'levels'],
    },
  ],
};
