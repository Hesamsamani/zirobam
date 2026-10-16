import type { MessageKey } from '../i18n';
import { t } from '../i18n';
import type { BuiltInSong } from './index';

const TITLE_KEYS: Readonly<Record<string, MessageKey>> = {
  'mary-lamb': 'song.maryLamb',
  twinkle: 'song.twinkle',
  'ode-to-joy': 'song.odeToJoy',
  'happy-birthday': 'song.happyBirthday',
  'minuet-g': 'song.minuetG',
};

/** The song's name in the current language. A song without a translation shows its own title. */
export function songTitle(song: Pick<BuiltInSong, 'id' | 'title'>): string {
  const key = TITLE_KEYS[song.id];
  return key ? t(key) : song.title;
}
