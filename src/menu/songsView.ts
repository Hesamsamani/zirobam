import { t, type MessageKey } from '../i18n';
import type { BuiltInSong } from '../songs';
import { songTitle } from '../songs/songText';
import { createBackButton } from './backButton';

const DIFFICULTIES: ReadonlyArray<{ id: BuiltInSong['difficulty']; label: MessageKey }> = [
  { id: 'beginner', label: 'options.songsBeginner' },
  { id: 'easy', label: 'options.songsEasy' },
  { id: 'intermediate', label: 'options.songsIntermediate' },
];

export interface SongsViewDeps {
  songs: readonly BuiltInSong[];
  onChoose(songId: string): void;
  onBack(): void;
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
    this.refresh();
  }

  /** Builds the list again, after the language changed. */
  refresh(): void {
    this.title.textContent = t('songs.title');
    this.subtitle.textContent = t('songs.subtitle');
    this.list.replaceChildren();
    for (const difficulty of DIFFICULTIES) {
      const songs = this.deps.songs.filter((song) => song.difficulty === difficulty.id);
      if (songs.length === 0) continue;
      const group = make('div', 'song-group');
      const heading = make('h3', 'song-group-title');
      heading.textContent = t(difficulty.label);
      const items = make('ul', 'song-list');
      for (const song of songs) items.appendChild(this.buildSong(song));
      group.append(heading, items);
      this.list.appendChild(group);
    }
  }

  private buildSong(song: BuiltInSong): HTMLLIElement {
    const item = document.createElement('li');
    const button = make('button', 'song-card');
    button.type = 'button';
    button.dataset.song = song.id;
    const name = make('span', 'song-card-title');
    name.textContent = songTitle(song);
    button.appendChild(name);
    button.addEventListener('click', () => this.deps.onChoose(song.id));
    item.appendChild(button);
    return item;
  }
}
