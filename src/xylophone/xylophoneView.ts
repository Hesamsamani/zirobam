import { applyTranslations, formatNumber, t, type MessageKey } from '../i18n';
import { storageGet, storageSet } from '../core/safeStorage';
import type { NoteInputHub, NoteSource } from '../input/noteInput';
import type { NoteStats } from '../learn/noteStats';
import { clefForPitch, type Clef } from '../learn/nameTheNote';
import type { BuiltInSong } from '../songs';
import { songTitle } from '../songs/songText';
import { createBackButton } from '../menu/backButton';
import { KEY_ROWS, ROW_IDS, barsForRow, isRowId, type RowId, type XyloBar } from './keyRows';
import { playableSongs, type PlayableSong } from './songMelody';
import { ReadRound, SongRun } from './xyloGame';
import { XylophoneInput } from './xylophoneInput';

type Mode = 'free' | 'read' | 'song';
const MODES: readonly Mode[] = ['free', 'read', 'song'];
const MODE_LABELS: Readonly<Record<Mode, MessageKey>> = {
  free: 'xylo.mode.free',
  read: 'xylo.mode.read',
  song: 'xylo.mode.song',
};
const ROW_LABELS: Readonly<Record<RowId, MessageKey>> = {
  number: 'xylo.row.number',
  top: 'xylo.row.top',
  home: 'xylo.row.home',
  bottom: 'xylo.row.bottom',
};
const OCTAVES: readonly number[] = [4, 5];

const KEY_ROW = 'xylo.row';
const KEY_OCTAVE = 'xylo.octave';
const KEY_MODE = 'xylo.mode';
const KEY_NAMES = 'xylo.names';
const KEY_HINTS = 'xylo.hints';

export interface XylophoneViewDeps {
  hub: NoteInputHub;
  sound: { play(noteName: string): void };
  /** Statistics of the "read and play" mode, kept apart from the note quiz. */
  stats: NoteStats;
  songs: readonly BuiltInSong[];
  renderNote: (pitch: string, clef: Clef, into: HTMLElement) => void;
  /** A note name in the chosen system, without the octave. */
  formatName: (noteName: string) => string;
  onBack(): void;
  rng?: () => number;
  autoAdvanceMs?: number;
  onReadAnswer?(correct: boolean, pitch: string): void;
  onSongFinished?(songId: string, stars: 1 | 2 | 3, mistakes: number): void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  i18nKey?: MessageKey
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (i18nKey) {
    el.dataset.i18n = i18nKey;
    el.textContent = t(i18nKey);
  }
  return el;
}

function savedMode(): Mode {
  const value = storageGet(KEY_MODE);
  return MODES.find((m) => m === value) ?? 'free';
}

function savedRow(): RowId {
  const value = storageGet(KEY_ROW);
  return isRowId(value) ? value : 'home';
}

function savedOctave(): number {
  return OCTAVES.find((o) => String(o) === storageGet(KEY_OCTAVE)) ?? 4;
}

/**
 * The xylophone: coloured bars that are played with the keys of one row of the keyboard (left to
 * right), the mouse or touch. Besides free play there is "read the note and play it" and "play a
 * song note by note".
 */
export class XylophoneView {
  readonly element: HTMLElement;
  private readonly deps: XylophoneViewDeps;
  private readonly input: XylophoneInput;
  private readonly round: ReadRound;
  private readonly unsubscribe: Array<() => void>;

  private readonly modeButtons = new Map<Mode, HTMLButtonElement>();
  private readonly rowButtons = new Map<RowId, HTMLButtonElement>();
  private readonly octaveButtons = new Map<number, HTMLButtonElement>();
  private readonly namesInput: HTMLInputElement;
  private readonly hintsInput: HTMLInputElement;
  private readonly barsEl: HTMLElement;
  private readonly barEls = new Map<string, HTMLButtonElement>();
  private readonly pointerNotes = new Map<number, string>();
  private readonly tip: HTMLElement;
  private readonly card: HTMLElement;
  private readonly noteHolder: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly starsEl: HTMLElement;
  private readonly songsEl: HTMLElement;
  private readonly againButton: HTMLButtonElement;

  private row: RowId = savedRow();
  private octave = savedOctave();
  private mode: Mode = savedMode();
  private showNames = storageGet(KEY_NAMES) !== '0';
  private hints = storageGet(KEY_HINTS) === '1';
  private bars: XyloBar[] = [];
  private active = false;
  private locked = false;
  private revealed: string | null = null;
  private playable: PlayableSong[] = [];
  private songId: string | null = null;
  private run: SongRun | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: XylophoneViewDeps) {
    this.deps = deps;
    this.bars = barsForRow(this.row, this.octave);
    this.input = new XylophoneInput(deps.hub, this.bars);
    this.round = new ReadRound(deps.stats, this.bars.map((b) => b.noteName), deps.rng);

    this.element = make('section', 'xylo-view');
    this.element.id = 'xylophoneView';
    this.element.dataset.views = 'xylophone';

    // Header
    const header = make('header', 'view-header');
    header.append(
      createBackButton(deps.onBack),
      make('h2', 'view-title', 'xylo.title'),
      make('p', 'view-subtitle', 'xylo.subtitle')
    );

    // Controls: mode, keyboard row, lowest bar, options
    const controls = make('div', 'xylo-controls');
    const modes = this.group('xylo-modes', 'xylo.modes');
    for (const mode of MODES) {
      const button = make('button', 'xylo-chip', MODE_LABELS[mode]);
      button.type = 'button';
      button.dataset.mode = mode;
      button.addEventListener('click', () => this.setMode(mode));
      this.modeButtons.set(mode, button);
      modes.appendChild(button);
    }

    const rows = this.group('xylo-rows', 'xylo.row.label');
    for (const id of ROW_IDS) {
      const button = make('button', 'xylo-chip xylo-row-chip');
      button.type = 'button';
      button.dataset.row = id;
      const name = make('span', 'xylo-row-name', ROW_LABELS[id]);
      const keys = make('span', 'xylo-row-keys');
      keys.setAttribute('dir', 'ltr');
      keys.textContent = KEY_ROWS[id].labels.slice(0, 4).join(' ');
      button.append(name, keys);
      button.addEventListener('click', () => this.setRow(id));
      this.rowButtons.set(id, button);
      rows.appendChild(button);
    }

    const octaves = this.group('xylo-octaves', 'xylo.octave.label');
    for (const octave of OCTAVES) {
      const button = make('button', 'xylo-chip');
      button.type = 'button';
      button.dataset.octave = String(octave);
      button.addEventListener('click', () => this.setOctave(octave));
      this.octaveButtons.set(octave, button);
      octaves.appendChild(button);
    }

    const options = make('div', 'xylo-options');
    this.namesInput = this.checkbox('names', 'xylo.names', this.showNames, (on) => {
      this.showNames = on;
      storageSet(KEY_NAMES, on ? '1' : '0');
      this.element.classList.toggle('hide-names', !on);
    });
    this.hintsInput = this.checkbox('hints', 'xylo.hints', this.hints, (on) => {
      this.hints = on;
      storageSet(KEY_HINTS, on ? '1' : '0');
      this.updateHints();
    });
    options.append(this.namesInput.parentElement!, this.hintsInput.parentElement!);
    controls.append(modes, rows, octaves, options);

    // Panel: what to play
    const panel = make('div', 'xylo-panel');
    this.tip = make('p', 'xylo-tip', 'xylo.free.tip');
    this.songsEl = make('div', 'xylo-songs');
    this.songsEl.setAttribute('role', 'group');
    this.songsEl.setAttribute('aria-label', t('xylo.song.choose'));
    this.card = make('div', 'xylo-card');
    this.card.setAttribute('dir', 'ltr');
    this.noteHolder = make('div', 'xylo-note');
    this.card.appendChild(this.noteHolder);
    this.prompt = make('p', 'xylo-prompt');
    this.progress = make('p', 'xylo-progress');
    this.feedback = make('p', 'xylo-feedback');
    this.feedback.setAttribute('aria-live', 'polite');
    this.starsEl = make('div', 'xylo-stars');
    this.starsEl.setAttribute('role', 'img');
    for (let i = 0; i < 3; i++) {
      const star = make('span', 'star');
      star.textContent = '★';
      this.starsEl.appendChild(star);
    }
    this.againButton = make('button', 'xylo-again learn-text-btn', 'xylo.song.again');
    this.againButton.type = 'button';
    this.againButton.addEventListener('click', () => {
      if (this.songId) this.startSong(this.songId);
    });
    panel.append(this.tip, this.songsEl, this.card, this.prompt, this.progress, this.feedback, this.starsEl, this.againButton);

    // The bars
    this.barsEl = make('div', 'xylo-bars');
    this.barsEl.setAttribute('dir', 'ltr');

    this.element.append(header, controls, panel, this.barsEl);
    this.element.classList.toggle('hide-names', !this.showNames);

    this.unsubscribe = [
      deps.hub.onNoteOn.on(({ noteName, source }) => this.handleNoteOn(noteName, source)),
      deps.hub.onNoteOff.on(({ noteName }) => this.handleNoteOff(noteName)),
    ];
    this.rebuild();
  }

  // ----- building blocks -----

  private group(className: string, labelKey: MessageKey): HTMLElement {
    const el = make('div', `xylo-group ${className}`);
    el.setAttribute('role', 'group');
    el.dataset.i18nAttr = `aria-label:${labelKey}`;
    el.setAttribute('aria-label', t(labelKey));
    return el;
  }

  private checkbox(option: string, labelKey: MessageKey, checked: boolean, onChange: (on: boolean) => void): HTMLInputElement {
    const label = make('label', 'xylo-option');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.dataset.option = option;
    input.addEventListener('change', () => onChange(input.checked));
    const text = make('span', '', labelKey);
    label.append(input, text);
    return input;
  }

  // ----- lifecycle -----

  /** The screen is open: the keyboard row plays and the current mode starts over. */
  activate(): void {
    this.active = true;
    this.input.attach();
    this.applyMode();
  }

  deactivate(): void {
    this.input.detach();
    this.active = false;
    this.clearTimer();
  }

  dispose(): void {
    this.deactivate();
    for (const off of this.unsubscribe) off();
  }

  /** Write the texts again, after the language or the note names changed. */
  refresh(): void {
    applyTranslations(this.element);
    this.renderBars();
    this.renderSettings();
    this.songsEl.setAttribute('aria-label', t('xylo.song.choose'));
    this.refreshSongs();
    this.updatePrompt();
    this.refreshProgress();
    this.updateHints();
  }

  // ----- settings -----

  private rebuild(): void {
    this.renderBars();
    this.renderSettings();
    this.applyMode();
  }

  private setRow(row: RowId): void {
    this.row = row;
    storageSet(KEY_ROW, row);
    this.changeBars();
  }

  private setOctave(octave: number): void {
    this.octave = octave;
    storageSet(KEY_OCTAVE, String(octave));
    this.changeBars();
  }

  private changeBars(): void {
    this.bars = barsForRow(this.row, this.octave);
    this.input.setBars(this.bars);
    this.round.setPool(this.bars.map((b) => b.noteName));
    this.renderBars();
    this.renderSettings();
    this.applyMode();
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    storageSet(KEY_MODE, mode);
    this.renderSettings();
    this.applyMode();
  }

  private renderSettings(): void {
    for (const [mode, button] of this.modeButtons) button.setAttribute('aria-pressed', String(mode === this.mode));
    for (const [id, button] of this.rowButtons) button.setAttribute('aria-pressed', String(id === this.row));
    for (const [octave, button] of this.octaveButtons) {
      button.setAttribute('aria-pressed', String(octave === this.octave));
      button.textContent = `${this.deps.formatName(`C${octave}`)}${formatNumber(octave)}`;
    }
  }

  private renderBars(): void {
    this.barsEl.replaceChildren();
    this.barEls.clear();
    const count = this.bars.length;
    for (const bar of this.bars) {
      const el = make('button', 'xylo-bar');
      el.type = 'button';
      el.tabIndex = -1;
      el.dataset.bar = String(bar.index);
      el.dataset.note = bar.noteName;
      el.style.setProperty('--bar-height', `${Math.round(250 - (bar.index / Math.max(1, count - 1)) * 130)}px`);
      el.style.setProperty('--bar-hue', String(Math.round((bar.index / count) * 280)));
      const name = this.deps.formatName(bar.noteName);
      el.setAttribute('aria-label', t('xylo.bar', { name, key: bar.label }));
      const nameEl = make('span', 'xylo-bar-name');
      nameEl.textContent = name;
      const keyEl = make('span', 'xylo-bar-key');
      keyEl.textContent = bar.label;
      el.append(nameEl, keyEl);

      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const id = (e as PointerEvent).pointerId ?? 0;
        this.pointerNotes.set(id, bar.noteName);
        this.deps.hub.noteOn(bar.noteName, 'xylophone');
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
        el.addEventListener(type, (e) => {
          const id = (e as PointerEvent).pointerId ?? 0;
          if (this.pointerNotes.get(id) !== bar.noteName) return;
          this.pointerNotes.delete(id);
          this.deps.hub.noteOff(bar.noteName, 'xylophone');
        });
      }
      this.barEls.set(bar.noteName, el);
      this.barsEl.appendChild(el);
    }
  }

  // ----- playing -----

  private handleNoteOn(noteName: string, source: NoteSource): void {
    if (!this.active) return;
    const el = this.barEls.get(noteName);
    if (el) el.dataset.active = 'true';
    if (source === 'xylophone') this.deps.sound.play(noteName);
    if (this.mode === 'read') this.answerRead(noteName);
    else if (this.mode === 'song') this.answerSong(noteName);
  }

  private handleNoteOff(noteName: string): void {
    const el = this.barEls.get(noteName);
    if (el) delete el.dataset.active;
  }

  // ----- modes -----

  private applyMode(): void {
    this.clearTimer();
    this.locked = false;
    this.revealed = null;
    this.element.dataset.mode = this.mode;
    delete this.element.dataset.pitch;
    delete this.element.dataset.result;
    this.feedback.textContent = '';
    this.starsEl.hidden = true;
    this.againButton.hidden = true;
    this.tip.hidden = this.mode !== 'free';
    this.card.hidden = this.mode === 'free';
    this.prompt.hidden = this.mode === 'free';
    this.progress.hidden = this.mode === 'free';
    this.songsEl.hidden = this.mode !== 'song';
    this.updatePrompt();

    if (this.mode === 'read') {
      this.askRead();
    } else if (this.mode === 'song') {
      this.refreshSongs();
      const first = this.playable.find((p) => p.song.id === this.songId) ?? this.playable[0];
      if (first) {
        this.startSong(first.song.id);
      } else {
        this.songId = null;
        this.run = null;
        this.noteHolder.replaceChildren();
        this.progress.textContent = '';
        this.feedback.textContent = t('xylo.song.none');
      }
    } else {
      this.updateHints();
    }
  }

  private updatePrompt(): void {
    if (this.mode !== 'free') this.prompt.textContent = t('xylo.read.prompt');
  }

  /** Marks the bar to play next when the hint is on (and the right bar after a wrong answer). */
  private updateHints(): void {
    for (const el of this.barEls.values()) delete el.dataset.hint;
    const target = this.mode === 'read' ? this.round.current() : this.mode === 'song' ? this.run?.current() ?? null : null;
    if (target && this.hints) this.barEls.get(target)?.setAttribute('data-hint', 'true');
    if (this.revealed) this.barEls.get(this.revealed)?.setAttribute('data-hint', 'true');
  }

  private showNote(pitch: string): void {
    this.element.dataset.pitch = pitch;
    this.deps.renderNote(pitch, clefForPitch(pitch), this.noteHolder);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ----- read and play -----

  private askRead(): void {
    this.clearTimer();
    this.locked = false;
    this.revealed = null;
    delete this.element.dataset.result;
    this.feedback.textContent = '';
    this.showNote(this.round.next());
    this.refreshProgress();
    this.updateHints();
  }

  private answerRead(noteName: string): void {
    if (this.locked || this.round.current() === null) return;
    this.locked = true;
    const result = this.round.answer(noteName);
    this.element.dataset.result = result.correct ? 'correct' : 'wrong';
    if (result.correct) {
      this.feedback.textContent = t('xylo.read.correct');
    } else {
      this.revealed = result.expected;
      this.feedback.textContent = t('xylo.read.wrong', {
        played: this.deps.formatName(noteName),
        expected: this.deps.formatName(result.expected),
      });
    }
    this.refreshProgress();
    this.updateHints();
    this.deps.onReadAnswer?.(result.correct, result.expected);
    const wait = this.deps.autoAdvanceMs ?? 900;
    this.timer = setTimeout(() => this.askRead(), result.correct ? wait : wait * 3);
  }

  // ----- songs -----

  private refreshSongs(): void {
    this.playable = playableSongs(this.deps.songs, this.bars.map((b) => b.noteName));
    this.songsEl.replaceChildren();
    for (const entry of this.playable) {
      const chip = make('button', 'xylo-chip xylo-song-chip');
      chip.type = 'button';
      chip.dataset.song = entry.song.id;
      chip.textContent = songTitle(entry.song);
      chip.setAttribute('aria-pressed', String(entry.song.id === this.songId));
      chip.addEventListener('click', () => this.startSong(entry.song.id));
      this.songsEl.appendChild(chip);
    }
  }

  private startSong(songId: string): void {
    const entry = this.playable.find((p) => p.song.id === songId);
    if (!entry) return;
    this.clearTimer();
    this.songId = songId;
    this.run = new SongRun(entry.notes);
    this.starsEl.hidden = true;
    this.againButton.hidden = true;
    this.feedback.textContent = '';
    delete this.element.dataset.result;
    for (const chip of this.songsEl.querySelectorAll<HTMLElement>('[data-song]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.song === songId));
    }
    this.showSongNote();
  }

  private showSongNote(): void {
    const current = this.run?.current();
    if (!current) return;
    this.showNote(current);
    this.refreshProgress();
    this.updateHints();
  }

  private answerSong(noteName: string): void {
    const run = this.run;
    if (!run || run.isDone()) return;
    const result = run.play(noteName);
    if (!result.correct) {
      this.feedback.textContent = t('xylo.song.wrong');
      this.refreshProgress();
      return;
    }
    this.feedback.textContent = '';
    if (result.done) this.finishSong(run);
    else this.showSongNote();
  }

  private finishSong(run: SongRun): void {
    const stars = run.stars();
    this.element.dataset.result = 'done';
    delete this.element.dataset.pitch;
    this.starsEl.hidden = false;
    this.starsEl.setAttribute('aria-label', t('xylo.stars', { n: formatNumber(stars) }));
    this.starsEl.querySelectorAll('.star').forEach((star, i) => star.classList.toggle('on', i < stars));
    this.againButton.hidden = false;
    this.feedback.textContent = t('xylo.song.done');
    this.refreshProgress();
    this.updateHints();
    if (this.songId) this.deps.onSongFinished?.(this.songId, stars, run.mistakes());
  }

  // ----- progress line -----

  private refreshProgress(): void {
    if (this.mode === 'read') {
      this.progress.textContent = t('xylo.read.streak', { n: formatNumber(this.round.streak()) });
    } else if (this.mode === 'song' && this.run) {
      const { index, total } = this.run.position();
      const position = this.run.isDone()
        ? t('xylo.song.progress', { n: formatNumber(total), total: formatNumber(total) })
        : t('xylo.song.progress', { n: formatNumber(index + 1), total: formatNumber(total) });
      const mistakes = this.run.mistakes();
      this.progress.textContent = mistakes > 0 ? `${position} · ${t('xylo.mistakes', { n: formatNumber(mistakes) })}` : position;
    }
  }
}
