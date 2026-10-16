import type { MessageKey } from '../i18n';
import { t } from '../i18n';
import type { BuiltInSong } from './index';

const TITLE_KEYS: Readonly<Record<string, MessageKey>> = {
  'mary-lamb': 'song.maryLamb',
  twinkle: 'song.twinkle',
  'ode-to-joy': 'song.odeToJoy',
  'happy-birthday': 'song.happyBirthday',
  'minuet-g': 'song.minuetG',
  'hot-cross-buns': 'song.hotCrossBuns',
  'au-clair': 'song.auClair',
  'frere-jacques': 'song.frereJacques',
  'london-bridge': 'song.londonBridge',
  'old-macdonald': 'song.oldMacdonald',
  'lightly-row': 'song.lightlyRow',
  'jingle-bells': 'song.jingleBells',
  'yankee-doodle': 'song.yankeeDoodle',
  'canon-d': 'song.canonD',
  'ex-c-scale': 'song.exCScale',
  'ex-five-notes': 'song.exFiveNotes',
  'ex-chord-notes': 'song.exChordNotes',
  'ex-one-note-rhythm': 'song.exOneNoteRhythm',
  'ex-thirds': 'song.exThirds',
  'ex-waltz': 'song.exWaltz',
  'ex-g-scale': 'song.exGScale',
  'ex-f-scale': 'song.exFScale',
  'ex-eighth-scale': 'song.exEighthScale',
  'row-row-row': 'song.rowRowRow',
  'alle-meine-entchen': 'song.alleMeineEntchen',
  'when-the-saints': 'song.whenTheSaints',
  'pop-goes-the-weasel': 'song.popGoesTheWeasel',
  'fuchs-gans': 'song.fuchsGans',
  'sur-le-pont': 'song.surLePont',
  'we-wish-you': 'song.weWishYou',
  'silent-night': 'song.silentNight',
  'amazing-grace': 'song.amazingGrace',
  'auld-lang-syne': 'song.auldLangSyne',
  'scarborough-fair': 'song.scarboroughFair',
  'o-tannenbaum': 'song.oTannenbaum',
  'away-in-a-manger': 'song.awayInAManger',
  'brahms-lullaby': 'song.brahmsLullaby',
  'o-come-all-ye-faithful': 'song.oComeAllYeFaithful',
  'skye-boat-song': 'song.skyeBoatSong',
  'it-came-upon-midnight-clear': 'song.itCameUpon',
  'joy-to-the-world': 'song.joyToTheWorld',
  greensleeves: 'song.greensleeves',
  'danny-boy': 'song.dannyBoy',
  'eine-kleine': 'song.eineKleine',
  'fur-elise': 'song.furElise',
};

/** The song's name in the current language. A song without a translation shows its own title. */
export function songTitle(song: Pick<BuiltInSong, 'id' | 'title'>): string {
  const key = TITLE_KEYS[song.id];
  return key ? t(key) : song.title;
}
