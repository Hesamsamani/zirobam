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
    expect(Array.from(buttons).map((b) => b.dataset.song).sort()).toEqual(BUILT_IN_SONGS.map((s) => s.id).sort());
    expect(view.element.querySelector('[data-song="mary-lamb"]')!.textContent).toContain(t('song.maryLamb'));
  });

  it('groups songs by difficulty with the exercises last, and skips empty groups', () => {
    const { view } = setup();
    const headings = Array.from(view.element.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toEqual([
      t('options.songsBeginner'),
      t('options.songsEasy'),
      t('options.songsIntermediate'),
      t('songs.exercises'),
    ]);
    const exercises = view.element.querySelectorAll('[data-group="exercises"] [data-song]');
    expect(exercises.length).toBeGreaterThanOrEqual(8);
    expect(view.element.querySelector('[data-group="beginner"] [data-song="ex-c-scale"]')).toBeNull();
  });

  it('leaves out a group that has no songs', () => {
    const only = new SongsView({ songs: BUILT_IN_SONGS.filter((s) => s.id === 'mary-lamb'), onChoose: () => {}, onBack: () => {} });
    expect(Array.from(only.element.querySelectorAll('h3')).map((h) => h.textContent)).toEqual([t('options.songsBeginner')]);
  });

  it('shows the best stars on the songs that were finished, and none on the others', () => {
    const stars: Record<string, number> = { 'mary-lamb': 3, twinkle: 1 };
    const view = new SongsView({ songs: BUILT_IN_SONGS, onChoose: () => {}, onBack: () => {}, starsFor: (id) => stars[id] ?? 0 });
    const card = (id: string) => view.element.querySelector(`[data-song="${id}"]`)!;
    expect(card('mary-lamb').querySelectorAll('.song-card-stars .star.on')).toHaveLength(3);
    expect(card('twinkle').querySelectorAll('.song-card-stars .star.on')).toHaveLength(1);
    expect(card('twinkle').querySelectorAll('.song-card-stars .star')).toHaveLength(3);
    expect(card('mary-lamb').querySelector('.song-card-stars')!.getAttribute('aria-label')).toBe('Best: 3 of 3 stars');
    expect(card('ode-to-joy').querySelector('.song-card-stars')).toBeNull();
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
