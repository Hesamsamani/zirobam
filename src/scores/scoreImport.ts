import JSZip from 'jszip';
import { isMidiFile, parseMidi, parseMusicXML, type ParsedMusicXML } from '../upload';
import type { ScoreKind, StoredScore } from './scoreStore';

/** The least a File offers; tests pass a small stand-in. */
export interface ScoreFile {
  name: string;
  size?: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ReadScore {
  /** `xml` for MusicXML and MXL (the XML is kept), `midi` for MIDI. */
  kind: Exclude<ScoreKind, 'maker'>;
  data: string | ArrayBuffer;
  parsed: ParsedMusicXML;
  title: string;
}

/** Scores bigger than this are not music files a student would practise from. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** "Let_It-Be.mxl" becomes "Let It Be". */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[A-Za-z0-9]{1,8}$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * The MusicXML inside an MXL file (a ZIP). The container file names the main score;
 * without one, the first .xml outside META-INF is used.
 */
export async function extractMxlContent(zipData: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(zipData);
  const container = zip.file('META-INF/container.xml');
  if (container) {
    const doc = new DOMParser().parseFromString(await container.async('string'), 'text/xml');
    const fullPath = doc.querySelector('rootfile')?.getAttribute('full-path');
    const main = fullPath ? zip.file(fullPath) : null;
    if (main) return main.async('string');
  }
  for (const [path, entry] of Object.entries(zip.files)) {
    if (path.endsWith('.xml') && !path.startsWith('META-INF/') && !entry.dir) return entry.async('string');
  }
  throw new Error('No MusicXML content found in MXL file');
}

function checkMeasures(parsed: ParsedMusicXML): void {
  if (parsed.measures.length === 0) throw new Error('The file has no measures');
}

/** Reads a MusicXML, MXL or MIDI file into a score the practice mode can use. Throws a plain Error when it cannot. */
export async function readScoreFile(file: ScoreFile): Promise<ReadScore> {
  if ((file.size ?? 0) > MAX_FILE_BYTES) throw new Error('The file is too big to be a score');
  const lower = file.name.toLowerCase();
  const fallbackTitle = titleFromFileName(file.name);

  if (isMidiFile(file.name)) {
    const data = await file.arrayBuffer();
    const parsed = parseMidi(data);
    checkMeasures(parsed);
    return { kind: 'midi', data, parsed, title: parsed.title || fallbackTitle };
  }

  const xml = lower.endsWith('.mxl') ? await extractMxlContent(await file.arrayBuffer()) : await file.text();
  const parsed = parseMusicXML(xml);
  checkMeasures(parsed);
  return { kind: 'xml', data: xml, parsed, title: parsed.title || fallbackTitle };
}

/** Reads a score that was stored earlier. */
export function parseStoredScore(score: StoredScore): ParsedMusicXML {
  const parsed = score.kind === 'midi' ? parseMidi(score.data as ArrayBuffer) : parseMusicXML(score.data as string);
  checkMeasures(parsed);
  return parsed;
}

/** An id for a file that has no row in the library: the same file always gets the same id. */
export function scoreIdForData(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let hash = 0x811c9dc5; // FNV-1a
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `file-${hash.toString(16).padStart(8, '0')}`;
}
