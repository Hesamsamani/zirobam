import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SongsView } from '../menu/songsView';
import { songTitle } from '../songs/songText';
import { BUILT_IN_SONGS } from '../songs';
import { initLocale, setLocale, t } from '../i18n';

function setup() {
  const onChoose = vi.fn<(id: string) => void>();
  const onBack = vi.fn();
  const view = new SongsView({ songs: BUILT_IN_SONGS, onChoose, onBack });
  document.body.replaceChildren(view.element);
  return { view, onChoose, onBack };
}

describe('songTitle', () => {
  it('translates every built-in song', () => {
    for (const song of BUILT_IN_SONGS) {
      expect(songTitle(song), song.id).not.toBe('');
      expect(songTitle(song), song.id).not.toMatch(/^song\./);
    }
  });

  it('falls back to the song own title for an unknown id', () => {
    expect(songTitle({ ...BUILT_IN_SONGS[0], id: 'mystery', title: 'Mystery Tune' })).toBe('Mystery Tune');
  });
});

describe('SongsView', () => {
  beforeEach(() => {
    localStorage.clear();
    initLocale();
  });

  it('is the songs screen section', () => {
    const { view } = setup();
    expect(view.element.id).toBe('songsView');
    expect(view.element.dataset.views).toBe('songs');
  });

  it('lists every song as a button', () => {
    const { view } = setup();
    const buttons = view.element.querySelectorAll<HTMLButtonElement>('button.song-card');
    expect(buttons).toHaveLength(BUILT_IN_SONGS.length);
    expect(Array.from(buttons).map((b) => b.dataset.song)).toEqual(BUILT_IN_SONGS.map((s) => s.id));
    expect(buttons[0].textContent).toContain(t('song.maryLamb'));
  });

  it('groups songs by difficulty and skips empty groups', () => {
    const { view } = setup();
    const headings = Array.from(view.element.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toEqual([t('options.songsBeginner'), t('options.songsEasy')]);
  });

  it('chooses a song when its button is pressed', () => {
    const { view, onChoose } = setup();
    view.element.querySelector<HTMLButtonElement>('[data-song="twinkle"]')!.click();
    expect(onChoose).toHaveBeenCalledWith('twinkle');
  });

  it('goes back to the menu with the back button', () => {
    const { view, onBack } = setup();
    view.element.querySelector<HTMLButtonElement>('.back-btn')!.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('writes the titles again in the new language on refresh()', () => {
    const { view } = setup();
    setLocale('fa');
    view.refresh();
    expect(view.element.querySelector('h2')!.textContent).toBe('آهنگ‌ها');
    expect(view.element.querySelector('[data-song="mary-lamb"]')!.textContent).toContain(t('song.maryLamb'));
    expect(view.element.querySelector('h3')!.textContent).toBe('مبتدی');
  });
});
