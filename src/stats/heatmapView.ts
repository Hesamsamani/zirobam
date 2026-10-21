import { formatNumber, t } from '../i18n';
import { buildKeysPicture } from '../lessons/keysPicture';
import { addDays, dayString } from './days';
import { isEmpty, noteHeat, rhythmSummary, trendPoints, worstItems, type Slip } from './heatmap';
import type { MistakeLog } from './mistakeLog';

export interface HeatmapDeps {
  log: MistakeLog;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** The same with the octave kept (`G4`), for the list of notes missed; the plain name without this. */
  formatNameWithOctave?(note: string): string;
  /** Today as a day key; the date of the machine without this. */
  today?: () => string;
}

/** The weeks shown, and so the days. */
const WEEKS = 8;
const SVG = 'http://www.w3.org/2000/svg';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const percent = (share: number): string => `${formatNumber(Math.round(share * 100))}%`;

/**
 * Where the student slips, from the mistake log: a keyboard whose keys are darker the more they are missed, the notes
 * and chords missed most, how the rhythm taps lean, and the share of answers that were right, week by week. Colour is
 * never the only signal: every number is also written.
 */
export class HeatmapView {
  readonly element: HTMLElement;
  private readonly deps: HeatmapDeps;

  constructor(deps: HeatmapDeps) {
    this.deps = deps;
    this.element = make('section', 'heatmap');
    this.element.setAttribute('aria-labelledby', 'heatmapTitle');
    this.refresh();
  }

  refresh(): void {
    const today = (this.deps.today ?? (() => dayString(new Date())))();
    const aggregate = this.deps.log.aggregate(addDays(today, -(WEEKS * 7 - 1)), today);

    const title = make('h3', 'hm-title');
    title.id = 'heatmapTitle';
    title.textContent = t('heat.title');
    const period = make('p', 'hm-period');
    period.textContent = t('heat.period');
    const parts: HTMLElement[] = [title, period];

    if (isEmpty(aggregate)) {
      const empty = make('p', 'hm-empty');
      empty.textContent = t('heat.empty');
      this.element.replaceChildren(...parts, empty);
      return;
    }

    // the keyboard
    const keysTitle = make('h4', 'hm-sub');
    keysTitle.textContent = t('heat.keys');
    const keys = make('div', 'hm-keys');
    keys.append(
      buildKeysPicture({
        from: 'C3',
        to: 'C6',
        names: 'white',
        heat: noteHeat(aggregate.notes),
        formatName: (note) => this.deps.formatName(note),
        formatMark: (text) => text,
        ariaLabel: t('heat.keys.aria'),
      }),
    );
    parts.push(keysTitle, keys);

    // the notes and the chords missed most
    const notes = worstItems(aggregate.notes);
    parts.push(this.list(t('heat.notes'), notes, true));
    const chords = worstItems(aggregate.chords);
    if (chords.length > 0) parts.push(this.list(t('heat.chords'), chords, false));

    // the rhythm
    const rhythm = rhythmSummary(aggregate.rhythm);
    if (rhythm.total > 0) {
      const rhythmTitle = make('h4', 'hm-sub');
      rhythmTitle.textContent = t('heat.rhythm');
      const bar = make('div', 'hm-rhythm');
      bar.setAttribute('aria-hidden', 'true');
      for (const [field, kind] of [['hits', 'hit'], ['early', 'early'], ['late', 'late'], ['missed', 'missed']] as const) {
        const segment = make('span', `hm-seg hm-${kind}`);
        segment.style.flexGrow = String(rhythm[field]);
        bar.append(segment);
      }
      const line = make('p', 'hm-line');
      line.textContent = [
        t('heat.rhythm.line', { hits: formatNumber(rhythm.hits), early: formatNumber(rhythm.early), late: formatNumber(rhythm.late), missed: formatNumber(rhythm.missed) }),
        rhythm.lean === 'early' ? t('heat.rhythm.early') : rhythm.lean === 'late' ? t('heat.rhythm.late') : '',
      ]
        .filter(Boolean)
        .join(' ');
      parts.push(rhythmTitle, bar, line);
    }

    // week by week
    const trend = trendPoints(this.deps.log.weeklyTrend(WEEKS, today));
    if (trend.some((point) => point !== null)) {
      const trendTitle = make('h4', 'hm-sub');
      trendTitle.textContent = t('heat.trend');
      parts.push(trendTitle, this.trendChart(trend));
    }
    this.element.replaceChildren(...parts);
  }

  private list(heading: string, slips: Slip[], isNote: boolean): HTMLElement {
    const box = make('div', 'hm-list');
    const title = make('h4', 'hm-sub');
    title.textContent = heading;
    box.append(title);
    if (slips.length === 0) {
      const none = make('p', 'hm-line');
      none.textContent = t('heat.none');
      box.append(none);
      return box;
    }
    const ul = make('ul', 'hm-slips');
    for (const slip of slips) {
      const li = make('li', 'hm-slip');
      li.dataset.name = slip.name;
      li.textContent = t('heat.slip', { name: isNote ? (this.deps.formatNameWithOctave ?? this.deps.formatName)(slip.name) : slip.name, missed: formatNumber(slip.missed), asked: formatNumber(slip.asked), percent: percent(slip.rate) });
      ul.append(li);
    }
    box.append(ul);
    return box;
  }

  /** The share right in each week as a line, with the numbers in the text for a screen reader. */
  private trendChart(points: Array<number | null>): HTMLElement {
    const width = 240;
    const height = 70;
    const box = make('div', 'hm-trend');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'hm-chart');
    svg.setAttribute('role', 'img');
    svg.setAttribute('dir', 'ltr');
    svg.setAttribute('aria-label', t('heat.trend.aria', { values: points.map((p) => (p === null ? t('heat.trend.noData') : percent(p))).join(', ') }));
    const x = (i: number): number => 10 + (i * (width - 20)) / (points.length - 1);
    const y = (p: number): number => 8 + (1 - p) * (height - 16);
    const known = points.map((p, i) => (p === null ? null : ([x(i), y(p)] as const)));
    const line = document.createElementNS(SVG, 'polyline');
    line.setAttribute('class', 'hm-line-path');
    line.setAttribute('points', known.filter((p): p is readonly [number, number] => p !== null).map(([px, py]) => `${px},${py}`).join(' '));
    svg.append(line);
    known.forEach((p, i) => {
      if (!p) return;
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('class', 'hm-dot');
      dot.setAttribute('cx', String(p[0]));
      dot.setAttribute('cy', String(p[1]));
      dot.setAttribute('r', '3');
      dot.dataset.week = String(i);
      svg.append(dot);
    });
    box.append(svg);
    return box;
  }
}
