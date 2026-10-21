import { beforeEach, describe, expect, it } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { HeatmapView } from '../stats/heatmapView';
import { MistakeLog } from '../stats/mistakeLog';

const TODAY = '2026-10-21';

function setup() {
  const data = new Map<string, string>();
  const log = new MistakeLog({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, () => TODAY);
  const view = new HeatmapView({ log, formatName: (n) => n.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'), today: () => TODAY });
  document.body.replaceChildren(view.element);
  return { log, view };
}

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends Element>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const ask = (log: MistakeLog, note: string, times: number, missed: number) => {
  for (let i = 0; i < times; i++) log.recordNote(note, i < missed);
};

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
  document.body.replaceChildren();
});

describe('the heat map', () => {
  it('says there is nothing to show before anything was played', () => {
    setup();
    expect($('.hm-title').textContent).toBe('Where you slip');
    expect($('.hm-empty').textContent).toMatch(/^Nothing to show yet/);
    expect(document.querySelector('.hm-keys')).toBeNull();
  });

  it('colours the keys that are missed, darker the more, and leaves the others alone', () => {
    const { log, view } = setup();
    ask(log, 'G4', 10, 8);
    ask(log, 'C4', 10, 1);
    ask(log, 'D4', 10, 0);
    view.refresh();
    expect(all('.hm-keys .lk-key.lk-heat').map((k) => `${(k as HTMLElement).dataset.note}:${(k as HTMLElement).dataset.heat}`)).toEqual(['C4:1', 'G4:5']);
    expect($('.hm-keys .lk-key[data-note="G4"]').classList.contains('heat-5')).toBe(true);
    expect($('.hm-keys').getAttribute('dir') ?? $('.hm-keys .lk').getAttribute('dir')).toBe('ltr');
  });

  it('puts a flat on the key of its sharp: B flat is the A sharp key', () => {
    const { log, view } = setup();
    ask(log, 'Bb3', 4, 4);
    view.refresh();
    expect($('.hm-keys .lk-key[data-note="A#3"]').getAttribute('data-heat')).toBe('5');
  });

  it('writes the notes missed most with their numbers, worst first, in the names the student reads', () => {
    const { log, view } = setup();
    ask(log, 'Bb3', 8, 5);
    ask(log, 'E4', 4, 1);
    ask(log, 'G4', 10, 8);
    view.refresh();
    const items = all('.hm-slip').map((li) => li.textContent);
    expect(items).toEqual(['G4: missed 8 of 10 (80%)', 'B♭3: missed 5 of 8 (63%)', 'E4: missed 1 of 4 (25%)']);
  });

  it('lists the chords too, when there are some', () => {
    const { log, view } = setup();
    ask(log, 'C4', 5, 1);
    for (let i = 0; i < 5; i++) log.recordChord('Cmaj7', i < 3);
    view.refresh();
    const lists = all('.hm-list');
    expect(lists).toHaveLength(2);
    expect(lists[1].querySelector('.hm-sub')!.textContent).toBe('Chords you miss most');
    expect(lists[1].querySelector('.hm-slip')!.textContent).toBe('Cmaj7: missed 3 of 5 (60%)');
  });

  it('says so when no note is missed often', () => {
    const { log, view } = setup();
    ask(log, 'C4', 10, 0);
    view.refresh();
    expect($('.hm-list .hm-line').textContent).toBe('No note is missed often.');
  });

  it('shows how the rhythm taps went, and which way they lean', () => {
    const { log, view } = setup();
    for (let i = 0; i < 10; i++) log.recordRhythm('hit');
    for (let i = 0; i < 6; i++) log.recordRhythm('late');
    log.recordRhythm('early');
    log.recordRhythm('missed');
    view.refresh();
    expect($('.hm-rhythm').children).toHaveLength(4);
    expect($('.hm-rhythm .hm-late').getAttribute('style')).toContain('flex-grow: 6');
    expect(all('.hm-line').at(-1)!.textContent).toBe('On time 10, early 1, late 6, not played 1. You tend to tap late.');
  });

  it('draws the share right, week by week, as a line with a point for each week that has data', () => {
    const { log, view } = setup();
    ask(log, 'C4', 10, 2);
    view.refresh();
    expect($('.hm-chart')).not.toBeNull();
    expect(all('.hm-dot')).toHaveLength(1);
    expect($('.hm-chart').getAttribute('aria-label')).toMatch(/^Share of answers that were right in each of the last eight weeks: .*80%/);
  });

  it('is in Persian, with Persian digits', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { log, view } = setup();
    ask(log, 'G4', 10, 8);
    view.refresh();
    expect($('.hm-title').textContent).toBe('کجا اشتباه می‌کنید');
    expect($('.hm-slip').textContent).toContain('۸ اشتباه از ۱۰');
  });
});
