import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadBytes, downloadTextFile } from '../backup/download';
import { browserStorage } from '../backup/backup';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('downloadTextFile', () => {
  it('clicks a download link with the file name, then cleans up', () => {
    vi.useFakeTimers();
    const create = vi.fn((_blob: Blob) => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: Array<{ name: string; href: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ name: this.download, href: this.href });
    });
    downloadTextFile('backup.json', '{"a":1}');
    expect(clicked).toEqual([{ name: 'backup.json', href: 'blob:fake' }]);
    const blob = create.mock.calls[0][0];
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBe(7);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });
});

describe('downloadBytes', () => {
  /** The bytes of a blob (jsdom's Blob is not the one Response knows, so read it the way a page does). */
  const bytesOf = (blob: Blob) =>
    new Promise<number[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });

  function capture(url = 'blob:bytes') {
    const create = vi.fn((_blob: Blob) => url);
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(`${this.download} ${this.href}`);
    });
    return { create, revoke, clicked };
  }

  it('saves the bytes under the file name, as a MIDI file unless told otherwise', async () => {
    const { create, clicked } = capture();
    downloadBytes('scale.mid', new Uint8Array([77, 84, 104, 100, 0, 255]));
    expect(clicked).toEqual(['scale.mid blob:bytes']);
    const blob = create.mock.calls[0][0];
    expect(blob.type).toBe('audio/midi');
    // the bytes arrive unchanged, including the ones that are not text
    expect(await bytesOf(blob)).toEqual([77, 84, 104, 100, 0, 255]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('lets go of the address after a while, like the text download', () => {
    vi.useFakeTimers();
    const { revoke } = capture();
    downloadBytes('scale.mid', new Uint8Array([1]));
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith('blob:bytes');
  });

  it('does not depend on the buffer the caller keeps', async () => {
    const { create } = capture('blob:copy');
    const bytes = new Uint8Array([1, 2, 3]);
    downloadBytes('a.bin', bytes, 'application/octet-stream');
    bytes.fill(9); // changed after the call
    expect(await bytesOf(create.mock.calls[0][0])).toEqual([1, 2, 3]);
    expect(create.mock.calls[0][0].type).toBe('application/octet-stream');
  });
});

describe('browserStorage', () => {
  it('reads and writes localStorage', () => {
    localStorage.clear();
    browserStorage.setItem('ui.locale', 'fa');
    expect(browserStorage.getItem('ui.locale')).toBe('fa');
    expect(browserStorage.length).toBe(1);
    expect(browserStorage.key(0)).toBe('ui.locale');
  });

  it('reads as empty when the browser refuses access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(browserStorage.getItem('x')).toBeNull();
    expect(browserStorage.key(0)).toBeNull();
  });

  it('lets a write that fails be seen, so the restore can count it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => browserStorage.setItem('ui.locale', 'fa')).toThrow('quota');
  });
});
