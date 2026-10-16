import type { Clef } from './nameTheNote';

export function buildSingleNoteXml(pitch: string, clef: Clef): string {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);
  const alter = match[2] === '#' ? '<alter>1</alter>' : match[2] === 'b' ? '<alter>-1</alter>' : '';
  const clefXml = clef === 'treble' ? '<sign>G</sign><line>2</line>' : '<sign>F</sign><line>4</line>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time print-object="no"><beats>4</beats><beat-type>4</beat-type></time>
        <clef>${clefXml}</clef>
      </attributes>
      <note><pitch><step>${match[1]}</step>${alter}<octave>${match[3]}</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;
}

/** The few Verovio calls the note card needs, so it can be tested without loading the engine. */
export interface NotationToolkit {
  setOptions(options: Record<string, unknown>): void;
  loadData(data: string): unknown;
  renderToSVG(page: number): string;
}

export function createNoteCardRenderer(
  toolkit: NotationToolkit,
  options: { scale?: number; pageWidth?: number } = {}
): (pitch: string, clef: Clef, into: HTMLElement) => void {
  toolkit.setOptions({
    pageWidth: options.pageWidth ?? 420,
    pageHeight: 600,
    scale: options.scale ?? 70,
    adjustPageHeight: true,
    footer: 'none',
    header: 'none',
    breaks: 'none',
  });
  return (pitch, clef, into) => {
    toolkit.loadData(buildSingleNoteXml(pitch, clef));
    const svg = new DOMParser().parseFromString(toolkit.renderToSVG(1), 'image/svg+xml');
    into.replaceChildren(document.importNode(svg.documentElement, true));
  };
}
