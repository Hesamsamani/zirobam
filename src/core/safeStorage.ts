/**
 * localStorage that never throws. Some browser settings (blocked site data, private windows,
 * a full quota) make any access throw; for this app that only means nothing is remembered.
 */

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to remove
  }
}
