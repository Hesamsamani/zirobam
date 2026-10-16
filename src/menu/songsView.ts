import { formatNumber, t } from '../i18n';
import type { ScoreSummary } from '../scores/scoreStore';
import type { BuiltInSong } from '../songs';
import { groupSongs } from '../songs/songGroups';
import { songTitle } from '../songs/songText';
import { createBackButton } from './backButton';

export interface SongsViewDeps {
  songs: readonly BuiltInSong[];
  onChoose(songId: string): void;
  onBack(): void;
  /** Best stars earned on a song (0 when it has not been finished). */
  starsFor?(songId: string): number;
  /** The student's own scores. Without it the screen has no "My scores" group. */
  scores?: {
    list(): Promise<ScoreSummary[]>;
    practise(scoreId: string): void;
    remove(scoreId: string): Promise<void>;
    /** False when the browser cannot keep files, so the scores last only until the page closes. */
    persistent(): boolean;
    onChange(listener: () => void): () => void;
  };
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The song picker: built-in melodies grouped by difficulty. */
export class SongsView {
  readonly element: HTMLElement;
  private readonly deps: SongsViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly list: HTMLElement;
  /** The score the student is being asked about removing. */
  private removing: string | null = null;
  /** The scores as last read from the store, so the group can be drawn again at once. */
  private scoreList: ScoreSummary[] = [];

  constructor(deps: SongsViewDeps) {
    this.deps = deps;
    this.element = make('section', 'songs-view');
    this.element.id = 'songsView';
    this.element.dataset.views = 'songs';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.list = make('div', 'song-groups');
    this.element.append(header, this.list);
    deps.scores?.onChange(() => void this.refreshScores());
    this.refresh();
  }

  /** Builds the list again, after the language changed. */
  refresh(): void {
    this.title.textContent = t('songs.title');
    this.subtitle.textContent = t('songs.subtitle');
    this.list.replaceChildren();
    for (const entry of groupSongs(this.deps.songs)) {
      const group = make('div', 'song-group');
      group.dataset.group = entry.id;
      const heading = make('h3', 'song-group-title');
      heading.textContent = t(entry.label);
      const items = make('ul', 'song-list');
      for (const song of entry.songs) items.appendChild(this.buildSong(song));
      group.append(heading, items);
      this.list.appendChild(group);
    }
    void this.refreshScores();
  }

  /** Reads the scores from the store and draws the group. */
  private async refreshScores(): Promise<void> {
    if (!this.deps.scores) return;
    this.scoreList = await this.deps.scores.list();
    this.renderScores();
  }

  /** The "My scores" group at the top; it appears only when there is a score. */
  private renderScores(): void {
    const scores = this.deps.scores;
    if (!scores) return;
    const all = this.scoreList;
    this.list.querySelector('.my-scores')?.remove();
    if (all.length === 0) return;

    const group = make('div', 'song-group my-scores');
    group.dataset.group = 'mine';
    group.appendChild(make('h3', 'song-group-title')).textContent = t('scores.group');
    group.appendChild(make('p', 'song-group-hint')).textContent = scores.persistent() ? t('scores.groupHint') : t('scores.memoryOnly');
    const items = make('ul', 'song-list');
    for (const score of all) items.appendChild(this.buildScore(score));
    group.appendChild(items);
    this.list.prepend(group);
  }

  private buildScore(score: ScoreSummary): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'score-item';
    if (this.removing === score.id) {
      const confirm = make('div', 'score-confirm');
      confirm.setAttribute('role', 'group');
      confirm.appendChild(make('span', 'score-confirm-text')).textContent = t('scores.removeAsk', { title: score.title });
      const yes = make('button', 'score-confirm-yes');
      yes.type = 'button';
      yes.textContent = t('scores.removeYes');
      yes.addEventListener('click', () => {
        this.removing = null;
        void this.deps.scores?.remove(score.id);
      });
      const keep = make('button', 'score-keep');
      keep.type = 'button';
      keep.textContent = t('scores.removeNo');
      keep.addEventListener('click', () => {
        this.removing = null;
        this.renderScores();
      });
      confirm.append(yes, keep);
      item.appendChild(confirm);
      return item;
    }

    const card = make('button', 'song-card');
    card.type = 'button';
    card.dataset.score = score.id;
    const name = make('span', 'song-card-title');
    name.textContent = score.title;
    name.setAttribute('dir', 'auto');
    card.appendChild(name);
    if (score.artist) {
      const by = make('span', 'song-card-by');
      by.textContent = score.artist;
      by.setAttribute('dir', 'auto');
      card.appendChild(by);
    }
    card.addEventListener('click', () => this.deps.scores?.practise(score.id));

    const remove = make('button', 'score-remove');
    remove.type = 'button';
    remove.textContent = t('scores.remove');
    remove.setAttribute('aria-label', t('scores.removeFor', { title: score.title }));
    remove.addEventListener('click', () => {
      this.removing = score.id;
      this.renderScores();
      this.list.querySelector<HTMLElement>('.score-keep')?.focus();
    });
    item.append(card, remove);
    return item;
  }

  private buildSong(song: BuiltInSong): HTMLLIElement {
    const item = document.createElement('li');
    const button = make('button', 'song-card');
    button.type = 'button';
    button.dataset.song = song.id;
    const name = make('span', 'song-card-title');
    name.textContent = songTitle(song);
    button.appendChild(name);
    const stars = this.deps.starsFor?.(song.id) ?? 0;
    if (stars > 0) {
      const row = make('span', 'song-card-stars');
      row.setAttribute('role', 'img');
      row.setAttribute('aria-label', t('song.stars', { n: formatNumber(stars) }));
      for (let i = 1; i <= 3; i++) {
        const star = make('span', i <= stars ? 'star on' : 'star');
        star.textContent = '★';
        star.setAttribute('aria-hidden', 'true');
        row.appendChild(star);
      }
      button.appendChild(row);
    }
    button.addEventListener('click', () => this.deps.onChoose(song.id));
    item.appendChild(button);
    return item;
  }
}
