import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { TempoStore } from '../metronome/tempoStore';
import { MetronomeEngine, type ClockLike } from '../metronome/metronomeEngine';
import { MetronomePanel } from '../metronome/metronomePanel';

class FakeClock implements ClockLike {
  frequency = { value: 0 };
  callback: (time: number) => void;
  constructor(callback: (time: number) => void, frequency: number) {
    this.callback = callback;
    this.frequency.value = frequency;
  }
  start() {}
  stop() {}
  dispose() {}
}

let store: TempoStore;
let engine: MetronomeEngine;
let clock: FakeClock | null;
let panel: MetronomePanel;
let prepared: number;
let nowMs: number;

const q = <T extends Element>(sel: string) => panel.element.querySelector(sel) as T;
const qa = <T extends Element>(sel: string) => Array.from(panel.element.querySelectorAll(sel)) as T[];
const action = (name: string) => q<HTMLButtonElement>(`[data-action="${name}"]`);

beforeEach(() => {
  localStorage.clear();
  initLocale();
  store = new TempoStore(null);
  store.setBpm(100);
  clock = null;
  engine = new MetronomeEngine(store, { playBeat: () => {} }, (cb, f) => (clock = new FakeClock(cb, f)));
  prepared = 0;
  nowMs = 0;
  panel = new MetronomePanel({ store, engine, prepareAudio: () => prepared++, now: () => nowMs });
  document.body.appendChild(panel.element);
});

afterEach(() => {
  panel.dispose();
  engine.stop();
  document.body.replaceChildren();
});

describe('tempo', () => {
  it('shows the tempo of the store', () => {
    expect(q('.metro-bpm').textContent).toBe('100');
    expect(q<HTMLInputElement>('.metro-slider').value).toBe('100');
  });

  it('changes it a step at a time, or five with Shift', () => {
    action('faster').click();
    expect(store.state.bpm).toBe(101);
    action('slower').click();
    action('slower').click();
    expect(store.state.bpm).toBe(99);
    action('faster').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(store.state.bpm).toBe(104);
  });

  it('follows the slider', () => {
    const slider = q<HTMLInputElement>('.metro-slider');
    slider.value = '150';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.state.bpm).toBe(150);
    expect(q('.metro-bpm').textContent).toBe('150');
  });

  it('updates when the tempo is changed somewhere else', () => {
    store.setBpm(72);
    expect(q('.metro-bpm').textContent).toBe('72');
    expect(q<HTMLInputElement>('.metro-slider').value).toBe('72');
  });

  it('sets the tempo from taps', () => {
    for (const t of [0, 500, 1000, 1500]) {
      nowMs = t;
      action('tap').click();
    }
    expect(store.state.bpm).toBe(120);
  });

  it('shows Persian digits in Persian', () => {
    setLocale('fa');
    panel.refresh();
    expect(q('.metro-bpm').textContent).toBe('۱۰۰');
  });
});

describe('start and stop', () => {
  it('starts the engine, preparing the audio first', () => {
    action('toggle').click();
    expect(engine.isRunning()).toBe(true);
    expect(prepared).toBe(1);
    expect(panel.element.dataset.running).toBe('true');
    expect(action('toggle').getAttribute('aria-pressed')).toBe('true');
  });

  it('stops it again', () => {
    action('toggle').click();
    action('toggle').click();
    expect(engine.isRunning()).toBe(false);
    expect(panel.element.dataset.running).toBe('false');
  });

  it('follows the engine when it is stopped from elsewhere', () => {
    action('toggle').click();
    engine.stop();
    expect(panel.element.dataset.running).toBe('false');
  });
});

describe('beats and dots', () => {
  it('has a dot for every beat of the bar', () => {
    expect(qa('.metro-dot')).toHaveLength(4);
    q<HTMLButtonElement>('[data-beats="6"]').click();
    expect(store.state.beatsPerBar).toBe(6);
    expect(qa('.metro-dot')).toHaveLength(6);
    expect(q('[data-beats="6"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-beats="4"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('lights the dot of the beat that sounds', () => {
    action('toggle').click();
    clock!.callback(0);
    clock!.callback(0.5);
    const lit = qa<HTMLElement>('.metro-dot').map((d) => d.dataset.on === 'true');
    expect(lit).toEqual([false, true, false, false]);
  });

  it('marks the first dot as the accent', () => {
    expect(qa<HTMLElement>('.metro-dot')[0].classList.contains('accent')).toBe(true);
    q<HTMLInputElement>('[data-option="accent"]').click();
    expect(store.state.accent).toBe(false);
    expect(qa<HTMLElement>('.metro-dot')[0].classList.contains('accent')).toBe(false);
  });

  it('follows the beat of an exercise with its own bar length', () => {
    panel.pulse(1, 3);
    expect(qa('.metro-dot')).toHaveLength(3);
    expect(qa<HTMLElement>('.metro-dot')[1].dataset.on).toBe('true');
  });
});

describe('volume', () => {
  it('follows the slider', () => {
    const volume = q<HTMLInputElement>('.metro-volume');
    volume.value = '80';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    expect(store.state.volume).toBe(80);
  });
});

describe('while an exercise is playing', () => {
  it('stops the stand-alone metronome and hands the control to the exercise', () => {
    action('toggle').click();
    panel.setExerciseRunning(true);
    expect(engine.isRunning()).toBe(false);
    expect(panel.element.dataset.following).toBe('true');
    expect(q('.metro-status').textContent).toBe('Following the exercise');
    for (const sel of ['[data-action="toggle"]', '[data-action="slower"]', '[data-action="faster"]', '[data-action="tap"]', '.metro-slider']) {
      expect((q(sel) as HTMLButtonElement | HTMLInputElement).disabled, sel).toBe(true);
    }
  });

  it('gives the controls back afterwards', () => {
    panel.setExerciseRunning(true);
    panel.setExerciseRunning(false);
    expect(panel.element.dataset.following).toBe('false');
    expect(q<HTMLButtonElement>('[data-action="toggle"]').disabled).toBe(false);
    expect(q('.metro-status').textContent).toBe('');
  });

  it('refuses to start while an exercise plays', () => {
    panel.setExerciseRunning(true);
    action('toggle').click();
    expect(engine.isRunning()).toBe(false);
  });
});

describe('language', () => {
  it('writes the texts again in Persian', () => {
    setLocale('fa');
    panel.refresh();
    expect(q('.metro-title').textContent).toBe('مترونوم');
    expect(action('toggle').textContent).toBe('شروع');
  });
});

describe('cleanup', () => {
  it('stops following the store and the engine after dispose', () => {
    const fn = vi.fn();
    panel.dispose();
    store.setBpm(150);
    expect(q('.metro-bpm').textContent).toBe('100');
    fn();
  });
});
