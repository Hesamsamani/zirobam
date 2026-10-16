import { h, list, p, staff, terms, tip } from './build';
import type { Unit } from './types';

/** Unit 2: time. Every example fills its measures exactly (the builder checks that). */
export const RHYTHM_UNIT: Unit = {
  id: 'rhythm',
  title: { en: `Reading rhythm`, fa: `خواندن ریتم` },
  summary: {
    en: `The beat, note lengths, rests, time signatures and counting: everything you need to play in time.`,
    fa: `ضرب، طول نت‌ها، سکوت‌ها، کسر میزان و شمردن: هر آنچه برای درست نواختن لازم دارید.`,
  },
  lessons: [
    {
      id: 'beat',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `The beat and the tempo`, fa: `ضرب و سرعت` },
      summary: { en: `The steady pulse under all music, and how fast it goes.`, fa: `نبض یکنواختی که زیر همه‌ی موسیقی‌هاست و سرعت آن.` },
      blocks: [
        p(
          `Music has a steady pulse, like a heartbeat or footsteps. Each pulse is a beat. You can tap your foot to it without thinking about the notes.`,
          `موسیقی نبض یکنواختی دارد، مثل ضربان قلب یا صدای قدم‌ها. هر ضربه‌ی این نبض یک ضرب است. می‌توانید بی‌آن‌که به نت‌ها فکر کنید با پایتان آن را بزنید.`
        ),
        staff(
          { clef: 'treble', notes: 'C5q C5q C5q C5q | C5q C5q C5q C5q' },
          `Eight beats in a row. Press Play and tap along.`,
          `هشت ضرب پشت سر هم. دکمه‌ی پخش را بزنید و همراه آن ضرب بگیرید.`,
          { listen: true }
        ),
        p(
          `Tempo is how fast the beat is. It is measured in beats per minute (BPM). At 60 BPM there is one beat every second. Beginners usually practise between 50 and 80.`,
          `تمپو سرعت ضرب است و با تعداد ضرب در دقیقه (BPM) اندازه گرفته می‌شود. در ۶۰ BPM هر ثانیه یک ضرب داریم. مبتدی‌ها معمولاً بین ۵۰ تا ۸۰ تمرین می‌کنند.`
        ),
        terms(
          [`Largo`, `very slow (about 40 to 60 BPM)`, `خیلی آهسته (حدود ۴۰ تا ۶۰ ضرب در دقیقه)`],
          [`Andante`, `walking pace (about 76 to 108 BPM)`, `با سرعت قدم زدن (حدود ۷۶ تا ۱۰۸)`],
          [`Allegro`, `fast and lively (about 120 to 156 BPM)`, `تند و سرزنده (حدود ۱۲۰ تا ۱۵۶)`]
        ),
        tip(
          `A metronome clicks the beat for you. Open the floating metronome, set 60 BPM and tap your foot with it for a minute.`,
          `مترونوم ضرب را برایتان می‌زند. مترونوم شناور را باز کنید، روی ۶۰ بگذارید و یک دقیقه با آن پا بزنید.`
        ),
      ],
      actions: ['metronome'],
    },
    {
      id: 'note-values',
      unit: 'rhythm',
      minutes: 4,
      title: { en: `How long is a note?`, fa: `طول نت‌ها` },
      summary: { en: `Whole, half, quarter, eighth and sixteenth notes.`, fa: `نت گرد، سفید، سیاه، چنگ و دولا چنگ.` },
      blocks: [
        p(
          `The shape of a note tells you how many beats it lasts. A hollow note with no stem is the longest. Each shorter note lasts half as long as the one before.`,
          `شکل نت نشان می‌دهد چند ضرب طول می‌کشد. نتی که توخالی است و ساقه ندارد طولانی‌ترین است. هر نت کوتاه‌تر نصف نت قبلی طول دارد.`
        ),
        staff(
          { clef: 'treble', notes: 'C5w', free: true },
          `Whole note (gird): 4 beats.`,
          `نت گرد: ۴ ضرب.`
        ),
        staff(
          { clef: 'treble', notes: 'C5h C5h', free: true },
          `Half notes (sefid): 2 beats each, so two fit in a measure of four.`,
          `نت سفید: هر کدام ۲ ضرب، پس دو تا در یک میزان چهار ضربی جا می‌گیرد.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5q C5q C5q C5q', free: true },
          `Quarter notes (siyah): 1 beat each. Four fit in the measure.`,
          `نت سیاه: هر کدام ۱ ضرب. چهار تا در میزان جا می‌گیرد.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5e C5e C5e C5e C5e C5e C5e C5e', free: true },
          `Eighth notes (chang): half a beat each. They are joined by a beam, eight in the measure.`,
          `نت چنگ: هر کدام نصف ضرب. با یک تیر به هم وصل می‌شوند، هشت تا در میزان.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s C5s', free: true },
          `Sixteenth notes (dolā chang): a quarter of a beat each, with two beams. Sixteen fit in the measure.`,
          `نت دولا چنگ: هر کدام یک‌چهارم ضرب، با دو تیر. شانزده تا در میزان جا می‌گیرد.`,
          { listen: true }
        ),
        tip(
          `Think of cutting a pizza. A whole is the entire pizza, a half is two slices, a quarter is four slices. Each cut halves what you had.`,
          `به بریدن یک پیتزا فکر کنید. نت گرد کل پیتزاست، سفید نیمی از آن و سیاه یک‌چهارم. هر برش اندازه‌ی قبلی را نصف می‌کند.`
        ),
      ],
      actions: ['levels', 'metronome'],
    },
    {
      id: 'rests',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `Rests`, fa: `سکوت‌ها` },
      summary: { en: `Silence is written down too, and it counts.`, fa: `سکوت هم نوشته می‌شود و شمرده می‌شود.` },
      blocks: [
        p(
          `A rest is a pause. Every note length has a rest of the same length, and you keep counting through it. Silence is part of the rhythm.`,
          `سکوت یعنی مکث. برای هر طول نت یک سکوت هم‌طول وجود دارد و در طول آن همچنان می‌شمارید. سکوت بخشی از ریتم است.`
        ),
        staff(
          { clef: 'treble', notes: 'C5q rq C5q rq', free: true },
          `Quarter note, quarter rest, quarter note, quarter rest: play one, rest one.`,
          `نت سیاه، سکوت سیاه، نت سیاه، سکوت سیاه: یکی بنوازید، یکی صبر کنید.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5h rh | C5q rq rh', free: true },
          `Half rest sits on top of the middle line. A quarter rest looks like a squiggle.`,
          `سکوت سفید روی خط وسط می‌نشیند. سکوت سیاه شبیه یک خط شکسته است.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 're C5e re C5e re C5e re C5e', free: true },
          `Eighth rests: each one fills half a beat, so the music is the off-beats.`,
          `سکوت چنگ: هر کدام نصف ضرب را پر می‌کند، پس نت‌ها روی نیمه‌ی ضرب‌ها می‌افتند.`,
          { listen: true }
        ),
        list(
          [`A whole rest hangs below the fourth line and lasts a full measure, whatever the time signature.`, `سکوت گرد زیر خط چهارم آویزان است و یک میزان کامل طول می‌کشد، در هر کسر میزانی.`],
          [`A half rest sits on top of the middle line and lasts 2 beats.`, `سکوت سفید روی خط وسط می‌نشیند و ۲ ضرب طول دارد.`]
        ),
        tip(
          `When you read a rest, do not stop counting. Say the beat number out loud for each rest and keep the pulse alive.`,
          `وقتی به سکوت می‌رسید شمردن را رها نکنید. شماره‌ی ضرب را برای هر سکوت بلند بگویید و نبض را زنده نگه دارید.`
        ),
      ],
      actions: ['levels', 'metronome'],
    },
    {
      id: 'time-signature',
      unit: 'rhythm',
      minutes: 4,
      title: { en: `Measures and time signatures`, fa: `میزان و کسر میزان` },
      summary: { en: `How beats are grouped, and what the two numbers mean.`, fa: `ضرب‌ها چطور دسته‌بندی می‌شوند و دو عدد چه معنایی دارند.` },
      blocks: [
        p(
          `Beats are grouped into measures (bars), separated by vertical lines called barlines. The time signature at the start says how many beats are in each measure.`,
          `ضرب‌ها در میزان‌ها دسته‌بندی می‌شوند و میان آن‌ها خط‌های عمودی به نام خط میزان قرار دارد. کسر میزان در ابتدای قطعه می‌گوید هر میزان چند ضرب دارد.`
        ),
        staff(
          { clef: 'treble', beats: 4, showTime: true, notes: 'C5q D5q E5q F5q | G5h G5h' },
          `4/4: four beats in each measure, and the quarter note gets one beat. It is the most common time signature.`,
          `۴/۴: چهار ضرب در هر میزان و نت سیاه یک ضرب است. این رایج‌ترین کسر میزان است.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', beats: 3, showTime: true, notes: 'C5q D5q E5q | G5h. | G5q F5q E5q' },
          `3/4: three beats in each measure, the feel of a waltz.`,
          `۳/۴: سه ضرب در هر میزان، حال‌وهوای والس.`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', beats: 2, showTime: true, notes: 'C5q D5q | E5h | D5q C5q' },
          `2/4: two beats in each measure, like a march.`,
          `۲/۴: دو ضرب در هر میزان، مثل مارش.`,
          { listen: true }
        ),
        p(
          `The top number is how many beats are in a measure. The bottom number says which note counts as one beat: 4 means a quarter note. Time signatures with an 8 at the bottom, like 6/8, count in eighth notes; you will meet them later.`,
          `عدد بالا می‌گوید در هر میزان چند ضرب هست. عدد پایین می‌گوید کدام نت یک ضرب حساب می‌شود: ۴ یعنی نت سیاه. کسر میزان‌هایی که ۸ در پایین دارند، مثل ۶/۸، با نت چنگ شمرده می‌شوند؛ بعداً با آن‌ها آشنا می‌شوید.`
        ),
        tip(
          `If you are unsure how a measure adds up, add the note lengths: they must equal the top number in quarter-note beats.`,
          `اگر مطمئن نیستید یک میزان چطور جمع می‌شود، طول نت‌ها را جمع بزنید؛ مجموع باید با عدد بالا (بر حسب ضرب سیاه) برابر باشد.`
        ),
      ],
      actions: ['levels', 'songs'],
    },
    {
      id: 'counting',
      unit: 'rhythm',
      minutes: 4,
      title: { en: `Counting aloud`, fa: `بلند شمردن` },
      summary: { en: `Say the beats out loud: it is the surest way to get rhythm right.`, fa: `ضرب‌ها را بلند بگویید؛ مطمئن‌ترین راه درست‌خواندن ریتم.` },
      blocks: [
        p(
          `Count the beats out loud while you play. In 4/4 you say "1 2 3 4". A note that starts on a number is played when you say that number.`,
          `هنگام نواختن، ضرب‌ها را بلند بشمارید. در ۴/۴ می‌گویید «۱ ۲ ۳ ۴». نتی که روی یک عدد شروع می‌شود، هم‌زمان با گفتن همان عدد نواخته می‌شود.`
        ),
        staff(
          { clef: 'treble', notes: 'C5q C5q C5h | C5h C5q C5q' },
          `Count "1 2 3 4": the half note on beat 3 is held through beat 4.`,
          `بشمارید «۱ ۲ ۳ ۴»؛ نت سفید روی ضرب سوم تا ضرب چهارم کشیده می‌شود.`,
          { listen: true }
        ),
        h(`Counting eighth notes`, `شمردن نت‌های چنگ`),
        p(
          `Two eighth notes fit in one beat. Say "and" for the second one: "1 and 2 and 3 and 4 and". The numbers fall on the beat, the "ands" fall between.`,
          `دو نت چنگ در یک ضرب جا می‌گیرند. برای دومی «و» بگویید: «۱ و ۲ و ۳ و ۴ و». عددها روی ضرب‌اند و «و»ها میان ضرب‌ها.`
        ),
        staff(
          { clef: 'treble', notes: 'C5q C5q C5e C5e C5q | C5e C5e C5e C5e C5h' },
          `"1  2  3 and 4 | 1 and 2 and 3  -". Say the numbers and "ands" as you play.`,
          `«۱ ۲ ۳ و ۴ | ۱ و ۲ و ۳ -». عددها و «و»ها را هنگام نواختن بگویید.`,
          { listen: true }
        ),
        h(`Counting sixteenth notes`, `شمردن نت‌های دولا چنگ`),
        p(
          `Four sixteenth notes fit in one beat: "1 e and a". The word counts the quarter of the beat that each sixteenth lands on.`,
          `چهار نت دولا چنگ در یک ضرب جا می‌گیرند: «۱ ای و آ». هر کلمه یک‌چهارم ضرب را مشخص می‌کند که نت روی آن می‌افتد.`
        ),
        staff(
          { clef: 'treble', notes: 'C5s D5s E5s F5s G5q G5h' },
          `"1 e and a  2  3  4". The four fast notes take the time of one beat.`,
          `«۱ ای و آ ۲ ۳ ۴». چهار نت تند، زمان یک ضرب را می‌گیرند.`,
          { listen: true }
        ),
        tip(
          `Say the counting out loud before you play a new rhythm. Then play while you keep saying it, and finally say it in your head.`,
          `پیش از نواختن هر ریتم تازه، شمارش را بلند بگویید. بعد هنگام نواختن هم به گفتن ادامه دهید و آخر در ذهن بشمارید.`
        ),
      ],
      actions: ['levels', 'metronome'],
    },
    {
      id: 'dotted-notes',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `Dotted notes`, fa: `نت‌های نقطه‌دار` },
      summary: { en: `A dot makes a note half as long again.`, fa: `نقطه، طول نت را یک‌ونیم برابر می‌کند.` },
      blocks: [
        p(
          `A dot after a note adds half of the note's own length. A dotted half note lasts 2 + 1 = 3 beats. A dotted quarter note lasts 1 + ½ = 1½ beats.`,
          `نقطه‌ی کنار نت، نصفِ طول خود نت را به آن اضافه می‌کند. نت سفید نقطه‌دار ۲ + ۱ = ۳ ضرب طول دارد. نت سیاه نقطه‌دار ۱ + ½ = ۱½ ضرب.`
        ),
        staff(
          { clef: 'treble', notes: 'C5h. C5q | C5q. C5e C5h' },
          `First measure: dotted half (3 beats) and a quarter. Second: dotted quarter (1½), eighth (½) and a half note (2).`,
          `میزان اول: سفید نقطه‌دار (۳ ضرب) و یک سیاه. میزان دوم: سیاه نقطه‌دار (۱½)، چنگ (½) و یک سفید (۲).`,
          { listen: true }
        ),
        terms(
          [`3`, `Dotted half note: 3 beats`, `نت سفید نقطه‌دار: ۳ ضرب`],
          [`1½`, `Dotted quarter note: 1½ beats`, `نت سیاه نقطه‌دار: ۱½ ضرب`],
          [`¾`, `Dotted eighth note: ¾ beat`, `نت چنگ نقطه‌دار: ¾ ضرب`]
        ),
        p(
          `The dotted quarter followed by an eighth is a very common pair. Count it "1 (and) 2": the eighth falls just before the next beat and gives the music a bouncing feel.`,
          `زوج «سیاه نقطه‌دار و چنگ» بسیار رایج است. آن را «۱ (و) ۲» بشمارید؛ نت چنگ درست قبل از ضرب بعدی می‌افتد و به موسیقی حالت جهنده می‌دهد.`
        ),
        tip(
          `The dot always belongs to the note before it. When the sum is not right, check for a missing dot.`,
          `نقطه همیشه مال نت قبل از خودش است. اگر جمع میزان درنمی‌آید، دنبال نقطه‌ی جاافتاده بگردید.`
        ),
      ],
      actions: ['levels'],
    },
    {
      id: 'ties-slurs',
      unit: 'rhythm',
      minutes: 4,
      title: { en: `Ties and slurs`, fa: `لیگاتور و لگاتو` },
      summary: { en: `Two curved lines that look alike but mean different things.`, fa: `دو خط خمیده که شبیه هم‌اند ولی دو معنی متفاوت دارند.` },
      blocks: [
        p(
          `A tie joins two notes of the same pitch into one longer sound. You play the first note and hold it for the length of both. You do not play the second note again.`,
          `لیگاتور دو نت هم‌ارتفاع را به یک صدای بلندتر تبدیل می‌کند. نت اول را می‌نوازید و به اندازه‌ی مجموع طول هر دو نگه می‌دارید. نت دوم را دوباره نمی‌نوازید.`
        ),
        staff(
          { clef: 'treble', notes: 'C5h~ C5q C5q | C5q C5q C5q C5q~ | C5h D5h' },
          `Measure 1: 2 + 1 beats tied makes a sound of 3 beats. Measure 2 ends tied across the barline into measure 3.`,
          `میزان اول: لیگاتور ۲ + ۱ یک صدای ۳ ضربی می‌سازد. میزان دوم با لیگاتور از خط میزان رد می‌شود و به میزان سوم می‌رسد.`,
          { listen: true }
        ),
        p(
          `A slur is a curve over notes of different pitches. It means play them smoothly, with no gap between them. This is called legato. Unlike a tie, you play every note under a slur.`,
          `لگاتو خمی است بالای نت‌هایی با ارتفاع‌های متفاوت. یعنی آن‌ها را روان و بدون فاصله بنوازید. در برابر لیگاتور، همه‌ی نت‌های زیر لگاتو نواخته می‌شوند.`
        ),
        terms(
          [`tie`, `Same pitch: play once, hold for the combined length.`, `لیگاتور: هم‌ارتفاع؛ یک بار بنواز و به اندازه‌ی مجموع نگه دار.`],
          [`slur`, `Different pitches: play each note, connected smoothly.`, `لگاتو: ارتفاع‌های متفاوت؛ هر نت را بنواز و پیوسته اجرا کن.`]
        ),
        tip(
          `If the two notes under a curve have the same pitch, it is a tie. If not, it is a slur.`,
          `اگر دو نتِ زیر خم هم‌ارتفاع باشند، لیگاتور است. اگر نه، لگاتو.`
        ),
      ],
      actions: ['levels', 'songs'],
    },
    {
      id: 'eighth-sixteenth',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `Beams and fast notes`, fa: `تیر و نت‌های تند` },
      summary: { en: `How eighth and sixteenth notes are grouped so you can read them.`, fa: `نت‌های چنگ و دولا چنگ چطور گروه می‌شوند تا خواندنشان آسان شود.` },
      blocks: [
        p(
          `Short notes are joined by beams instead of separate flags. Beams group notes by the beat, so you can see where each beat starts.`,
          `نت‌های کوتاه به جای پرچم‌های جدا، با تیر به هم وصل می‌شوند. تیرها نت‌ها را بر اساس ضرب گروه‌بندی می‌کنند تا ببینید هر ضرب کجا شروع می‌شود.`
        ),
        staff(
          { clef: 'treble', notes: 'C5e D5e E5e F5e G5e F5e E5e D5e' },
          `Eight eighth notes in two groups of four, one group per two beats.`,
          `هشت نت چنگ در دو دسته‌ی چهارتایی، هر دسته برابر دو ضرب.`,
          { names: true, listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5s D5s E5s F5s G5e G5e A5q G5q' },
          `Four sixteenths make one beat. Then two eighths make another beat.`,
          `چهار دولا چنگ یک ضرب می‌سازند. بعد دو چنگ یک ضرب دیگر.`,
          { listen: true }
        ),
        list(
          [`Look at the beams first: each group is usually one beat or two.`, `اول تیرها را ببینید؛ هر دسته معمولاً یک یا دو ضرب است.`],
          [`Practise slowly. Speed comes from steadiness, not from rushing.`, `آهسته تمرین کنید. سرعت از یکنواختی می‌آید، نه از عجله.`]
        ),
      ],
      actions: ['levels', 'metronome'],
    },
    {
      id: 'syncopation',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `Off-beats and syncopation`, fa: `ضدضرب و سنکوپ` },
      summary: { en: `Notes that start between the beats and give music its swing.`, fa: `نت‌هایی که میان ضرب‌ها شروع می‌شوند و به موسیقی حال‌وهوا می‌دهند.` },
      blocks: [
        p(
          `Most notes start on the beat. Syncopation puts them in between, on the off-beat, so the accent is where you do not expect it. Much of pop, jazz and dance music lives on this.`,
          `بیشتر نت‌ها روی ضرب شروع می‌شوند. در سنکوپ آن‌ها را میان ضرب‌ها می‌گذاریم، یعنی روی ضدضرب، و تکیه جایی می‌افتد که انتظارش را ندارید. بخش بزرگی از موسیقی پاپ، جاز و رقص بر این ریتم‌ها بنا شده.`
        ),
        staff(
          { clef: 'treble', notes: 'C5e C5q C5q C5q C5e' },
          `The middle quarter notes begin on the off-beats ("and" of 1, 2 and 3). Count "1 and 2 and 3 and 4 and".`,
          `سیاه‌های میانی روی ضدضرب شروع می‌شوند («و» ۱، ۲ و ۳). بشمارید «۱ و ۲ و ۳ و ۴ و».`,
          { listen: true }
        ),
        staff(
          { clef: 'treble', notes: 'C5q. C5e C5q rq' },
          `A dotted quarter followed by an eighth gives another classic off-beat feel.`,
          `سیاه نقطه‌دار و بعد یک چنگ، حال‌وهوای ضدضرب کلاسیک دیگری می‌سازد.`,
          { listen: true }
        ),
        tip(
          `Keep the pulse steady underneath. Tap your foot on every beat and let the off-beat notes land between the taps.`,
          `نبض را زیر موسیقی یکنواخت نگه دارید. روی هر ضرب پا بزنید و بگذارید نت‌های ضدضرب میان زدن‌های پا بنشینند.`
        ),
      ],
      actions: ['levels', 'metronome'],
    },
    {
      id: 'feel-the-meter',
      unit: 'rhythm',
      minutes: 3,
      title: { en: `Strong and weak beats`, fa: `ضرب قوی و ضرب ضعیف` },
      summary: { en: `Every time signature has a pattern of heavier and lighter beats.`, fa: `هر کسر میزان الگویی از ضرب‌های سنگین و سبک دارد.` },
      blocks: [
        p(
          `Beats in a measure do not all feel the same. The first beat is the strongest. That is why the first beat after a barline is called the downbeat.`,
          `همه‌ی ضرب‌های یک میزان یک حس را ندارند. ضرب اول قوی‌ترین است. به همین دلیل اولین ضرب بعد از خط میزان را ضرب سنگین می‌نامند.`
        ),
        terms(
          [`2/4`, `STRONG weak`, `قوی، ضعیف`],
          [`3/4`, `STRONG weak weak`, `قوی، ضعیف، ضعیف`],
          [`4/4`, `STRONG weak medium weak`, `قوی، ضعیف، نیمه‌قوی، ضعیف`]
        ),
        staff(
          { clef: 'treble', beats: 3, showTime: true, notes: 'G4q G4q G4q | A4q A4q A4q' },
          `A waltz: ONE two three, ONE two three. Lean a little on the first beat of each measure.`,
          `والس: «یک» دو سه، «یک» دو سه. روی ضرب اول هر میزان کمی تکیه کنید.`,
          { listen: true }
        ),
        tip(
          `When the music sounds flat, add the accent: put a little more weight on beat 1 and keep the others light.`,
          `اگر موسیقی بی‌روح به نظر می‌رسد، تکیه را اضافه کنید: روی ضرب اول کمی وزن بیشتری بگذارید و بقیه را سبک بزنید.`
        ),
      ],
      actions: ['metronome', 'songs'],
    },
    {
      id: 'rhythm-practice',
      unit: 'rhythm',
      minutes: 4,
      title: { en: `Putting rhythm together`, fa: `کنار هم گذاشتن ریتم‌ها` },
      summary: { en: `A practice recipe: clap, count, play, with the metronome.`, fa: `یک دستور تمرین: دست بزنید، بشمارید، بنوازید، با مترونوم.` },
      blocks: [
        p(
          `Here is a short rhythm that mixes everything from this unit. Use this routine for any new rhythm.`,
          `این یک ریتم کوتاه است که همه‌ی آموخته‌های این بخش را ترکیب می‌کند. این روش را برای هر ریتم تازه به کار ببرید.`
        ),
        staff(
          { clef: 'treble', beats: 4, showTime: true, notes: 'C5q C5e C5e C5q rq | C5q. C5e C5h~ | C5q C5q C5e C5e C5q | C5w' },
          `Four measures: quarters, eighths, a rest, a dotted note and a tie.`,
          `چهار میزان: سیاه، چنگ، یک سکوت، یک نت نقطه‌دار و یک لیگاتور.`,
          { listen: true }
        ),
        list(
          [`Clap it without the piano, counting out loud.`, `بدون پیانو و با شمردن بلند، آن را دست بزنید.`],
          [`Clap it with the metronome at 60 BPM.`, `با مترونوم روی ۶۰ دست بزنید.`],
          [`Play it on one note, still counting.`, `روی یک نت بنوازید و همچنان بشمارید.`],
          [`Raise the tempo by 5 BPM only when it feels easy.`, `فقط وقتی راحت شد، تمپو را ۵ واحد بالا ببرید.`]
        ),
        tip(
          `Slow and steady beats fast and uneven. If you make a mistake, slow down until it is clean three times in a row.`,
          `آهسته و یکنواخت بهتر از تند و ناهموار است. اگر اشتباه کردید آن‌قدر آهسته کنید که سه بار پشت سر هم تمیز شود.`
        ),
      ],
      actions: ['metronome', 'levels', 'songs'],
    },
  ],
};
