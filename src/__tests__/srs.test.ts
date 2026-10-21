import { describe, it, expect } from 'vitest';
import { INTERVAL_DAYS, MAX_ITEMS, MAX_KEY_CHARS, SrsStore } from '../stats/srs';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function setup(day = '2026-10-21', initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial);
  const clock = { day };
  const make = () => new SrsStore(storage, () => clock.day);
  return { storage, clock, store: make(), make };
}

describe('the boxes', () => {
  it('wait 1, 2, 4, 7 and 14 days', () => {
    expect([...INTERVAL_DAYS]).toEqual([1, 2, 4, 7, 14]);
  });
});

describe('SrsStore.review', () => {
  it('puts a new item that was answered right in box 2, to come back in two days', () => {
    const { store } = setup();
    expect(store.review('note:C4', true)).toEqual({ box: 2, due: '2026-10-23', seen: 1, wrong: 0 });
  });

  it('puts a new item that was answered wrong in box 1, to come back tomorrow', () => {
    const { store } = setup();
    expect(store.review('note:C4', false)).toEqual({ box: 1, due: '2026-10-22', seen: 1, wrong: 1 });
  });

  it('moves an item up a box for each right answer, until the last box', () => {
    const { store } = setup();
    const steps = [true, true, true, true, true, true].map((ok) => store.review('note:C4', ok));
    expect(steps.map((s) => s.box)).toEqual([2, 3, 4, 5, 5, 5]);
    expect(steps.map((s) => s.due)).toEqual(['2026-10-23', '2026-10-25', '2026-10-28', '2026-11-04', '2026-11-04', '2026-11-04']);
    expect(steps.at(-1)).toMatchObject({ seen: 6, wrong: 0 });
  });

  it('sends an item back to box 1 for a wrong answer, however far it had come', () => {
    const { store } = setup();
    for (let i = 0; i < 4; i++) store.review('note:C4', true); // box 5
    expect(store.review('note:C4', false)).toEqual({ box: 1, due: '2026-10-22', seen: 5, wrong: 1 });
  });

  it('counts from the day of the answer', () => {
    const { store, clock } = setup('2026-10-21');
    clock.day = '2026-12-30';
    expect(store.review('note:C4', true).due).toBe('2027-01-01');
  });

  it('keeps one item apart from another', () => {
    const { store } = setup();
    store.review('note:C4', true);
    store.review('note:D4', false);
    expect(store.get('note:C4')?.box).toBe(2);
    expect(store.get('note:D4')?.box).toBe(1);
    expect(store.get('note:E4')).toBeUndefined();
    expect(store.size()).toBe(2);
  });

  it('ignores a name that is empty or too long to be an item', () => {
    const { store } = setup();
    store.review('', true);
    store.review('x'.repeat(MAX_KEY_CHARS + 1), true);
    expect(store.size()).toBe(0);
  });
});

describe('SrsStore.due', () => {
  it('lists what is due on the day or before, and nothing that is not', () => {
    const { store, clock } = setup('2026-10-21');
    store.review('a', false); // due 10-22
    store.review('b', true); // due 10-23
    expect(store.due('2026-10-21')).toEqual([]);
    expect(store.due('2026-10-22')).toEqual(['a']);
    expect(store.due('2026-10-23')).toEqual(['a', 'b']);
    clock.day = '2026-10-23';
    expect(store.due()).toEqual(['a', 'b']); // today, when no day is given
  });

  it('puts the items that are known least well first, then the ones that have waited longest', () => {
    const { store, clock } = setup('2026-10-01');
    store.review('known', true);
    store.review('known', true);
    store.review('known', true); // box 4
    store.review('shaky-old', false); // box 1, due 10-02
    clock.day = '2026-10-03';
    store.review('shaky-new', false); // box 1, due 10-04
    store.review('middling', true); // box 2, due 10-05
    expect(store.due('2026-12-31')).toEqual(['shaky-old', 'shaky-new', 'middling', 'known']);
  });

  it('breaks a tie by the name, so the order never changes between two looks', () => {
    const { store } = setup();
    store.review('b', false);
    store.review('a', false);
    store.review('c', false);
    expect(store.due('2026-10-22')).toEqual(['a', 'b', 'c']);
  });
});

describe('SrsStore storage', () => {
  it('is kept: a new store on the same storage remembers the items', () => {
    const { store, make } = setup();
    store.review('note:C4', true);
    store.review('note:D4', false);
    const again = make();
    expect(again.get('note:C4')).toEqual({ box: 2, due: '2026-10-23', seen: 1, wrong: 0 });
    expect(again.due('2026-10-22')).toEqual(['note:D4']);
  });

  describe('when what is stored cannot be trusted', () => {
    const stored = (value: unknown) => ({ 'srs.v1': typeof value === 'string' ? value : JSON.stringify(value) });

    it.each([
      ['text that is not JSON', 'nope'],
      ['null', null],
      ['a list', []],
      ['another version', { version: 3, items: {} }],
      ['items that are not an object', { version: 1, items: 4 }],
    ])('starts empty for %s', (_name, value) => {
      const { store } = setup('2026-10-21', stored(value));
      expect(store.size()).toBe(0);
    });

    it('drops an item that cannot be right and keeps the others', () => {
      const { store } = setup(
        '2026-10-21',
        stored({
          version: 1,
          items: {
            good: [3, '2026-10-25', 4, 1],
            'box-zero': [0, '2026-10-25', 1, 0],
            'box-six': [6, '2026-10-25', 1, 0],
            'box-text': ['2', '2026-10-25', 1, 0],
            'bad-day': [2, '2026-02-30', 1, 0],
            'no-day': [2, 7, 1, 0],
            'negative': [2, '2026-10-25', -1, 0],
            'more-wrong-than-seen': [2, '2026-10-25', 1, 2],
            'short': [2, '2026-10-25'],
            'object': { box: 2 },
          },
        }),
      );
      expect(store.size()).toBe(1);
      expect(store.get('good')).toEqual({ box: 3, due: '2026-10-25', seen: 4, wrong: 1 });
    });

    it('can still write after reading rubbish', () => {
      const { store, storage } = setup('2026-10-21', stored('nope'));
      store.review('note:C4', true);
      expect(JSON.parse(storage.data.get('srs.v1')!).version).toBe(1);
    });
  });

  it('does not throw when the browser refuses to read or write', () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const store = new SrsStore(refusing, () => '2026-10-21');
    expect(() => store.review('note:C4', true)).not.toThrow();
    expect(store.get('note:C4')?.box).toBe(2); // still remembered while the page is open
  });
});

describe('SrsStore size', () => {
  /** A store already full to the limit, written the way the store writes it. */
  function full(rows: (index: number) => [number, string, number, number], count = MAX_ITEMS) {
    const items = Object.fromEntries(Array.from({ length: count }, (_, i) => [`item${i}`, rows(i)]));
    return setup('2026-10-21', { 'srs.v1': JSON.stringify({ version: 1, items }) });
  }

  it('keeps no more items than the limit, and lets go of the one known best first', () => {
    // item0 is in box 5, the rest in box 2, and the last one is in box 1
    const { store } = full((i) => (i === 0 ? [5, '2026-11-04', 9, 0] : i === MAX_ITEMS - 1 ? [1, '2026-10-22', 2, 1] : [2, '2026-10-23', 2, 0]));
    expect(store.size()).toBe(MAX_ITEMS);
    store.review('fresh', true);
    expect(store.size()).toBe(MAX_ITEMS);
    expect(store.get('item0')).toBeUndefined();
    expect(store.get(`item${MAX_ITEMS - 1}`)).toBeDefined(); // the weak one stays
    expect(store.get('fresh')).toBeDefined();
  });

  it('never drops the item that was just answered', () => {
    const { store } = full(() => [1, '2026-10-22', 1, 1]); // all box 1
    store.review('latest', true); // box 2 is better known than every one of them: it would be the first to go
    expect(store.size()).toBe(MAX_ITEMS);
    expect(store.get('latest')).toBeDefined();
  });

  it('does not grow when an item it has is answered again', () => {
    const { store } = full(() => [2, '2026-10-23', 1, 0]);
    store.review('item5', true);
    expect(store.size()).toBe(MAX_ITEMS);
    expect(store.get('item5')?.box).toBe(3);
  });
});
