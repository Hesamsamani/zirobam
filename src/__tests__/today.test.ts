import { describe, expect, it, vi } from 'vitest';
import { buildTodayPlan, totalMinutes, type PlanInput } from '../today/planner';
import { TodayStore } from '../today/todayStore';

const quietRhythm = { total: 0, hits: 0, early: 0, late: 0, missed: 0, lean: 'none' as const };
const input = (overrides: Partial<PlanInput> = {}): PlanInput => ({ dueKeys: [], rhythm: quietRhythm, dayIndex: 0, ...overrides });
const kinds = (plan: ReturnType<typeof buildTodayPlan>) => plan.map((b) => b.kind);

describe('buildTodayPlan', () => {
  it('always has reading and playing, and a block that changes with the day, for a student with nothing due', () => {
    expect(kinds(buildTodayPlan(input({ dayIndex: 0 })))).toEqual(['levels', 'scales']);
    expect(kinds(buildTodayPlan(input({ dayIndex: 1 })))).toEqual(['levels', 'ear']);
    expect(kinds(buildTodayPlan(input({ dayIndex: 2 })))).toEqual(['levels', 'chords']);
    expect(kinds(buildTodayPlan(input({ dayIndex: 3 })))).toEqual(['levels', 'scales']);
  });

  it('puts what is due again first: notes, then ear, then chords', () => {
    const plan = buildTodayPlan(input({ dueKeys: ['note:C4', 'note:Bb3', 'ear:interval:m3', 'chord:Cm7'] }));
    expect(kinds(plan).slice(0, 3)).toEqual(['notes', 'ear', 'chords']);
    expect(plan[0].reason).toEqual({ key: 'due', count: 2 });
    expect(plan[1].reason).toEqual({ key: 'due', count: 1 });
  });

  it('gives a block with more things due more minutes, to four at most', () => {
    expect(buildTodayPlan(input({ dueKeys: ['note:C4'] }))[0].minutes).toBe(2);
    expect(buildTodayPlan(input({ dueKeys: Array.from({ length: 12 }, (_, i) => `note:${i}`) }))[0].minutes).toBe(3);
    expect(buildTodayPlan(input({ dueKeys: Array.from({ length: 200 }, (_, i) => `note:${i}`) }))[0].minutes).toBe(4);
  });

  it('adds the rhythm when the taps lean or are often off the beat, and not for a few taps', () => {
    const late = { total: 20, hits: 10, early: 1, late: 8, missed: 1, lean: 'late' as const };
    const plan = buildTodayPlan(input({ rhythm: late }));
    expect(plan.find((b) => b.kind === 'rhythm')!.reason).toEqual({ key: 'leanLate' });
    expect(buildTodayPlan(input({ rhythm: { ...late, lean: 'early' } })).find((b) => b.kind === 'rhythm')!.reason.key).toBe('leanEarly');
    const messy = { total: 20, hits: 12, early: 3, late: 3, missed: 2, lean: 'none' as const };
    expect(buildTodayPlan(input({ rhythm: messy })).find((b) => b.kind === 'rhythm')!.reason.key).toBe('offBeat');
    expect(buildTodayPlan(input({ rhythm: { total: 5, hits: 1, early: 0, late: 4, missed: 0, lean: 'late' } })).some((b) => b.kind === 'rhythm')).toBe(false);
    expect(buildTodayPlan(input({ rhythm: { total: 20, hits: 19, early: 1, late: 0, missed: 0, lean: 'none' } })).some((b) => b.kind === 'rhythm')).toBe(false);
  });

  it('fits ten minutes: a block that does not fit is left out, and reading and playing never is', () => {
    const many = input({ dueKeys: [...Array.from({ length: 30 }, (_, i) => `note:${i}`), 'ear:a', 'chord:C'], rhythm: { total: 20, hits: 5, early: 0, late: 15, missed: 0, lean: 'late' } });
    const plan = buildTodayPlan(many);
    expect(plan.some((b) => b.kind === 'levels')).toBe(true);
    expect(totalMinutes(plan)).toBeLessThanOrEqual(10);
    expect(plan.length).toBeLessThanOrEqual(5);
    // a tiny budget keeps only the core
    expect(kinds(buildTodayPlan({ ...many, budgetMinutes: 3 }))).toEqual(['levels']);
  });

  it('never has more than five blocks, or the same block twice', () => {
    const plan = buildTodayPlan(input({ dueKeys: ['note:C4', 'ear:x', 'chord:C'], rhythm: { total: 30, hits: 10, early: 10, late: 5, missed: 5, lean: 'early' }, budgetMinutes: 60 }));
    expect(plan.length).toBeLessThanOrEqual(5);
    expect(new Set(plan.map((b) => b.id)).size).toBe(plan.length);
  });

  it('is the same for the same input', () => {
    const i = input({ dueKeys: ['note:C4', 'ear:a'], dayIndex: 7 });
    expect(buildTodayPlan(i)).toEqual(buildTodayPlan(i));
  });
});

function memory() {
  const data = new Map<string, string>();
  return { data, storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } };
}

describe('TodayStore', () => {
  const plan = () => buildTodayPlan(input({ dueKeys: ['note:C4'], dayIndex: 0 }));

  it('makes the plan the first time it is asked for, and keeps it for the day', () => {
    const { storage } = memory();
    const build = vi.fn(plan);
    const store = new TodayStore(build, storage, () => '2026-10-21');
    expect(store.plan().map((b) => b.kind)).toEqual(['notes', 'levels', 'scales']);
    store.plan();
    store.progress();
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('counts what is done, and says when the last block made the plan done', () => {
    const { storage } = memory();
    const store = new TodayStore(plan, storage, () => '2026-10-21');
    expect(store.progress()).toEqual({ done: 0, total: 3 });
    expect(store.setDone('notes', true)).toBe(false);
    expect(store.setDone('levels', true)).toBe(false);
    expect(store.isDone('levels')).toBe(true);
    expect(store.setDone('scales', true)).toBe(true);
    expect(store.progress()).toEqual({ done: 3, total: 3 });
    // the same block marked again is no new completion
    expect(store.setDone('scales', true)).toBe(false);
    // a block can be taken off again; putting it back is not paid for a second time
    expect(store.setDone('scales', false)).toBe(false);
    expect(store.progress().done).toBe(2);
    expect(store.setDone('scales', true)).toBe(false);
  });

  it('pays for a plan once a day, also across another plan and a new visit, and again the next day', () => {
    const { storage } = memory();
    const store = new TodayStore(plan, storage, () => '2026-10-21');
    for (const id of ['notes', 'levels']) store.setDone(id, true);
    expect(store.setDone('scales', true)).toBe(true);
    store.remake();
    for (const id of ['notes', 'levels']) store.setDone(id, true);
    expect(store.setDone('scales', true)).toBe(false);
    const later = new TodayStore(plan, storage, () => '2026-10-21');
    later.setDone('scales', false);
    expect(later.setDone('scales', true)).toBe(false);
    const nextDay = new TodayStore(plan, storage, () => '2026-10-22');
    for (const id of ['notes', 'levels']) nextDay.setDone(id, true);
    expect(nextDay.setDone('scales', true)).toBe(true);
  });

  it('ignores a block that is not in the plan', () => {
    const { storage } = memory();
    const store = new TodayStore(plan, storage, () => '2026-10-21');
    expect(store.setDone('nothing', true)).toBe(false);
    expect(store.progress().done).toBe(0);
  });

  it('keeps the plan and what was done between visits on the same day, and makes a new plan the next day', () => {
    const { storage } = memory();
    const first = new TodayStore(plan, storage, () => '2026-10-21');
    first.setDone('notes', true);
    const build = vi.fn(() => buildTodayPlan(input({ dayIndex: 1 })));
    const sameDay = new TodayStore(build, storage, () => '2026-10-21');
    expect(sameDay.isDone('notes')).toBe(true);
    expect(sameDay.plan().map((b) => b.kind)).toEqual(['notes', 'levels', 'scales']);
    expect(build).not.toHaveBeenCalled();
    const nextDay = new TodayStore(build, storage, () => '2026-10-22');
    expect(nextDay.plan().map((b) => b.kind)).toEqual(['levels', 'ear']);
    expect(nextDay.progress().done).toBe(0);
  });

  it('makes another plan when asked, and forgets what was done', () => {
    const { storage } = memory();
    let day = 0;
    const store = new TodayStore(() => buildTodayPlan(input({ dayIndex: day })), storage, () => '2026-10-21');
    store.setDone('levels', true);
    day = 1;
    store.remake();
    expect(store.plan().map((b) => b.kind)).toEqual(['levels', 'ear']);
    expect(store.progress().done).toBe(0);
  });

  it('starts again from a damaged save, and does not throw when the storage does', () => {
    const { storage, data } = memory();
    data.set('today.v1', '{"version":1,"day":"2026-10-21","plan":[{"nope":1}],"done":[]}');
    expect(new TodayStore(plan, storage, () => '2026-10-21').plan().map((b) => b.kind)).toEqual(['notes', 'levels', 'scales']);
    data.set('today.v1', 'not json');
    expect(new TodayStore(plan, storage, () => '2026-10-21').progress().total).toBe(3);
    const broken = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    expect(() => new TodayStore(plan, broken, () => '2026-10-21').plan()).not.toThrow();
  });
});
