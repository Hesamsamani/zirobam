/*
 * Service worker of ZiroBam: it keeps the app and its piano sounds in the browser, so the app opens and
 * plays without internet.
 *
 * `npm run build` runs scripts/build-sw.mjs, which fills in VERSION (it changes whenever any file changes) and
 * PRECACHE (every file of the build). The page registers this file only in the production build.
 *
 * Everything in the list is fetched while the worker installs and then answered from the cache. A new build has
 * a new cache; the old one is deleted when the new worker takes over, which happens the next time the app is opened.
 */
const VERSION = 'dev';
const PRECACHE = [];
const CACHE_PREFIX = 'zirobam-';
const CACHE = CACHE_PREFIX + VERSION;
// the stores of the app under its first name: removed when the new worker takes over
const OLD_PREFIXES = ['music-notes-trainer-'];
const SCOPE = self.registration.scope; // e.g. https://example.org/zirobam/
// a server may send 'Vary: Origin' and a script or stylesheet with the crossorigin attribute asks with an Origin header,
// which a stored copy made without one would not match: the file is the same, so the header is ignored
const MATCH = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).href))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => (key.startsWith(CACHE_PREFIX) && key !== CACHE) || OLD_PREFIXES.some((prefix) => key.startsWith(prefix)))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // only the app's own files; anything else (a link opened in a new tab, a download) goes to the network as usual
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  event.respondWith(answer(request));
});

async function answer(request) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(request, MATCH);
  if (stored) return stored;
  try {
    const response = await fetch(request);
    // a file that was not in the list (for example one of the lazy chunks of a newer build) is kept for next time
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  } catch (error) {
    if (request.mode === 'navigate') {
      const page = await cache.match(new URL('index.html', SCOPE).href, MATCH);
      if (page) return page;
    }
    throw error;
  }
}
