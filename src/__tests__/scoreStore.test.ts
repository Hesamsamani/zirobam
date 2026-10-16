import { describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ScoreStore, type NewScore } from '../scores/scoreStore';

const XML = '<score-partwise></score-partwise>';

function score(over: Partial<NewScore> = {}): NewScore {
  return { id: 'pop-queen-bohemian-rhapsody', title: 'Bohemian Rhapsody', artist: 'Queen', kind: 'xml', data: XML, ...over };
}

async function open(factory: IDBFactory | null = new IDBFactory(), maxBytes?: number) {
  const store = new ScoreStore(factory, { maxBytes });
  await store.ready();
  return { store, factory };
}

describe('ScoreStore', () => {
  it('starts empty', async () => {
    const { store } = await open();
    expect(await store.list()).toEqual([]);
    expect(store.has('x')).toBe(false);
    expect(store.count()).toBe(0);
  });

  it('keeps a MusicXML score and gives it back', async () => {
    const { store } = await open();
    expect(await store.put(score())).toEqual({ ok: true });
    const back = await store.get('pop-queen-bohemian-rhapsody');
    expect(back).toMatchObject({ title: 'Bohemian Rhapsody', artist: 'Queen', kind: 'xml', data: XML, size: XML.length });
    expect(back!.addedAt).toBeGreaterThan(0);
    expect(store.has('pop-queen-bohemian-rhapsody')).toBe(true);
  });

  it('keeps the bytes of a MIDI file', async () => {
    const { store } = await open();
    const bytes = new Uint8Array([77, 84, 104, 100, 0, 0, 0, 6, 0, 1, 255, 0]).buffer;
    await store.put(score({ id: 'file-1', kind: 'midi', data: bytes }));
    const back = await store.get('file-1');
    expect(back!.kind).toBe('midi');
    expect(back!.size).toBe(12);
    expect(Array.from(new Uint8Array(back!.data as ArrayBuffer))).toEqual(Array.from(new Uint8Array(bytes)));
  });

  it('replaces a score with the same id', async () => {
    const { store } = await open();
    await store.put(score({ data: '<a/>' }));
    await store.put(score({ data: '<b/>', title: 'New title' }));
    expect(store.count()).toBe(1);
    expect((await store.get('pop-queen-bohemian-rhapsody'))!.data).toBe('<b/>');
    expect((await store.list())[0].title).toBe('New title');
  });

  it('lists the scores without their data, newest first', async () => {
    const { store } = await open();
    await store.put(score({ id: 'a', title: 'A' }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.put(score({ id: 'b', title: 'B' }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(['b', 'a']);
    expect('data' in list[0]).toBe(false);
  });

  it('forgets a score that is removed', async () => {
    const { store } = await open();
    await store.put(score());
    await store.remove('pop-queen-bohemian-rhapsody');
    expect(store.has('pop-queen-bohemian-rhapsody')).toBe(false);
    expect(await store.get('pop-queen-bohemian-rhapsody')).toBeNull();
    await expect(store.remove('never-there')).resolves.toBeUndefined();
  });

  it('is still there after a restart', async () => {
    const { store, factory } = await open();
    await store.put(score());
    const again = new ScoreStore(factory);
    await again.ready();
    expect(again.has('pop-queen-bohemian-rhapsody')).toBe(true);
    expect((await again.get('pop-queen-bohemian-rhapsody'))!.data).toBe(XML);
  });

  it('refuses a score that would go over the limit, and says why', async () => {
    const { store } = await open(new IDBFactory(), 100);
    expect(await store.put(score({ id: 'a', data: 'x'.repeat(60) }))).toEqual({ ok: true });
    expect(await store.put(score({ id: 'b', data: 'x'.repeat(60) }))).toEqual({ ok: false, reason: 'full' });
    expect(store.has('b')).toBe(false);
    // replacing a score only counts the difference
    expect(await store.put(score({ id: 'a', data: 'x'.repeat(90) }))).toEqual({ ok: true });
    expect(store.totalSize()).toBe(90);
  });

  it('refuses an empty id or empty data', async () => {
    const { store } = await open();
    expect(await store.put(score({ id: '' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(await store.put(score({ data: '' }))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('tells the listeners when something changed', async () => {
    const { store } = await open();
    const listener = vi.fn();
    const off = store.onChange(listener);
    await store.put(score());
    await store.remove('pop-queen-bohemian-rhapsody');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    await store.put(score());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps scores in memory when there is no IndexedDB', async () => {
    const { store } = await open(null);
    expect(store.persistent()).toBe(false);
    expect(await store.put(score())).toEqual({ ok: true });
    expect((await store.get('pop-queen-bohemian-rhapsody'))!.data).toBe(XML);
    expect(store.has('pop-queen-bohemian-rhapsody')).toBe(true);
  });

  it('keeps scores in memory when the database cannot be opened', async () => {
    const broken = {
      open() {
        throw new Error('blocked');
      },
    } as unknown as IDBFactory;
    const { store } = await open(broken);
    expect(store.persistent()).toBe(false);
    expect(await store.put(score())).toEqual({ ok: true });
  });

  it('says it is persistent when IndexedDB works', async () => {
    const { store } = await open();
    expect(store.persistent()).toBe(true);
  });
});
