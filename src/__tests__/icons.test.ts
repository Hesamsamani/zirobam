import { describe, expect, it } from 'vitest';
import { ICON_PATHS, makeIcon, type IconId } from '../ui/icons';
import { MENU_TILES } from '../menu/mainMenu';

describe('icons', () => {
  it('draws every icon as a 24 by 24 line icon in the colour of the text, hidden from screen readers', () => {
    for (const id of Object.keys(ICON_PATHS) as IconId[]) {
      const svg = makeIcon(id);
      expect(svg.getAttribute('viewBox'), id).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke'), id).toBe('currentColor');
      expect(svg.getAttribute('fill'), id).toBe('none');
      expect(svg.getAttribute('aria-hidden'), id).toBe('true');
      const paths = svg.querySelectorAll('path');
      expect(paths, id).toHaveLength(1);
      expect(paths[0].getAttribute('d')!.length, id).toBeGreaterThan(5);
    }
  });

  it('has an icon for every tile of the home screen, and the ones the side rail adds', () => {
    for (const tile of MENU_TILES) expect(ICON_PATHS[tile.id as IconId], tile.id).toBeTruthy();
    for (const id of ['home', 'today', 'sun', 'moon', 'language', 'menu', 'chevron', 'close'] as IconId[]) expect(ICON_PATHS[id], id).toBeTruthy();
  });

  it('makes a new element each time, so one icon can be in two places', () => {
    expect(makeIcon('home')).not.toBe(makeIcon('home'));
  });
});
