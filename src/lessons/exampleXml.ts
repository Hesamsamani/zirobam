import { measuresXml, parseMelody, type ParsedNote } from '../songs/songBuilder';

export interface StaffExample {
  clef: 'treble' | 'bass' | 'grand';
  /** The notes, in the notation of the songs (`E4q F4h | G4w`, chords `C4+E4+G4w`); the upper staff for a grand staff. */
  notes: string;
  /** For a grand staff: the notes of the lower staff, with the same measures. */
  lower?: string;
  fifths?: number;
  /** Beats per measure (default 4): quarter notes, or eighth notes with `beatType: 8` (6/8). */
  beats?: 2 | 3 | 4 | 6;
  /** What a beat is: 4 for a quarter note (default), 8 for an eighth note. */
  beatType?: 4 | 8;
  showTime?: boolean;
  /** Notes that do not have to fill their measures (charts of note lengths). */
  free?: boolean;
}

function measureLength(notes: ParsedNote[]): number {
  return notes.reduce((sum, n) => sum + n.duration, 0);
}

/** MusicXML for a lesson picture: one treble staff, one bass staff, or the grand staff. */
export function buildExampleXml(spec: StaffExample): string {
  const beats = spec.beats ?? 4;
  const beatType = spec.beatType ?? 4;
  const upper = parseMelody(spec.notes, beats, beatType, !spec.free);
  const grand = spec.clef === 'grand';
  const lower = grand && spec.lower ? parseMelody(spec.lower, beats, beatType, !spec.free) : null;
  if (lower && lower.length !== upper.length) throw new Error('The lower staff needs the same number of measures as the upper one');

  const timeAttr = spec.showTime ? '' : ' print-object="no"';
  const clefXml = grand
    ? '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>'
    : spec.clef === 'bass'
      ? '<clef><sign>F</sign><line>4</line></clef>'
      : '<clef><sign>G</sign><line>2</line></clef>';
  const fifths = spec.fifths ?? 0;
  const upperXml = measuresXml(upper, { fifths, staff: 1, kind: 'picture' });
  const lowerXmlParts = lower ? measuresXml(lower, { fifths, staff: 2, kind: 'picture' }) : null;

  const measures = upper.map((notes, index) => {
    const attributes =
      index === 0
        ? `<attributes><divisions>4</divisions><key><fifths>${spec.fifths ?? 0}</fifths></key><time${timeAttr}><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>${clefXml}</attributes>`
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
  const beatType = spec.beatType ?? 4;
  // every pitch of a chord, lowest first
  const pitches = (measure: ParsedNote[] | undefined) => (measure ?? []).filter((n) => !n.rest).flatMap((n) => [n.pitch, ...n.chord.map((c) => c.pitch)]);
  const upper = parseMelody(spec.notes, beats, beatType, !spec.free);
  const lower = spec.clef === 'grand' && spec.lower ? parseMelody(spec.lower, beats, beatType, !spec.free) : [];
  return upper.flatMap((measure, index) => [...pitches(measure), ...pitches(lower[index])]);
}
