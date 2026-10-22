import type { View } from '../app/router';
import type { MessageKey } from '../i18n';
import { MENU_TILES, type TileId } from '../menu/mainMenu';
import type { IconId } from '../ui/icons';

/** The places in the side rail, in four groups separated by hairlines. */
export type NavGroup = 'start' | 'learn' | 'play' | 'tools';
export type NavId = 'home' | 'today' | Exclude<TileId, 'settings'>;

export interface NavItem {
  id: NavId;
  group: NavGroup;
  label: MessageKey;
  icon: IconId;
  /** A screen to open, or an action that opens a window instead (the metronome). */
  target: { view: View } | { action: 'metronome' };
}

export const NAV_GROUPS: readonly NavGroup[] = ['start', 'learn', 'play', 'tools'];

/** The rail is shown where the screen is wide and tall enough for it; otherwise it is a drawer that opens from the edge. */
export const RAIL_QUERY = '(min-width: 768px) and (min-height: 560px)';

const ORDER: Readonly<Record<NavGroup, readonly NavId[]>> = {
  start: ['home', 'today', 'progress'],
  learn: ['lessons', 'learn', 'ear', 'scales', 'chords', 'rhythm', 'persian'],
  play: ['levels', 'songs', 'catalog', 'xylophone'],
  tools: ['generator', 'tuner', 'metronome'],
};

function item(id: NavId, group: NavGroup): NavItem {
  if (id === 'home') return { id, group, label: 'nav.homeLabel', icon: 'home', target: { view: 'home' } };
  if (id === 'today') return { id, group, label: 'today.title', icon: 'today', target: { view: 'today' } };
  const tile = MENU_TILES.find((t) => t.id === id);
  if (!tile) throw new Error(`no tile for ${id}`);
  return { id, group, label: tile.title, icon: tile.id, target: tile.target as NavItem['target'] };
}

/** Home, Today and every tile of the home screen except Settings, which has its own button at the foot of the rail. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => ORDER[group].map((id) => item(id, group)));

/** The item that stands for a screen. A song being practised and the song maker belong to Songs. */
export function navIdForView(view: View): NavId | null {
  if (view === 'practice' || view === 'maker') return 'songs';
  return NAV_ITEMS.some((i) => i.id === view) ? (view as NavId) : null;
}
