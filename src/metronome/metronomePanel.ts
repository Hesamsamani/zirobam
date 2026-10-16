import { applyTranslations, formatNumber, t, type MessageKey } from '../i18n';
import { MAX_BPM, MIN_BPM } from '../core/tempo';
import { BEATS_OPTIONS, type BeatsPerBar, type TempoStore } from './tempoStore';
import { tapTempo, type MetronomeEngine } from './metronomeEngine';

export interface MetronomePanelDeps {
  store: TempoStore;
  engine: MetronomeEngine;
  /** Called before the metronome starts, from the button press, to unlock the browser's audio. */
  prepareAudio?: () => void;
  now?: () => number;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, i18nKey?: MessageKey): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (i18nKey) {
    el.dataset.i18n = i18nKey;
    el.textContent = t(i18nKey);
  }
  return el;
}

/**
 * The controls of the metronome: tempo, tap, start and stop, bar length, accent, volume and the beat
 * dots. The same panel is shown in the floating window and in the in-page fallback.
 */
export class MetronomePanel {
  readonly element: HTMLElement;
  private readonly deps: MetronomePanelDeps;
  private readonly bpmOutput: HTMLElement;
  private readonly slider: HTMLInputElement;
  private readonly slowerButton: HTMLButtonElement;
  private readonly fasterButton: HTMLButtonElement;
  private readonly tapButton: HTMLButtonElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly beatButtons = new Map<BeatsPerBar, HTMLButtonElement>();
  private readonly accentInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly dotsEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly unsubscribe: Array<() => void>;
  private taps: number[] = [];
  private following = false;
  private lit = -1;

  constructor(deps: MetronomePanelDeps) {
    this.deps = deps;
    this.element = make('div', 'metro-panel');
    this.element.dataset.running = 'false';
    this.element.dataset.following = 'false';

    const title = make('h2', 'metro-title', 'metro.title');

    const tempo = make('div', 'metro-tempo');
    this.slowerButton = this.iconButton('slower', '−', 'metro.slower');
    this.fasterButton = this.iconButton('faster', '+', 'metro.faster');
    const reading = make('div', 'metro-reading');
    this.bpmOutput = make('span', 'metro-bpm');
    reading.append(this.bpmOutput, make('span', 'metro-unit', 'metro.bpm'));
    tempo.append(this.slowerButton, reading, this.fasterButton);

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.className = 'metro-slider';
    this.slider.min = String(MIN_BPM);
    this.slider.max = String(MAX_BPM);
    this.slider.dataset.i18nAttr = 'aria-label:metro.tempo';
    this.slider.setAttribute('aria-label', t('metro.tempo'));

    const actions = make('div', 'metro-actions');
    this.toggleButton = make('button', 'metro-toggle');
    this.toggleButton.type = 'button';
    this.toggleButton.dataset.action = 'toggle';
    this.tapButton = make('button', 'metro-tap', 'metro.tap');
    this.tapButton.type = 'button';
    this.tapButton.dataset.action = 'tap';
    actions.append(this.toggleButton, this.tapButton);

    this.dotsEl = make('div', 'metro-dots');
    this.dotsEl.setAttribute('aria-hidden', 'true');

    const beats = make('div', 'metro-beats');
    beats.setAttribute('role', 'group');
    beats.dataset.i18nAttr = 'aria-label:metro.beats';
    beats.setAttribute('aria-label', t('metro.beats'));
    for (const n of BEATS_OPTIONS) {
      const button = make('button', 'metro-chip');
      button.type = 'button';
      button.dataset.beats = String(n);
      button.addEventListener('click', () => deps.store.setBeatsPerBar(n));
      this.beatButtons.set(n, button);
      beats.appendChild(button);
    }

    const accentLabel = make('label', 'metro-option');
    this.accentInput = document.createElement('input');
    this.accentInput.type = 'checkbox';
    this.accentInput.dataset.option = 'accent';
    accentLabel.append(this.accentInput, make('span', '', 'metro.accent'));

    const volumeLabel = make('label', 'metro-option metro-volume-row');
    this.volumeInput = document.createElement('input');
    this.volumeInput.type = 'range';
    this.volumeInput.className = 'metro-volume';
    this.volumeInput.min = '0';
    this.volumeInput.max = '100';
    volumeLabel.append(make('span', '', 'metro.volume'), this.volumeInput);

    this.statusEl = make('p', 'metro-status');
    this.statusEl.setAttribute('aria-live', 'polite');

    // Numbers, the slider and the beat dots read like music: left to right, also in Persian
    for (const el of [tempo, this.slider, this.dotsEl, beats]) el.setAttribute('dir', 'ltr');

    this.element.append(title, tempo, this.slider, actions, this.dotsEl, beats, accentLabel, volumeLabel, this.statusEl);

    this.slowerButton.addEventListener('click', (e) => this.nudge(-1, e));
    this.fasterButton.addEventListener('click', (e) => this.nudge(1, e));
    this.slider.addEventListener('input', () => deps.store.setBpm(Number(this.slider.value)));
    this.tapButton.addEventListener('click', () => this.tap());
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.accentInput.addEventListener('change', () => deps.store.setAccent(this.accentInput.checked));
    this.volumeInput.addEventListener('input', () => deps.store.setVolume(Number(this.volumeInput.value)));

    this.unsubscribe = [
      deps.store.onChange(() => this.render()),
      deps.engine.onRunningChange(() => this.render()),
      deps.engine.onBeat(({ beat, beatsPerBar }) => this.pulse(beat, beatsPerBar)),
    ];
    this.render();
  }

  private iconButton(name: string, glyph: string, labelKey: MessageKey): HTMLButtonElement {
    const button = make('button', 'metro-step');
    button.type = 'button';
    button.dataset.action = name;
    button.textContent = glyph;
    button.dataset.i18nAttr = `aria-label:${labelKey}`;
    button.setAttribute('aria-label', t(labelKey));
    return button;
  }

  private nudge(direction: 1 | -1, event: MouseEvent): void {
    const step = event.shiftKey ? 5 : 1;
    this.deps.store.setBpm(this.deps.store.state.bpm + direction * step);
  }

  private tap(): void {
    this.taps.push((this.deps.now ?? Date.now)());
    this.taps = this.taps.slice(-8);
    const bpm = tapTempo(this.taps);
    if (bpm !== null) this.deps.store.setBpm(bpm);
  }

  private toggle(): void {
    if (this.following) return;
    if (this.deps.engine.isRunning()) {
      this.deps.engine.stop();
    } else {
      this.deps.prepareAudio?.();
      this.deps.engine.start();
    }
  }

  /** While an exercise plays, the exercise sets the tempo and the click; the panel only follows it. */
  setExerciseRunning(running: boolean): void {
    this.following = running;
    if (running) this.deps.engine.stop();
    this.render();
  }

  /** Lights the dot of a beat; `beats` is the bar length (the exercise's time signature or the setting). */
  pulse(beat: number, beats: number): void {
    if (this.dotsEl.children.length !== beats) this.renderDots(beats);
    this.lit = beat;
    this.paintDots();
  }

  private renderDots(beats: number): void {
    this.dotsEl.replaceChildren();
    for (let i = 0; i < beats; i++) {
      const dot = make('span', 'metro-dot');
      this.dotsEl.appendChild(dot);
    }
    this.paintDots();
  }

  private paintDots(): void {
    const accent = this.deps.store.state.accent;
    Array.from(this.dotsEl.children).forEach((dot, i) => {
      const el = dot as HTMLElement;
      el.classList.toggle('accent', accent && i === 0);
      if (i === this.lit) el.dataset.on = 'true';
      else delete el.dataset.on;
    });
  }

  /** Brings every control up to date with the store, the engine and the exercise. */
  private render(): void {
    const state = this.deps.store.state;
    const running = this.deps.engine.isRunning();
    this.element.dataset.running = String(running);
    this.element.dataset.following = String(this.following);

    this.bpmOutput.textContent = formatNumber(state.bpm);
    this.slider.value = String(state.bpm);
    this.slider.setAttribute('aria-valuetext', `${formatNumber(state.bpm)} ${t('metro.bpm')}`);
    this.volumeInput.value = String(state.volume);
    this.accentInput.checked = state.accent;
    for (const [n, button] of this.beatButtons) {
      button.textContent = formatNumber(n);
      button.setAttribute('aria-pressed', String(n === state.beatsPerBar));
    }

    this.toggleButton.textContent = running ? t('metro.stop') : t('metro.start');
    this.toggleButton.dataset.i18n = running ? 'metro.stop' : 'metro.start';
    this.toggleButton.setAttribute('aria-pressed', String(running));
    this.statusEl.textContent = this.following ? t('metro.following') : '';

    for (const control of [this.toggleButton, this.slowerButton, this.fasterButton, this.tapButton, this.slider]) {
      control.disabled = this.following;
    }
    for (const button of this.beatButtons.values()) button.disabled = this.following;
    this.accentInput.disabled = this.following;

    const beats = this.following && this.dotsEl.children.length > 0 ? this.dotsEl.children.length : state.beatsPerBar;
    if (!running && !this.following) this.lit = -1;
    if (this.dotsEl.children.length !== beats) this.renderDots(beats);
    else this.paintDots();
  }

  /** Write the texts again, after the language changed. */
  refresh(): void {
    applyTranslations(this.element);
    this.render();
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
  }
}
