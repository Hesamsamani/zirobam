import { h, keys, list, p, staff, tip } from './build';
import type { Unit } from './types';

/**
 * Unit 4: Persian music on the piano. DRAFT for the owner's review (docs/persian-scales-review.md): the wording of the
 * terms (dastgah, avaz, gusheh, shahed, ist, koron, sori) and the pitches of the modes are a teaching model, and the
 * text says so. Every mode drawn here is also in the scale dictionary.
 */
export const PERSIAN_UNIT: Unit = {
  id: 'persian',
  title: { en: `Persian music`, fa: `موسیقی ایرانی` },
  summary: {
    en: `Dastgahs and avazes, the quarter tones koron and sori, and how to play and hear them from a piano.`,
    fa: `دستگاه‌ها و آوازها، ربع‌پرده‌های کرن و سری، و شنیدن و نواختن آن‌ها از روی پیانو.`,
  },
  lessons: [
    {
      id: 'persian-music-map',
      unit: 'persian',
      minutes: 3,
      title: { en: `A map of Persian music`, fa: `نقشه‌ی موسیقی ایرانی` },
      summary: { en: `Radif, dastgah, avaz and gusheh in one page.`, fa: `ردیف، دستگاه، آواز و گوشه در یک صفحه.` },
      blocks: [
        p(
          `Persian classical music is built on the radif: a large collection of melodies that teachers hand down to students. The radif is divided into seven dastgahs and five avazes. Each one is a family of melodies with its own scale, its own mood and its own way of moving.`,
          `موسیقی کلاسیک ایرانی بر ردیف ساخته شده است: مجموعه‌ی بزرگی از نغمه‌ها که استادان به شاگردان می‌سپارند. ردیف به هفت دستگاه و پنج آواز بخش می‌شود. هر کدام خانواده‌ای از نغمه‌هاست با گام، حال و حرکت خودش.`
        ),
        list(
          [`Dastgah: a whole system of melodies. The seven are Shur, Mahur, Homayun, Segah, Chahargah, Nava and Rast-Panjgah.`, `دستگاه: یک نظام کامل از نغمه‌ها. هفت دستگاه این‌هاست: شور، ماهور، همایون، سه‌گاه، چهارگاه، نوا و راست‌پنجگاه.`],
          [`Avaz: a smaller family that belongs to a dastgah. The five are Abu'ata, Bayat-e Tork, Afshari, Dashti and Bayat-e Esfahan.`, `آواز: خانواده‌ای کوچک‌تر که به یک دستگاه وابسته است. پنج آواز این‌هاست: ابوعطا، بیات ترک، افشاری، دشتی و بیات اصفهان.`],
          [`Gusheh: one melody inside a dastgah or avaz, like a chapter of a book.`, `گوشه: یک نغمه در دل دستگاه یا آواز، مثل یک فصل از کتاب.`]
        ),
        tip(
          `This course shows each mode with a simple model on the piano. In real playing the pitches change with the school, the instrument and the player, so use the model to find your way in, and then listen to real music.`,
          `این درس هر گام را با یک الگوی ساده روی پیانو نشان می‌دهد. در نوازندگی واقعی بلندی نت‌ها با مکتب، ساز و نوازنده فرق می‌کند؛ پس الگو را برای شروع به کار ببرید و بعد به موسیقی واقعی گوش بدهید.`
        ),
      ],
    },
    {
      id: 'koron-and-sori',
      unit: 'persian',
      minutes: 4,
      title: { en: `Koron and sori`, fa: `کرن و سری` },
      summary: { en: `The two quarter-tone signs.`, fa: `دو علامت ربع‌پرده.` },
      blocks: [
        p(
          `A semitone is the smallest step on a piano. Persian music also uses steps that are half as big: a quarter tone. Two signs write them. A koron lowers a note by a quarter tone. A sori raises a note by a quarter tone.`,
          `نیم‌پرده کوچک‌ترین گام روی پیانوست. موسیقی ایرانی گام‌هایی نصفِ آن هم به کار می‌برد: ربع‌پرده. دو علامت آن را می‌نویسند. کرن نت را یک ربع‌پرده پایین می‌آورد و سری آن را یک ربع‌پرده بالا می‌برد.`
        ),
        staff(
          { clef: 'treble', notes: 'E4q Ek4q E4q Eo4q', fifths: 0, beats: 4 },
          `{E}, {E} koron (a quarter tone lower), {E} again, and {E} sori (a quarter tone higher). The koron sign looks like a flat with a slash.`,
          `نت {E}، سپس {E} کرن (یک ربع‌پرده پایین‌تر)، دوباره {E} و {E} سری (یک ربع‌پرده بالاتر). علامت کرن شبیه بمل خط‌خورده است.`,
          { names: true }
        ),
        p(
          `The two signs are quite different in size from the sharp and the flat: a koron moves a note half as far as a flat does, and a sori half as far as a sharp does.`,
          `اندازه‌ی این دو علامت با دیز و بمل فرق دارد: کرن نت را نصفِ بمل پایین می‌برد و سری نصفِ دیز بالا.`
        ),
        tip(
          `In the scale dictionary, the quarter-tone steps of a mode are shown in teal, and the stairs show them as steps of three quarters of a tone.`,
          `در فرهنگ‌نامه‌ی گام، گام‌های ربع‌پرده‌ای هر دستگاه به رنگ سبزآبی نشان داده می‌شود و پله‌ها آن‌ها را سه‌ربع پرده می‌نمایند.`
        ),
      ],
    },
    {
      id: 'quarter-tones-on-piano',
      unit: 'persian',
      minutes: 3,
      title: { en: `Quarter tones on a piano`, fa: `ربع‌پرده روی پیانو` },
      summary: { en: `A piano has no key between two keys.`, fa: `پیانو کلیدی میان دو کلید ندارد.` },
      blocks: [
        p(
          `A piano can only play the twelve notes it has keys for, so a quarter tone cannot be played on it. In this app a koron or sori note is played on the key of its letter, and the real sound is made by repitching the note, so you can hear the true quarter tone.`,
          `پیانو فقط دوازده نتی را می‌نوازد که برایش کلید دارد، پس ربع‌پرده را نمی‌شود روی آن زد. در این برنامه نت کرن یا سری روی کلید هم‌نامش زده می‌شود و صدای واقعی با تغییر بلندی نت ساخته می‌شود تا ربع‌پرده‌ی درست را بشنوید.`
        ),
        keys(
          'C4',
          'B4',
          { names: 'white', marks: { E4: '{Ek}' } },
          `{E} koron lies between {D} sharp and {E}. It is played on the {E} key.`,
          `نت {E} کرن میان {D} دیز و {E} است. آن را روی کلید {E} می‌زنند.`
        ),
        p(
          `On a real piano you can only get near: play the key of the letter and think of the note a little lower for a koron and a little higher for a sori. A singer, a violin or a tar can reach the exact sound.`,
          `روی پیانوی واقعی فقط می‌توانید نزدیک شوید: کلید همان حرف را بزنید و برای کرن نت را کمی پایین‌تر و برای سری کمی بالاتر در ذهن بشنوید. خواننده، ویولن یا تار به صدای دقیق می‌رسد.`
        ),
      ],
    },
    {
      id: 'dastgah-shur',
      unit: 'persian',
      minutes: 4,
      title: { en: `Dastgah Shur`, fa: `دستگاه شور` },
      summary: { en: `The most played dastgah, with one koron.`, fa: `پرکاربردترین دستگاه، با یک کرن.` },
      blocks: [
        p(
          `Shur is the home of many songs and of the avazes Abu'ata, Bayat-e Tork, Afshari and Dashti. In the model of this course it starts on {D} and has one koron, on its second note.`,
          `شور خانه‌ی بسیاری از آهنگ‌ها و آوازهای ابوعطا، بیات ترک، افشاری و دشتی است. در الگوی این درس از {D} شروع می‌شود و دومین نتش یک کرن دارد.`
        ),
        staff(
          { clef: 'treble', notes: 'D4q Ek4q F4q G4q | A4q Bb4q C5q D5q', fifths: 0, beats: 4 },
          `Shur on {D}: {D}, {E} koron, {F}, {G}, {A}, {B} flat, {C}, {D}.`,
          `شور روی {D}: {D}، {E} کرن، {F}، {G}، {A}، {B} بمل، {C}، {D}.`,
          { names: true, listen: true }
        ),
        p(
          `Listen to the step from {D} to {E} koron: it is smaller than a whole tone and larger than a semitone. That small step is what makes Shur sound like Shur. Open the scale dictionary and choose Shur to see it as stairs.`,
          `به گام {D} تا {E} کرن گوش بدهید: از یک پرده کوچک‌تر و از نیم‌پرده بزرگ‌تر است. همین گام کوچک شور را شور می‌کند. فرهنگ‌نامه‌ی گام را باز کنید و شور را انتخاب کنید تا آن را به شکل پله ببینید.`
        ),
      ],
    },
    {
      id: 'mahur-and-rast-panjgah',
      unit: 'persian',
      minutes: 3,
      title: { en: `Mahur and Rast-Panjgah`, fa: `ماهور و راست‌پنجگاه` },
      summary: { en: `Two dastgahs that sound like a major scale.`, fa: `دو دستگاه که شبیه گام ماژور شنیده می‌شوند.` },
      blocks: [
        p(
          `Mahur has no quarter tone. Its notes are the same as a major scale, so on the piano it is the easiest dastgah to hear. In this course Mahur is on {C} and Rast-Panjgah on {F}.`,
          `ماهور ربع‌پرده ندارد. نت‌هایش همان گام ماژور است، پس روی پیانو ساده‌ترین دستگاه برای شنیدن است. در این درس ماهور روی {C} و راست‌پنجگاه روی {F} است.`
        ),
        staff(
          { clef: 'treble', notes: 'C4q D4q E4q F4q | G4q A4q B4q C5q', fifths: 0, beats: 4 },
          `Mahur on {C}.`,
          `ماهور روی {C}.`,
          { names: true, listen: true }
        ),
        p(
          `Even when the notes match a major scale, the music does not behave like Western major: the melodies move around different notes and end in different places. Listen to a recording and notice where the music rests.`,
          `حتی وقتی نت‌ها با گام ماژور برابرند، موسیقی مثل ماژور غربی رفتار نمی‌کند: نغمه‌ها دور نت‌های دیگری می‌گردند و جاهای دیگری پایان می‌گیرند. به یک ضبط گوش بدهید و ببینید موسیقی کجا می‌ایستد.`
        ),
      ],
    },
    {
      id: 'dastgah-homayun',
      unit: 'persian',
      minutes: 3,
      title: { en: `Dastgah Homayun`, fa: `دستگاه همایون` },
      summary: { en: `A koron and a raised third.`, fa: `یک کرن و یک نت سوم بالاتر.` },
      blocks: [
        p(
          `Homayun looks like Shur with a raised third. It has a koron on the second note and a major third, which gives it a very different colour. Its avaz is Bayat-e Esfahan.`,
          `همایون شبیه شور است با نت سوم بالاتر. روی نت دوم کرن دارد و نت سومش بزرگ است و همین رنگ بسیار متفاوتی به آن می‌دهد. آوازش بیات اصفهان است.`
        ),
        staff(
          { clef: 'treble', notes: 'D4q Ek4q F#4q G4q | A4q Bb4q C5q D5q', fifths: 0, beats: 4 },
          `Homayun on {D}: the third is {F} sharp.`,
          `همایون روی {D}: نت سوم {F} دیز است.`,
          { names: true, listen: true }
        ),
        tip(
          `Between {E} koron and {F} sharp there is a step of three quarters of a tone, bigger than a whole tone. In the dictionary this step is wider on the stairs.`,
          `میان {E} کرن و {F} دیز گامی به اندازه‌ی سه‌ربع پرده هست که از یک پرده بزرگ‌تر است. در فرهنگ‌نامه این گام روی پله‌ها پهن‌تر دیده می‌شود.`
        ),
      ],
    },
    {
      id: 'segah-and-chahargah',
      unit: 'persian',
      minutes: 4,
      title: { en: `Segah and Chahargah`, fa: `سه‌گاه و چهارگاه` },
      summary: { en: `Dastgahs with many quarter tones.`, fa: `دستگاه‌هایی با ربع‌پرده‌ی فراوان.` },
      blocks: [
        p(
          `Segah has the most quarter tones of the seven. In this course it starts on {E} koron: it is the only dastgah that begins on a quarter tone. Chahargah has two, and a large step of three quarters of a tone near its middle.`,
          `سه‌گاه از میان هفت دستگاه بیشترین ربع‌پرده را دارد. در این درس از {E} کرن شروع می‌شود و تنها دستگاهی است که با ربع‌پرده آغاز می‌شود. چهارگاه دو ربع‌پرده دارد و نزدیک میانه‌اش گامی به اندازه‌ی سه‌ربع پرده.`
        ),
        staff(
          { clef: 'treble', notes: 'Ek4q F4q G4q Ak4q | Bb4q C5q D5q Ek5q', fifths: 0, beats: 4 },
          `Segah on {E} koron.`,
          `سه‌گاه روی {E} کرن.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C4q Dk4q E4q F4q | G4q Ak4q B4q C5q', fifths: 0, beats: 4 },
          `Chahargah on {C}.`,
          `چهارگاه روی {C}.`,
          { names: true, listen: true }
        ),
        p(
          `Chords are made only of the notes of the piano, so a quarter-tone note is never the root of a chord in the dictionary. The notes in between are for melody.`,
          `آکوردها فقط از نت‌های پیانو ساخته می‌شوند، پس نت ربع‌پرده‌ای در فرهنگ‌نامه هرگز ریشه‌ی آکورد نیست. نت‌های میانی برای نغمه‌اند.`
        ),
      ],
    },
    {
      id: 'dastgah-nava',
      unit: 'persian',
      minutes: 3,
      title: { en: `Dastgah Nava`, fa: `دستگاه نوا` },
      summary: { en: `A minor colour with a koron near the top.`, fa: `رنگ مینور با یک کرن نزدیک بالا.` },
      blocks: [
        p(
          `Nava sounds like a minor scale, but its sixth note is a koron. It starts on {G} in this course.`,
          `نوا شبیه گام مینور شنیده می‌شود، اما نت ششمش کرن است. در این درس از {G} شروع می‌شود.`
        ),
        staff(
          { clef: 'treble', notes: 'G4q A4q Bb4q C5q | D5q Ek5q F5q G5q', fifths: 0, beats: 4 },
          `Nava on {G}: the sixth note is {E} koron.`,
          `نوا روی {G}: نت ششم {E} کرن است.`,
          { names: true, listen: true }
        ),
        p(
          `Compare it with natural minor on {G}, which has {E} flat. The koron is half way between {E} flat and {E}, and it is this difference that makes the sound Persian.`,
          `آن را با مینور طبیعی روی {G} مقایسه کنید که {E} بمل دارد. کرن میان {E} بمل و {E} است و همین تفاوت صدا را ایرانی می‌کند.`
        ),
      ],
    },
    {
      id: 'the-five-avazes',
      unit: 'persian',
      minutes: 4,
      title: { en: `The five avazes`, fa: `پنج آواز` },
      summary: { en: `Abu'ata, Bayat-e Tork, Afshari, Dashti, Bayat-e Esfahan.`, fa: `ابوعطا، بیات ترک، افشاری، دشتی، بیات اصفهان.` },
      blocks: [
        p(
          `An avaz belongs to a dastgah. Four of the avazes belong to Shur and one to Homayun. In the model of the dictionary they are shown as scales of their own, so that you can hear how each differs from its parent.`,
          `هر آواز به یک دستگاه وابسته است. چهار آواز به شور و یکی به همایون وابسته‌اند. در الگوی فرهنگ‌نامه هر کدام گامی جداگانه است تا ببینید با دستگاه مادرش چه فرقی دارد.`
        ),
        list(
          [`Abu'ata, of Shur: from {D}, with {E} flat and a koron on the fifth note.`, `ابوعطا، از شور: از {D}، با {E} بمل و یک کرن روی نت پنجم.`],
          [`Bayat-e Tork, of Shur: from {F}, with a koron on the seventh note.`, `بیات ترک، از شور: از {F}، با یک کرن روی نت هفتم.`],
          [`Afshari, of Shur: from {C}, with a koron on the sixth note.`, `افشاری، از شور: از {C}، با یک کرن روی نت ششم.`],
          [`Dashti, of Shur: from {D}, a natural minor scale without a quarter tone.`, `دشتی، از شور: از {D}، یک گام مینور طبیعی بدون ربع‌پرده.`],
          [`Bayat-e Esfahan, of Homayun: from {G}, with a koron on the sixth note.`, `بیات اصفهان، از همایون: از {G}، با یک کرن روی نت ششم.`]
        ),
        tip(
          `The sources do not all agree on the exact pitches of the avazes. The dictionary says so and marks them as a draft. Treat them as a first map.`,
          `منبع‌ها روی بلندی دقیق آوازها هم‌نظر نیستند. فرهنگ‌نامه این را می‌گوید و آن‌ها را پیش‌نویس می‌شمارد. آن‌ها را نقشه‌ی اول بدانید.`
        ),
      ],
    },
    {
      id: 'shahed-ist-moteghayyer',
      unit: 'persian',
      minutes: 3,
      title: { en: `Shahed, ist and moteghayyer`, fa: `شاهد، ایست و متغیر` },
      summary: { en: `The notes that give a mode its character.`, fa: `نت‌هایی که به هر گام شخصیت می‌دهند.` },
      blocks: [
        p(
          `Three words describe how a mode uses its notes. The shahed is the note the melody keeps coming back to, like a witness. The ist is the note where a phrase stops and rests. The moteghayyer is a note that changes when the music moves into another gusheh.`,
          `سه واژه می‌گویند هر گام از نت‌هایش چگونه استفاده می‌کند. شاهد نتی است که نغمه بارها به آن بازمی‌گردد، مثل یک گواه. ایست نتی است که جمله روی آن می‌ایستد و آرام می‌گیرد. متغیر نتی است که وقتی موسیقی به گوشه‌ای دیگر می‌رود عوض می‌شود.`
        ),
        h(`How to listen`, `چگونه گوش بدهیم`),
        list(
          [`Find the note the melody returns to most: that is the shahed.`, `نتی را پیدا کنید که نغمه بیشتر از همه به آن برمی‌گردد: شاهد است.`],
          [`Notice where each phrase comes to rest: that is the ist.`, `ببینید هر جمله کجا آرام می‌گیرد: ایست است.`],
          [`Notice when a note of the scale shifts by a quarter tone: that note is a moteghayyer.`, `ببینید کجا یکی از نت‌های گام به اندازه‌ی یک ربع‌پرده جابه‌جا می‌شود: آن نت متغیر است.`]
        ),
        p(
          `These ideas are learned best by ear, from a teacher and from recordings. This course only gives you the words and the first notes.`,
          `این مفهوم‌ها را بهتر از همه با گوش و از استاد و ضبط‌ها می‌آموزند. این درس فقط واژه‌ها و نخستین نت‌ها را به شما می‌دهد.`
        ),
      ],
    },
    {
      id: 'practise-persian-music',
      unit: 'persian',
      minutes: 3,
      title: { en: `Practise what you heard`, fa: `آنچه شنیدید را تمرین کنید` },
      summary: { en: `A small plan for the week.`, fa: `برنامه‌ای کوچک برای یک هفته.` },
      blocks: [
        p(
          `Learning Persian modes takes mostly listening. Here is a small plan that uses the parts of this app.`,
          `آموختن گام‌های ایرانی بیشتر گوش دادن است. این برنامه‌ی کوچک از بخش‌های همین برنامه کمک می‌گیرد.`
        ),
        list(
          [`Open the scale dictionary, choose a dastgah and press Hear it. Do this for one dastgah a day.`, `فرهنگ‌نامه‌ی گام را باز کنید، یک دستگاه انتخاب کنید و «بشنوید» را بزنید. هر روز یک دستگاه.`],
          [`Play along with it. The next key to press is marked on the keyboard.`, `همراه آن بنوازید. کلیدِ بعدی روی صفحه‌کلید علامت دارد.`],
          [`Try the quarter-tone ear training: first which of two notes is lower, then whether it is a koron or a flat.`, `تمرین گوشِ ربع‌پرده را امتحان کنید: اول اینکه کدام نت پایین‌تر است، بعد اینکه کرن است یا بمل.`],
          [`Listen to a real recording of each dastgah, and notice the shahed and the ist.`, `به یک ضبط واقعی از هر دستگاه گوش بدهید و شاهد و ایست را پیدا کنید.`]
        ),
        tip(
          `Short and often works better than long and rare: ten minutes of listening each day is better than an hour once a week.`,
          `کم و پیوسته از زیاد و کم‌پیش بهتر است: ده دقیقه گوش دادن در روز از یک ساعت در هفته بهتر است.`
        ),
      ],
    },
  ],
};
