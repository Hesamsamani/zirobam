import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadTextFile } from '../backup/download';
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
