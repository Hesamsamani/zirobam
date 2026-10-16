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

describe('SongsView: my scores', () => {
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  function setupScores(initial: Array<{ id: string; title: string; artist?: string }> = [], persistent = true) {
    let list = initial.map((s, i) => ({ ...s, kind: 'xml' as const, size: 10, addedAt: 100 - i }));
    const listeners = new Set<() => void>();
    const scores = {
      list: vi.fn(async () => list),
      practise: vi.fn(),
      remove: vi.fn(async (id: string) => {
        list = list.filter((s) => s.id !== id);
        listeners.forEach((fn) => fn());
      }),
      persistent: () => persistent,
      onChange: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      change: (next: typeof initial) => {
        list = next.map((s, i) => ({ ...s, kind: 'xml' as const, size: 10, addedAt: 100 - i }));
        listeners.forEach((fn) => fn());
      },
    };
    const view = new SongsView({ songs: BUILT_IN_SONGS, onChoose: vi.fn(), onBack: vi.fn(), scores });
    document.body.replaceChildren(view.element);
    return { view, scores };
  }

  beforeEach(() => {
    localStorage.clear();
    initLocale();
  });

  it('shows no group when there are no scores', async () => {
    const { view } = setupScores();
    await flush();
    expect(view.element.querySelector('.my-scores')).toBeNull();
  });

  it('lists the scores of the student at the top, newest first, with their artist', async () => {
    const { view } = setupScores([
      { id: 'file-1', title: 'My Tune' },
      { id: 'pop-queen-flash', title: 'Flash', artist: 'Queen' },
    ]);
    await flush();
    const group = view.element.querySelector('.my-scores')!;
    expect(view.element.querySelector('.song-groups')!.firstElementChild).toBe(group);
    expect(group.querySelector('.song-group-title')!.textContent).toBe('My scores');
    const cards = Array.from(group.querySelectorAll<HTMLElement>('.song-card'));
    expect(cards.map((c) => c.dataset.score)).toEqual(['file-1', 'pop-queen-flash']);
    expect(cards[1].textContent).toContain('Flash');
    expect(cards[1].textContent).toContain('Queen');
  });

  it('practises a score when its card is pressed', async () => {
    const { view, scores } = setupScores([{ id: 'file-1', title: 'My Tune' }]);
    await flush();
    view.element.querySelector<HTMLButtonElement>('[data-score="file-1"]')!.click();
    expect(scores.practise).toHaveBeenCalledWith('file-1');
  });

  it('asks before removing, and removes when told to', async () => {
    const { view, scores } = setupScores([{ id: 'file-1', title: 'My Tune' }]);
    await flush();
    view.element.querySelector<HTMLButtonElement>('.score-remove')!.click();
    expect(view.element.querySelector('.score-confirm')!.textContent).toContain('Remove your score of My Tune?');
    expect(scores.remove).not.toHaveBeenCalled();
    view.element.querySelector<HTMLButtonElement>('.score-confirm-yes')!.click();
    await flush();
    expect(scores.remove).toHaveBeenCalledWith('file-1');
    expect(view.element.querySelector('.my-scores')).toBeNull();
  });

  it('keeps the score when told to keep it', async () => {
    const { view, scores } = setupScores([{ id: 'file-1', title: 'My Tune' }]);
    await flush();
    view.element.querySelector<HTMLButtonElement>('.score-remove')!.click();
    view.element.querySelector<HTMLButtonElement>('.score-keep')!.click();
    expect(scores.remove).not.toHaveBeenCalled();
    expect(view.element.querySelector('[data-score="file-1"]')).not.toBeNull();
  });

  it('updates when a score is added or removed elsewhere', async () => {
    const { view, scores } = setupScores();
    await flush();
    scores.change([{ id: 'file-9', title: 'New one' }]);
    await flush();
    expect(view.element.querySelector('[data-score="file-9"]')).not.toBeNull();
  });

  it('says so when the browser cannot keep the scores', async () => {
    const { view } = setupScores([{ id: 'file-1', title: 'My Tune' }], false);
    await flush();
    expect(view.element.querySelector('.song-group-hint')!.textContent).toContain('only until you close the page');
  });

  it('writes the group in Persian', async () => {
    setLocale('fa');
    const { view } = setupScores([{ id: 'file-1', title: 'آهنگ من' }]);
    await flush();
    expect(view.element.querySelector('.my-scores .song-group-title')!.textContent).toBe('نت‌های من');
  });
});
