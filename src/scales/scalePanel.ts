import { formatNumber, t, type MessageKey } from '../i18n';
import type { NotationToolkit } from '../learn/noteCard';
import { buildKeysPicture } from '../lessons/keysPicture';
import { renderStaffPicture } from '../lessons/staffPicture';
import type { PianoVoice } from '../playback/pianoVoice';
import { WaitSession } from '../practice/waitMode';
import { keyName, parsePitch, pianoMidi } from '../theory/pitch';
import { getScale } from '../theory/scaleCatalog';
import type { SpelledScale } from '../theory/spell';
import type { Labels } from './dictionaryState';
import { fingeringFor } from './fingering';
import { stepsOf, toneLabel } from './stairs';

export interface ScalePanelDeps {
  toolkit: NotationToolkit;
  voice: PianoVoice;
  /** A note name, with or without an octave (`Bb4`, `Ek`), as the student has chosen to read it. */
  formatName(note: string): string;
  /** A scale was played along to the end (for the rewards). */
  onPlayed(): void;
  /** A key was pressed while playing along: the note the scale asks for, written as in the scale, and whether the key was right. */
  onAnswer?(note: string, correct: boolean): void;
  /** What goes under the notes of the staff was changed. */
  onLabels(labels: Labels): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const withoutOctave = (pitch: string): string => pitch.replace(/-?\d+$/, '');

/** A scale on a root: its steps, its staff, its keys, and the buttons to hear it and to play along. */
export class ScalePanel {
  readonly element: HTMLElement;
  private readonly deps: ScalePanelDeps;
  private readonly title: HTMLElement;
  private readonly persian: HTMLElement;
  private readonly stairs: HTMLElement;
  private readonly notesLine: HTMLElement;
  private readonly labelRow: HTMLElement;
  private readonly noFingering: HTMLElement;
  private readonly staff: HTMLElement;
  private readonly keysHolder: HTMLElement;
  private readonly hearButton: HTMLButtonElement;
  private readonly alongButton: HTMLButtonElement;
  private readonly status: HTMLElement;

  private scale: SpelledScale | null = null;
  private labels: Labels = 'names';
  private session: WaitSession | null = null;
  private active = true;

  constructor(deps: ScalePanelDeps) {
    this.deps = deps;
    this.element = make('section', 'dict-scale');

    this.title = make('h3', 'dict-scale-title');
    this.persian = make('div', 'dict-persian');
    this.persian.hidden = true;
    this.stairs = make('div', 'dict-stairs');
    this.stairs.setAttribute('role', 'group');
    this.stairs.setAttribute('dir', 'ltr');
    this.notesLine = make('p', 'sc-notes');
    this.labelRow = make('div', 'sc-chips sc-labels');
    this.labelRow.setAttribute('role', 'group');
    this.noFingering = make('p', 'sc-note');
    this.noFingering.hidden = true;
    this.staff = make('div', 'sc-staff');
    this.staff.setAttribute('dir', 'ltr');
    this.keysHolder = make('div', 'sc-keys');
    this.keysHolder.setAttribute('dir', 'ltr');

    this.hearButton = make('button', 'sc-hear');
    this.hearButton.type = 'button';
    this.hearButton.addEventListener('click', () => void this.hear());
    this.alongButton = make('button', 'sc-along');
    this.alongButton.type = 'button';
    this.alongButton.addEventListener('click', () => this.toggleAlong());
    const actions = make('div', 'sc-actions');
    actions.append(this.hearButton, this.alongButton);
    this.status = make('p', 'sc-status');
    this.status.setAttribute('role', 'status');

    this.element.append(this.title, this.persian, this.stairs, this.notesLine, this.labelRow, this.noFingering, this.staff, this.keysHolder, actions, this.status);
  }

  /** What is being played along, for the end-to-end tests. */
  current(): { along: boolean } {
    return { along: this.session !== null };
  }

  activate(): void {
    this.active = true;
  }

  /** The screen was left: stop the sound and the playing along, and ignore keys. */
  deactivate(): void {
    this.active = false;
    this.deps.voice.stopAll();
    this.stopAlong();
    this.refreshButtons();
  }

  /** Draws a scale. What was playing is stopped. */
  show(scale: SpelledScale, labels: Labels): void {
    this.deps.voice.stopAll();
    this.stopAlong();
    this.scale = scale;
    this.labels = labels;
    this.render();
  }

  /** A key played on a MIDI keyboard (the keys of the screen come in through `pressed` themselves). */
  keyPressed(note: string): void {
    if (this.active) this.pressed(note, false);
  }

  // ----- drawing -----

  private render(): void {
    const scale = this.scale;
    if (!scale) return;
    const { formatName } = this.deps;
    this.title.textContent = t('dict.scale.title', { root: formatName(scale.root), scale: t(`scale.name.${scale.id}` as MessageKey) });
    this.drawPersian(scale);
    this.drawStairs(scale);
    this.notesLine.textContent = t('scales.notes', { notes: scale.pitches.map((p) => formatName(withoutOctave(p))).join(' ') });
    this.drawLabelRow();
    this.drawStaff(scale);
    this.drawKeys(scale);
    this.refreshButtons();
  }

  private drawPersian(scale: SpelledScale): void {
    const info = getScale(scale.id).persian;
    this.persian.hidden = !info;
    const paragraphs: HTMLElement[] = [];
    if (info) {
      const add = (key: MessageKey) => {
        const p = make('p', 'dict-persian-line');
        p.textContent = t(key);
        paragraphs.push(p);
      };
      add('dict.persian.note');
      if (!info.reviewed) add('dict.persian.unreviewed');
      if (scale.hasQuarterTones) add('dict.persian.piano');
    }
    this.persian.replaceChildren(...paragraphs);
  }

  private drawStairs(scale: SpelledScale): void {
    this.stairs.setAttribute('aria-label', t('dict.steps'));
    const buttons = stepsOf(scale).map((step) => {
      const button = make('button', 'dict-step');
      button.type = 'button';
      button.style.flexGrow = String(step.gap);
      button.dataset.index = String(step.index);
      button.dataset.tonic = String(step.tonic);
      button.dataset.quarter = String(step.quarter);
      const name = this.deps.formatName(step.name);
      const tones = toneLabel(step.tones);
      button.setAttribute('aria-label', t('dict.step.aria', { note: name, degree: step.degree, tones }));
      const degree = make('span', 'dict-step-degree');
      degree.textContent = formatNumber(step.degree);
      const label = make('span', 'dict-step-name');
      label.textContent = name;
      const size = make('span', 'dict-step-tones');
      size.textContent = tones;
      button.append(degree, label, size);
      button.addEventListener('click', () => this.playNote(scale.pitches[step.index]));
      return button;
    });
    this.stairs.replaceChildren(...buttons);
  }

  private drawLabelRow(): void {
    this.labelRow.setAttribute('aria-label', t('scales.labels'));
    const chips = (['names', 'right', 'left'] as const).map((labels) => {
      const chip = make('button', 'sc-chip');
      chip.type = 'button';
      chip.textContent = t(`scales.labels.${labels}` as MessageKey);
      chip.dataset.labels = labels;
      chip.setAttribute('aria-pressed', String(this.labels === labels));
      chip.addEventListener('click', () => this.deps.onLabels(labels));
      return chip;
    });
    this.labelRow.replaceChildren(...chips);
  }

  /** The text under the notes of the staff: the note names or the fingers, and whether the fingers are missing. */
  private labelTexts(scale: SpelledScale): { texts: string[]; missing: boolean } {
    const names = scale.pitches.map((p) => this.deps.formatName(withoutOctave(p)));
    if (this.labels === 'names') return { texts: names, missing: false };
    const fingers = fingeringFor(scale, this.labels);
    return fingers ? { texts: fingers.map((f) => formatNumber(f)), missing: false } : { texts: names, missing: true };
  }

  private drawStaff(scale: SpelledScale): void {
    const { texts, missing } = this.labelTexts(scale);
    this.noFingering.hidden = !missing;
    this.noFingering.textContent = missing ? t('scales.noFingering') : '';
    // measures of four beats, the last one may be shorter
    const tokens = scale.pitches.map((pitch) => `${pitch}q`);
    const measures: string[] = [];
    for (let i = 0; i < tokens.length; i += 4) measures.push(tokens.slice(i, i + 4).join(' '));
    let index = 0;
    try {
      renderStaffPicture(this.staff, {
        toolkit: this.deps.toolkit,
        spec: { clef: 'treble', notes: measures.join(' | '), fifths: scale.fifths ?? 0, beats: 4, free: true },
        names: true,
        formatName: () => texts[index++] ?? '',
        description: t('scales.staff'),
      });
    } catch {
      this.staff.replaceChildren();
    }
  }

  private drawKeys(scale: SpelledScale): void {
    const keys = scale.pitches.map((pitch) => pianoMidi(parsePitch(pitch)!));
    // two octaves from the C at or below the lowest key, which is C4 for almost every scale
    const octave = Math.floor(Math.min(...keys) / 12) - 1;
    const marks: Record<string, string> = {};
    const quarter: Record<string, { kind: 'koron' | 'sori'; label: string }> = {};
    stepsOf(scale).forEach((step) => {
      const key = keyName(scale.pitches[step.index]);
      marks[key] = '';
      if (step.quarter) {
        const kind = step.name.endsWith('k') ? 'koron' : 'sori';
        quarter[key] = { kind, label: t(kind === 'koron' ? 'dict.koron' : 'dict.sori') };
      }
    });
    marks[keyName(scale.pitches.at(-1)!)] = '';
    this.keysHolder.replaceChildren(
      buildKeysPicture({
        from: `C${octave}`,
        to: `C${octave + 2}`,
        names: 'white',
        marks,
        rootNotes: [keyName(scale.pitches[0]), keyName(scale.pitches.at(-1)!)],
        quarter,
        formatName: (note) => this.deps.formatName(note),
        formatMark: (text) => text,
        onPlay: (note) => this.pressed(note, true),
        ariaLabel: t('scales.keys'),
      }),
    );
    this.markNext();
  }

  private refreshButtons(): void {
    this.hearButton.textContent = t('scales.play');
    this.alongButton.textContent = t(this.session ? 'scales.stopAlong' : 'scales.playAlong');
    this.alongButton.setAttribute('aria-pressed', String(this.session !== null));
  }

  /** The key to play next is marked while playing along. */
  private markNext(): void {
    this.keysHolder.querySelectorAll('.lk-key').forEach((key) => key.classList.remove('next-key'));
    const session = this.session;
    const scale = this.scale;
    if (!session || !scale || session.finished()) return;
    const key = keyName(scale.pitches[session.index()]);
    this.keysHolder.querySelector(`.lk-key[data-note="${key}"]`)?.classList.add('next-key');
  }

  // ----- hearing and playing along -----

  private playNote(pitch: string): void {
    void this.deps.voice.ready().then((ok) => ok && this.deps.voice.play(pitch, 0.9, 0));
  }

  private async hear(): Promise<void> {
    const { voice } = this.deps;
    const scale = this.scale;
    if (!scale) return;
    if (!(await voice.ready())) {
      this.setStatus(t('ear.noSound'), 'bad');
      return;
    }
    voice.stopAll();
    const path = [...scale.pitches, ...scale.pitches.slice(0, -1).reverse()];
    path.forEach((pitch, i) => voice.play(pitch, 0.55, 0.05 + i * 0.4));
  }

  private toggleAlong(): void {
    if (this.session) {
      this.stopAlong();
    } else if (this.scale) {
      this.session = new WaitSession(this.scale.pitches.map((pitch) => ({ pitches: [pitch] })));
      this.setStatus(t('scales.along.hint'), '');
    }
    this.refreshButtons();
    this.markNext();
  }

  private stopAlong(): void {
    this.session = null;
    this.setStatus('', '');
    this.refreshButtons();
    this.markNext();
  }

  /** A key was played (on the picture or on a MIDI keyboard). */
  private pressed(note: string, fromScreen: boolean): void {
    if (fromScreen) this.playNote(note);
    const session = this.session;
    const scale = this.scale;
    if (!session || !scale) return;
    const asked = scale.pitches[session.index()];
    const press = session.press(note);
    if (press.result === 'ignored') return;
    if (press.result === 'wrong') {
      this.setStatus(t('scales.along.wrong'), 'bad');
      this.deps.onAnswer?.(asked, false);
      return;
    }
    this.deps.onAnswer?.(asked, true);
    if (press.result === 'done') {
      this.session = null;
      this.setStatus(t('scales.along.done'), 'good');
      this.deps.onPlayed();
      this.refreshButtons();
    } else {
      this.setStatus(t('scales.along.hint'), '');
    }
    this.markNext();
  }

  private setStatus(text: string, tone: 'good' | 'bad' | ''): void {
    this.status.textContent = text;
    this.status.dataset.tone = tone;
  }
}
