import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  applyBackup,
  BACKUP_APP,
  backupFileName,
  backupToText,
  checkBackup,
  createBackup,
  isBackupKey,
  MAX_BACKUP_BYTES,
  type BackupFile,
  type KeyValueStorage,
} from '../backup/backup';
import { ScoreStore } from '../scores/scoreStore';

class FakeStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.map.set(key, value);
  }
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  all() {
    return Object.fromEntries(this.map);
  }
}

const XML = '<score-partwise><part id="P1"/></score-partwise>';
const MIDI = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 1, 0xe0, 255, 128, 0, 1]).buffer;

async function storeWith(...scores: Array<Parameters<ScoreStore['put']>[0]>) {
  const store = new ScoreStore(new IDBFactory());
  await store.ready();
  for (const score of scores) await store.put(score);
  return store;
}

const goodBackup = (over: Partial<BackupFile> = {}): BackupFile => ({
  app: BACKUP_APP,
  version: 1,
  exportedAt: '2026-10-16T10:00:00.000Z',
  storage: { 'game.v1': '{"xp":120}' },
  scores: [],
  ...over,
});

describe('which keys are backed up', () => {
  it('takes the progress and the settings of the app', () => {
    for (const key of ['game.v1', 'lessons.read.v1', 'noteStats.v1', 'xyloStats.v1', 'sightreading-progress', 'practiceState', 'ui.locale', 'ui.noteNames', 'ui.aidsOpen', 'xylo.row', 'metronome.v1', 'learn.stage', 'practice.options.v1', 'earStats.v1', 'ear.stage', 'scales.v1']) {
      expect(isBackupKey(key), key).toBe(true);
    }
  });

  it('leaves out everything else', () => {
    for (const key of ['midiDeviceId', 'practiceMusic', 'someOtherSite', '__proto__', 'ui', '']) {
      expect(isBackupKey(key), key).toBe(false);
    }
  });
});

describe('createBackup', () => {
  it('gathers the keys and every score, MIDI as base64', async () => {
    const storage = new FakeStorage({ 'game.v1': '{"xp":5}', 'ui.locale': 'fa', midiDeviceId: 'abc', unrelated: 'x' });
    const store = await storeWith(
      { id: 'maker-1', title: 'My tune', kind: 'maker', data: XML },
      { id: 'file-aa', title: 'Midi tune', artist: 'Me', kind: 'midi', data: MIDI },
    );
    const backup = await createBackup(storage, store, new Date('2026-10-16T10:00:00Z'));
    expect(backup.app).toBe(BACKUP_APP);
    expect(backup.exportedAt).toBe('2026-10-16T10:00:00.000Z');
    expect(backup.storage).toEqual({ 'game.v1': '{"xp":5}', 'ui.locale': 'fa' });
    expect(backup.scores).toHaveLength(2);
    const midi = backup.scores.find((s) => s.id === 'file-aa')!;
    expect(midi).toMatchObject({ title: 'Midi tune', artist: 'Me', kind: 'midi' });
    expect(midi.content.encoding).toBe('base64');
    expect(backup.scores.find((s) => s.id === 'maker-1')!.content).toEqual({ encoding: 'text', data: XML });
  });

  it('works with nothing to save', async () => {
    const backup = await createBackup(new FakeStorage(), await storeWith());
    expect(backup.storage).toEqual({});
    expect(backup.scores).toEqual([]);
  });

  it('names the file after the day', () => {
    expect(backupFileName(new Date('2026-10-16T22:00:00Z'))).toBe('music-notes-trainer-backup-2026-10-16.json');
  });
});

describe('the round trip', () => {
  it('gives back the same progress, settings and scores', async () => {
    const source = new FakeStorage({ 'game.v1': '{"xp":5}', 'ui.locale': 'fa', 'xylo.row': 'home' });
    const sourceStore = await storeWith(
      { id: 'maker-1', title: 'My tune', kind: 'maker', data: XML },
      { id: 'file-aa', title: 'Midi tune', kind: 'midi', data: MIDI },
    );
    const text = backupToText(await createBackup(source, sourceStore));

    const checked = checkBackup(text);
    if (!checked.ok) throw new Error(checked.reason);
    expect(checked.summary).toMatchObject({ settings: 3, scores: 2 });

    const target = new FakeStorage({ 'game.v1': '{"xp":999}', unrelated: 'keep' });
    const targetStore = await storeWith();
    const result = await applyBackup(checked.backup, target, targetStore);
    expect(result).toEqual({ settings: 3, scores: 2, skipped: 0 });
    expect(target.all()).toEqual({ 'game.v1': '{"xp":5}', unrelated: 'keep', 'ui.locale': 'fa', 'xylo.row': 'home' });
    expect((await targetStore.get('maker-1'))!.data).toBe(XML);
    const midi = (await targetStore.get('file-aa'))!;
    expect(new Uint8Array(midi.data as ArrayBuffer)).toEqual(new Uint8Array(MIDI));
  });

  it('adds the scores to the ones already there, and replaces a score with the same id', async () => {
    const targetStore = await storeWith(
      { id: 'maker-1', title: 'Old name', kind: 'maker', data: '<old/>' },
      { id: 'maker-keep', title: 'Stays', kind: 'maker', data: '<keep/>' },
    );
    const text = backupToText(goodBackup({ scores: [{ id: 'maker-1', title: 'New name', kind: 'maker', addedAt: 5, content: { encoding: 'text', data: XML } }] }));
    const checked = checkBackup(text);
    if (!checked.ok) throw new Error(checked.reason);
    await applyBackup(checked.backup, new FakeStorage(), targetStore);
    expect((await targetStore.list()).map((s) => s.id).sort()).toEqual(['maker-1', 'maker-keep']);
    expect((await targetStore.get('maker-1'))!.title).toBe('New name');
  });

  it('keeps the order of the scores', async () => {
    const text = backupToText(
      goodBackup({
        scores: [
          { id: 'a', title: 'First', kind: 'maker', addedAt: 100, content: { encoding: 'text', data: XML } },
          { id: 'b', title: 'Second', kind: 'maker', addedAt: 200, content: { encoding: 'text', data: XML } },
        ],
      }),
    );
    const checked = checkBackup(text);
    if (!checked.ok) throw new Error(checked.reason);
    const store = await storeWith();
    await applyBackup(checked.backup, new FakeStorage(), store);
    expect((await store.list()).map((s) => s.title)).toEqual(['Second', 'First']);
  });

  it('counts the scores that do not fit instead of failing', async () => {
    const store = new ScoreStore(new IDBFactory(), { maxBytes: 100 });
    await store.ready();
    const text = backupToText(goodBackup({ scores: [{ id: 'big', title: 'Big', kind: 'maker', addedAt: 1, content: { encoding: 'text', data: 'x'.repeat(500) } }] }));
    const checked = checkBackup(text);
    if (!checked.ok) throw new Error(checked.reason);
    expect(await applyBackup(checked.backup, new FakeStorage(), store)).toEqual({ settings: 1, scores: 0, skipped: 1 });
  });

  it('keeps going when the browser storage refuses a key', async () => {
    const storage = new FakeStorage();
    storage.setItem = (key: string) => {
      if (key === 'game.v1') throw new Error('quota');
    };
    const result = await applyBackup(goodBackup({ storage: { 'game.v1': 'x', 'ui.locale': 'fa' } }), storage, await storeWith());
    expect(result.settings).toBe(1);
  });
});

describe('checkBackup refuses what it should', () => {
  it('a file that is not JSON, or not a backup', () => {
    expect(checkBackup('not json')).toEqual({ ok: false, reason: 'notJson' });
    expect(checkBackup('[]')).toEqual({ ok: false, reason: 'notBackup' });
    expect(checkBackup('{"app":"other","version":1}')).toEqual({ ok: false, reason: 'notBackup' });
    expect(checkBackup('{"version":1}')).toEqual({ ok: false, reason: 'notBackup' });
  });

  it('a backup from a newer version of the app', () => {
    expect(checkBackup(JSON.stringify({ ...goodBackup(), version: 2 }))).toEqual({ ok: false, reason: 'newer' });
  });

  it('a backup that is missing its parts', () => {
    expect(checkBackup(JSON.stringify({ app: BACKUP_APP, version: 1 }))).toEqual({ ok: false, reason: 'damaged' });
    expect(checkBackup(JSON.stringify({ ...goodBackup(), scores: 'x' }))).toEqual({ ok: false, reason: 'damaged' });
    expect(checkBackup(JSON.stringify({ ...goodBackup(), version: 0 }))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('a file that is far too big', () => {
    expect(checkBackup('x'.repeat(MAX_BACKUP_BYTES + 1))).toEqual({ ok: false, reason: 'tooBig' });
  });
});

describe('checkBackup drops what it does not trust', () => {
  const check = (parts: Partial<Record<keyof BackupFile, unknown>>) => {
    const result = checkBackup(JSON.stringify({ ...goodBackup(), ...parts }));
    if (!result.ok) throw new Error(result.reason);
    return result.backup;
  };

  it('keys that are not the app\'s, and values that are not text', () => {
    const backup = check({ storage: { 'game.v1': 'ok', evil: 'x', '__proto__': 'x', 'ui.locale': 5, 'xylo.row': null, 'metronome.v1': { a: 1 } } });
    expect(backup.storage).toEqual({ 'game.v1': 'ok' });
  });

  it('values that are far too long', () => {
    const backup = check({ storage: { 'game.v1': 'x'.repeat(3 * 1024 * 1024), 'ui.locale': 'fa' } });
    expect(backup.storage).toEqual({ 'ui.locale': 'fa' });
  });

  it('scores with a strange id, kind or content', () => {
    const ok = { id: 'ok-1', title: 'Fine', kind: 'maker', addedAt: 1, content: { encoding: 'text', data: XML } };
    const backup = check({
      scores: [
        ok,
        { ...ok, id: '../../x' },
        { ...ok, id: 'has space' },
        { ...ok, id: '' },
        { ...ok, id: 'long' + 'x'.repeat(200) },
        { ...ok, id: 'bad-kind', kind: 'exe' },
        { ...ok, id: 'no-title', title: '' },
        { ...ok, id: 'number-title', title: 7 },
        { ...ok, id: 'no-content', content: null },
        { ...ok, id: 'bad-encoding', content: { encoding: 'hex', data: 'ab' } },
        { ...ok, id: 'text-midi', kind: 'midi', content: { encoding: 'text', data: XML } },
        { ...ok, id: 'base64-xml', kind: 'xml', content: { encoding: 'base64', data: 'AAAA' } },
        { ...ok, id: 'not-base64', kind: 'midi', content: { encoding: 'base64', data: '<script>' } },
        'a string',
        null,
        42,
      ],
    });
    expect(backup.scores.map((s) => s.id)).toEqual(['ok-1']);
  });

  it('a second score with the same id', () => {
    const entry = (title: string) => ({ id: 'same', title, kind: 'maker', addedAt: 1, content: { encoding: 'text', data: XML } });
    expect(check({ scores: [entry('First'), entry('Second')] }).scores.map((s) => s.title)).toEqual(['First']);
  });

  it('more scores than anyone would have', () => {
    const many = Array.from({ length: 600 }, (_, i) => ({ id: `m-${i}`, title: 't', kind: 'maker', addedAt: i, content: { encoding: 'text', data: XML } }));
    expect(check({ scores: many }).scores).toHaveLength(500);
  });

  it('a date that is not a date', () => {
    expect(check({ exportedAt: 'yesterday-ish' }).exportedAt).toBe('');
    expect(check({ exportedAt: '2026-10-16T10:00:00.000Z' }).exportedAt).toBe('2026-10-16T10:00:00.000Z');
  });

  it('writes nothing extra when it is applied', async () => {
    const backup = check({ storage: { 'game.v1': 'ok', evil: 'x' } });
    const target = new FakeStorage();
    await applyBackup(backup, target, await storeWith());
    expect(target.all()).toEqual({ 'game.v1': 'ok' });
  });
});
