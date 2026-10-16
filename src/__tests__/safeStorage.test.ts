import { describe, it, expect, afterEach } from 'vitest';
import { storageGet, storageSet, storageRemove } from '../core/safeStorage';

const realDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;

function blockStorage(): void {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is blocked', 'SecurityError');
    },
  });
}

afterEach(() => {
  Object.defineProperty(window, 'localStorage', realDescriptor);
  localStorage.clear();
});

describe('safeStorage', () => {
  it('stores, reads and removes values like localStorage', () => {
    storageSet('k', 'v');
    expect(storageGet('k')).toBe('v');
    storageRemove('k');
    expect(storageGet('k')).toBeNull();
  });

  it('returns null for a key that was never stored', () => {
    expect(storageGet('missing')).toBeNull();
  });

  it('never throws when the browser blocks storage', () => {
    blockStorage();
    expect(() => storageSet('k', 'v')).not.toThrow();
    expect(() => storageRemove('k')).not.toThrow();
    expect(storageGet('k')).toBeNull();
  });

  it('never throws when a write fails (quota exceeded)', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        removeItem: () => {},
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        },
      },
    });
    expect(() => storageSet('k', 'v')).not.toThrow();
  });
});
