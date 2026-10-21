import { A4_DEFAULT, A4_MAX, A4_MIN, clampA4, readFrequency, type NoteReading, type TuningMode } from '../audio/tuning';
import { NoteTracker } from '../audio/noteTracker';
import type { EventEmitter } from '../core/events';
import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import { createBackButton } from '../menu/backButton';
import type { MicFrame, MicState } from '../audio/micInput';

/** What the tuner needs of the microphone: the real one is `MicInput`, a small fake stands in for it in tests. */
export interface MicSource {
  readonly state: MicState;
  start(): Promise<MicState>;
  stop(): void;
  readonly onFrame: Pick<EventEmitter<MicFrame>, 'on'>;
  readonly onState: Pick<EventEmitter<MicState>, 'on'>;
}

export interface TunerViewDeps {
  mic: MicSource;
  hub: NoteInputHub;
  /** A note name with its octave, as the student has chosen to read it. */
  formatName(note: string): string;
  onBack(): void;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

const KEY = 'mic.v1';
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteOfMidi = (midi: number): string => `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
/** The last few readings are averaged (their median), so that the needle does not tremble. */
const HISTORY = 5;
/** After this many frames with no pitch the note is dimmed: about a third of a second. */
const QUIET_FRAMES = 12;
const IN_TUNE_CENTS = 5;

interface Settings {
  a4: number;
  mode: TuningMode;
  send: boolean;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const median = (values: number[]): number => [...values].sort((a, z) => a - z)[Math.floor(values.length / 2)];

/** The tuner: the note that is heard, and how many cents it is from it, on a meter. */
export class TunerView {
  readonly id = 'tuner' as const;
  readonly element: HTMLElement;
  private readonly deps: TunerViewDeps;
  private readonly storage: NonNullable<TunerViewDeps['storage']>;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly note: HTMLElement;
  private readonly hz: HTMLElement;
  private readonly meter: HTMLElement;
  private readonly needle: HTMLElement;
  private readonly cents: HTMLElement;
  private readonly settingsBox: HTMLElement;

  private settings: Settings;
  private readonly history: number[] = [];
  private quiet = QUIET_FRAMES;
  private readonly tracker = new NoteTracker();
  private reading: NoteReading | null = null;

  constructor(deps: TunerViewDeps) {
    this.deps = deps;
    this.storage = deps.storage ?? { getItem: storageGet, setItem: storageSet };
    this.settings = this.load();

    this.element = make('section', 'tuner-view');
    this.element.id = 'tunerView';
    this.element.dataset.views = 'tuner';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.toggle = make('button', 'sc-hear tn-toggle');
    this.toggle.type = 'button';
    this.toggle.addEventListener('click', () => void this.toggleListening());
    this.status = make('p', 'tn-status');
    this.status.setAttribute('role', 'status');

    this.note = make('p', 'tn-note');
    this.note.setAttribute('dir', 'ltr');
    this.hz = make('p', 'tn-hz');
    this.hz.setAttribute('dir', 'ltr');
    this.meter = make('div', 'tn-meter');
    this.meter.setAttribute('role', 'img');
    this.meter.setAttribute('dir', 'ltr');
    this.needle = make('div', 'tn-needle');
    const centre = make('div', 'tn-centre');
    this.meter.append(centre, this.needle);
    this.cents = make('p', 'tn-cents');

    this.settingsBox = make('div', 'tn-settings');
    this.element.append(header, this.toggle, this.status, this.note, this.meter, this.cents, this.hz, this.settingsBox);

    deps.mic.onFrame.on((frame) => this.frame(frame));
    deps.mic.onState.on((state) => {
      this.drawStatus(state);
      if (state !== 'on') this.silence();
    });
    this.render();
  }

  current(): { reading: NoteReading | null; settings: Settings } {
    return { reading: this.reading, settings: { ...this.settings } };
  }

  activate(): void {
    this.render();
  }

  /** The screen is left: the microphone is let go. */
  deactivate(): void {
    this.deps.mic.stop();
    this.silence();
  }

  change(): void {
    // the address of this screen has no name
  }

  refresh(): void {
    this.render();
  }

  // ----- settings -----

  private load(): Settings {
    try {
      const data = JSON.parse(this.storageGet() ?? 'null') as Partial<Settings> | null;
      if (data && typeof data === 'object') {
        return { a4: clampA4(Number(data.a4 ?? A4_DEFAULT)), mode: data.mode === 'quarter' ? 'quarter' : 'et', send: data.send === true };
      }
    } catch {
      // damaged: the defaults
    }
    return { a4: A4_DEFAULT, mode: 'et', send: false };
  }

  private storageGet(): string | null {
    return this.storage?.getItem(KEY) ?? null;
  }

  private save(): void {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // not kept
    }
  }

  // ----- listening -----

  private async toggleListening(): Promise<void> {
    if (this.deps.mic.state === 'on' || this.deps.mic.state === 'starting') {
      this.deps.mic.stop();
      return;
    }
    await this.deps.mic.start();
  }

  private silence(): void {
    this.history.length = 0;
    this.quiet = QUIET_FRAMES;
    for (const event of this.tracker.reset()) this.deps.hub.noteOff(noteOfMidi(event.midi), 'microphone');
    this.drawReading();
  }

  private frame(frame: MicFrame): void {
    if (frame.frequency === null) {
      this.quiet++;
      if (this.settings.send) this.send(null);
      if (this.quiet === QUIET_FRAMES) this.drawReading();
      return;
    }
    this.quiet = 0;
    this.history.push(frame.frequency);
    if (this.history.length > HISTORY) this.history.shift();
    this.reading = readFrequency(median(this.history), this.settings.a4, this.settings.mode);
    if (this.settings.send) this.send(this.reading);
    this.drawReading();
  }

  /** Notes into the rest of the app, as if from a keyboard: a quarter tone is sent as the key of its letter. */
  private send(reading: NoteReading | null): void {
    const midi = reading === null ? null : Math.round(reading.midi);
    for (const event of this.tracker.push(midi)) {
      const name = noteOfMidi(event.midi);
      if (event.type === 'on') this.deps.hub.noteOn(name, 'microphone');
      else this.deps.hub.noteOff(name, 'microphone');
    }
  }

  // ----- drawing -----

  private render(): void {
    this.title.textContent = t('tuner.title');
    this.subtitle.textContent = t('tuner.subtitle');
    this.drawStatus(this.deps.mic.state);
    this.drawSettings();
    this.drawReading();
  }

  private drawStatus(state: MicState): void {
    const listening = state === 'on' || state === 'starting';
    this.toggle.textContent = t(listening ? 'tuner.stop' : 'tuner.start');
    const text: Record<MicState, MessageKey | null> = {
      off: null,
      starting: 'tuner.starting',
      on: this.reading && this.quiet < QUIET_FRAMES ? null : 'tuner.listening',
      denied: 'tuner.denied',
      unavailable: 'tuner.unavailable',
    };
    const key = text[state];
    this.status.textContent = key ? t(key) : '';
    this.status.dataset.state = state;
  }

  private drawReading(): void {
    const live = this.quiet < QUIET_FRAMES && this.reading !== null;
    this.element.dataset.live = String(live);
    const reading = this.reading;
    if (!reading) {
      this.note.textContent = '–';
      this.hz.textContent = '';
      this.cents.textContent = '';
      this.needle.style.insetInlineStart = '50%';
      this.meter.dataset.tune = 'none';
      this.drawStatus(this.deps.mic.state);
      return;
    }
    this.note.textContent = this.deps.formatName(reading.name);
    this.hz.textContent = `${formatNumber(Math.round(reading.frequency * 10) / 10)} ${t('tuner.hz')}`;
    const range = this.settings.mode === 'quarter' ? 25 : 50;
    const ratio = Math.max(-1, Math.min(1, reading.cents / range));
    this.needle.style.insetInlineStart = `${50 + 50 * ratio}%`;
    const rounded = Math.round(reading.cents);
    const inTune = Math.abs(reading.cents) <= IN_TUNE_CENTS;
    this.meter.dataset.tune = inTune ? 'in' : rounded < 0 ? 'flat' : 'sharp';
    this.meter.setAttribute('aria-label', `${t('tuner.meter')}: ${rounded > 0 ? '+' : ''}${formatNumber(rounded)}`);
    this.cents.textContent = inTune ? t('tuner.inTune') : `${t('tuner.cents', { cents: `${rounded > 0 ? '+' : ''}${formatNumber(rounded)}` })} ${t(rounded < 0 ? 'tuner.flat' : 'tuner.sharp')}`;
    this.drawStatus(this.deps.mic.state);
  }

  private drawSettings(): void {
    const a4Label = make('label', 'tn-field');
    const a4Text = make('span', 'gen-label');
    a4Text.textContent = `${t('tuner.a4')} (${t('tuner.hz')})`;
    const a4 = make('input', 'tn-a4');
    a4.type = 'number';
    a4.min = String(A4_MIN);
    a4.max = String(A4_MAX);
    a4.step = '0.1';
    a4.value = String(this.settings.a4);
    a4.setAttribute('dir', 'ltr');
    a4.addEventListener('change', () => {
      this.settings.a4 = clampA4(Number(a4.value));
      a4.value = String(this.settings.a4);
      this.save();
    });
    a4Label.append(a4Text, a4);

    const modes = make('div', 'sc-chips');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', t('tuner.mode'));
    for (const mode of ['et', 'quarter'] as const) {
      const chip = make('button', 'sc-chip tn-mode');
      chip.type = 'button';
      chip.dataset.mode = mode;
      chip.textContent = t(`tuner.mode.${mode}` as MessageKey);
      chip.setAttribute('aria-pressed', String(this.settings.mode === mode));
      chip.addEventListener('click', () => {
        this.settings.mode = mode;
        this.history.length = 0;
        this.save();
        this.drawSettings();
      });
      modes.append(chip);
    }

    const send = make('button', 'sc-chip tn-send');
    send.type = 'button';
    send.textContent = t('tuner.send');
    send.title = t('tuner.send.hint');
    send.setAttribute('aria-pressed', String(this.settings.send));
    send.addEventListener('click', () => {
      this.settings.send = !this.settings.send;
      if (!this.settings.send) for (const event of this.tracker.reset()) this.deps.hub.noteOff(noteOfMidi(event.midi), 'microphone');
      this.save();
      this.drawSettings();
    });
    this.settingsBox.replaceChildren(a4Label, modes, send);
  }
}
