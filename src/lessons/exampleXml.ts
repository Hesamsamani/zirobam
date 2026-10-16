import { keyAlter, parseMelody, type ParsedNote } from '../songs/songBuilder';

export interface StaffExample {
  clef: 'treble' | 'bass' | 'grand';
  /** The notes, in the notation of the songs (`E4q F4h | G4w`); the upper staff for a grand staff. */
  notes: string;
  /** For a grand staff: the notes of the lower staff, with the same measures. */
  lower?: string;
  fifths?: number;
  /** Beats per measure (default 4). */
  beats?: 2 | 3 | 4;
  showTime?: boolean;
  /** Notes that do not have to fill their measures (charts of note lengths). */
  free?: boolean;
}

/** What to draw next to a note: the sign when its pitch differs from what the key signature gives. */
function accidentalXml(note: ParsedNote, fifths: number): string {
  if (note.natural) return '<accidental>natural</accidental>';
  if (note.alter === keyAlter(note.step, fifths)) return '';
  return note.alter > 0 ? '<accidental>sharp</accidental>' : note.alter < 0 ? '<accidental>flat</accidental>' : '<accidental>natural</accidental>';
}

/** One note. `tieIn` is true when the note before it was tied to this one. */
function noteXml(note: ParsedNote, staff: number, fifths: number, tieIn: boolean): string {
  const dot = note.dotted ? '<dot/>' : '';
  if (note.rest) return `<note><rest/><duration>${note.duration}</duration><type>${note.type}</type>${dot}<staff>${staff}</staff></note>`;
  const alter = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
  const ties = (tieIn ? '<tie type="stop"/>' : '') + (note.tie ? '<tie type="start"/>' : '');
  const tied = (tieIn ? '<tied type="stop"/>' : '') + (note.tie ? '<tied type="start"/>' : '');
  const notations = tied ? `<notations>${tied}</notations>` : '';
  return `<note><pitch><step>${note.step}</step>${alter}<octave>${note.octave}</octave></pitch><duration>${note.duration}</duration>${ties}<type>${note.type}</type>${dot}${accidentalXml(note, fifths)}<staff>${staff}</staff>${notations}</note>`;
}

/** The notes of one staff as XML, tracking ties from one note (or measure) to the next. */
function staffXml(measures: ParsedNote[][], staff: number, fifths: number): string[] {
  let tieIn = false;
  return measures.map((notes) =>
    notes
      .map((note) => {
        const xml = noteXml(note, staff, fifths, tieIn && !note.rest);
        tieIn = note.tie;
        return xml;
      })
      .join('')
  );
}

function measureLength(notes: ParsedNote[]): number {
  return notes.reduce((sum, n) => sum + n.duration, 0);
}

/** MusicXML for a lesson picture: one treble staff, one bass staff, or the grand staff. */
export function buildExampleXml(spec: StaffExample): string {
  const beats = spec.beats ?? 4;
  const upper = parseMelody(spec.notes, beats, 4, !spec.free);
  const grand = spec.clef === 'grand';
  const lower = grand && spec.lower ? parseMelody(spec.lower, beats, 4, !spec.free) : null;
  if (lower && lower.length !== upper.length) throw new Error('The lower staff needs the same number of measures as the upper one');

  const timeAttr = spec.showTime ? '' : ' print-object="no"';
  const clefXml = grand
    ? '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'
    : spec.clef === 'bass'
      ? '<clef><sign>F</sign><line>4</line></clef>'
      : '<clef><sign>G</sign><line>2</line></clef>';
  const fifths = spec.fifths ?? 0;
  const upperXml = staffXml(upper, 1, fifths);
  const lowerXmlParts = lower ? staffXml(lower, 2, fifths) : null;

  const measures = upper.map((notes, index) => {
    const attributes =
      index === 0
        ? `<attributes><divisions>4</divisions><key><fifths>${spec.fifths ?? 0}</fifths></key><time${timeAttr}><beats>${beats}</beats><beat-type>4</beat-type></time>${clefXml}</attributes>`
        : '';
    let body = upperXml[index];
    if (grand) {
      const length = measureLength(notes);
      const lowerNotes = lower ? lower[index] : null;
      if (lowerNotes && measureLength(lowerNotes) !== length) {
        throw new Error(`Measure ${index + 1} of the lower staff is not as long as the upper one`);
      }
      const lowerXml = lowerXmlParts
        ? lowerXmlParts[index]
        : `<note><rest measure="yes"/><duration>${length}</duration><staff>2</staff></note>`;
      body += `<backup><duration>${length}</duration></backup>${lowerXml}`;
    }
    return `<measure number="${index + 1}">${attributes}${body}</measure>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>
  <part id="P1">${measures.join('')}</part>
</score-partwise>`;
}

/** The written pitches of an example in the order Verovio draws the notes (upper staff first), for labelling. */
export function exampleNoteNames(spec: StaffExample): string[] {
  const beats = spec.beats ?? 4;
  const names = (text: string) =>
    parseMelody(text, beats, 4, !spec.free)
      .flat()
      .filter((n) => !n.rest)
      .map((n) => n.pitch);
  return [...names(spec.notes), ...(spec.clef === 'grand' && spec.lower ? names(spec.lower) : [])];
}
