/**
 * Finds out that a new version of the app is installed and waiting.
 *
 * The service worker keeps the app in the browser so it opens without internet. A new version installs in the
 * background, but it must not take over a page that is open (that page would then ask the new worker for files of the
 * old build). So the new version waits, and without this it would wait until every window of the app was closed. This
 * offers it instead: `onReady(apply)` is called when a new version is waiting, and `apply()` tells it to take over;
 * when it has, the page is reloaded once (`reload`).
 */

export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ContainerLike {
  /** The worker that serves this page now; null on the very first visit. */
  controller: unknown;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export function watchForUpdate(registration: RegistrationLike, container: ContainerLike, onReady: (apply: () => void) => void, reload: () => void): void {
  const offered = new Set<WorkerLike>();
  let applying = false;

  const offer = (worker: WorkerLike): void => {
    if (offered.has(worker)) return;
    offered.add(worker);
    onReady(() => {
      applying = true;
      worker.postMessage('skip-waiting');
    });
  };

  // an update that came while the app was closed is waiting already (and on the first visit there is no old version to update)
  if (registration.waiting && container.controller) offer(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && container.controller) offer(worker);
    });
  });

  // only a take-over that was asked for reloads this page: the first worker takes a page without being asked, and
  // another window may have applied an update
  container.addEventListener('controllerchange', () => {
    if (!applying) return;
    applying = false;
    reload();
  });
}

/** A page that stays open for days never navigates, and the browser only looks for a new version on navigation: look again whenever it comes back to the front. */
export function checkOnReturn(registration: { update(): Promise<unknown> }, doc: { visibilityState: string; addEventListener(type: 'visibilitychange', listener: () => void): void }): void {
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState !== 'visible') return;
    try {
      registration.update().catch(() => undefined); // no network: nothing to find
    } catch {
      // the browser refused: nothing to find
    }
  });
}
