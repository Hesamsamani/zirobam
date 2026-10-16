// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'sw.js');
const SCRIPT = path.join(ROOT, 'scripts', 'build-sw.mjs');

function makeDist(extra: Record<string, string> = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mnt-dist-'));
  const files: Record<string, string> = {
    'index.html': '<html></html>',
    'assets/app-abc.js': 'console.log(1)',
    'samples/salamander/C4.mp3': 'ID3',
    'samples/salamander/README.md': 'licence',
    'manifest.webmanifest': '{}',
    ...extra,
  };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  copyFileSync(TEMPLATE, path.join(dir, 'sw.js'));
  return dir;
}

const build = (dir: string) => execFileSync('node', [SCRIPT, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

describe('scripts/build-sw.mjs', () => {
  it('writes every file of the build and a version into the worker', () => {
    const dir = makeDist();
    try {
      const output = build(dir);
      const source = readFileSync(path.join(dir, 'sw.js'), 'utf8');
      const version = /const VERSION = '([0-9a-f]{12})';/.exec(source)?.[1];
      expect(version).toBeDefined();
      expect(output).toContain(version);
      const list = JSON.parse(/const PRECACHE = (\[.*\]);/.exec(source)![1]) as string[];
      expect(list).toEqual(['', 'assets/app-abc.js', 'index.html', 'manifest.webmanifest', 'samples/salamander/C4.mp3']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gives a new version when a file changes, and the same one when nothing does', () => {
    const a = makeDist();
    const b = makeDist();
    const c = makeDist({ 'assets/app-abc.js': 'console.log(2)' });
    try {
      for (const dir of [a, b, c]) build(dir);
      const version = (dir: string) => /const VERSION = '([0-9a-f]{12})'/.exec(readFileSync(path.join(dir, 'sw.js'), 'utf8'))![1];
      expect(version(a)).toBe(version(b));
      expect(version(c)).not.toBe(version(a));
    } finally {
      for (const dir of [a, b, c]) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a folder that has not been built', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mnt-empty-'));
    try {
      copyFileSync(TEMPLATE, path.join(dir, 'sw.js'));
      expect(() => build(dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------- the worker itself, run with a small stand-in for the browser ----------

class FakeCache {
  readonly map = new Map<string, FakeResponse>();
  async addAll(urls: string[]) {
    for (const url of urls) this.map.set(url, new FakeResponse(`stored ${url}`));
  }
  /** The options of the last lookup, to see that the worker asks for what it needs. */
  lastOptions: Record<string, unknown> = {};
  async match(request: { url: string } | string, options: Record<string, unknown> = {}) {
    this.lastOptions = options;
    const url = typeof request === 'string' ? request : request.url;
    return this.map.get(url.split('?')[0]);
  }
  async put(request: { url: string }, response: FakeResponse) {
    this.map.set(request.url, response);
  }
}

class FakeResponse {
  readonly ok = true;
  readonly type = 'basic';
  readonly body: string;
  constructor(body: string) {
    this.body = body;
  }
  clone() {
    return new FakeResponse(this.body);
  }
}

type Handler = (event: Record<string, unknown>) => void;

function runWorker(options: { precache: string[]; online: boolean }) {
  const source = readFileSync(TEMPLATE, 'utf8').replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(options.precache)};`).replace("'dev'", "'v2'");
  const handlers = new Map<string, Handler>();
  const caches = new Map<string, FakeCache>();
  const fetched: string[] = [];
  const claimed: boolean[] = [];
  const context = {
    self: {
      registration: { scope: 'https://example.org/sightreading/' },
      location: { origin: 'https://example.org' },
      addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
      clients: { claim: async () => void claimed.push(true) },
    },
    caches: {
      open: async (name: string) => {
        if (!caches.has(name)) caches.set(name, new FakeCache());
        return caches.get(name)!;
      },
      keys: async () => [...caches.keys()],
      delete: async (name: string) => caches.delete(name),
    },
    fetch: async (request: { url: string }) => {
      fetched.push(request.url);
      if (!options.online) throw new Error('offline');
      return new FakeResponse(`network ${request.url}`);
    },
    URL,
    Promise,
  };
  vm.runInNewContext(source, context);

  const dispatch = async (type: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> | undefined;
    handlers.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => void (pending = p), respondWith: (p: Promise<unknown>) => void (pending = p) });
    return pending;
  };
  const get = (url: string, mode = 'cors') => dispatch('fetch', { request: { method: 'GET', url, mode } }) as Promise<FakeResponse | undefined>;
  return { dispatch, get, caches, fetched, claimed, handlers };
}

describe('public/sw.js', () => {
  let worker: ReturnType<typeof runWorker>;

  beforeEach(() => {
    worker = runWorker({ precache: ['', 'index.html', 'assets/app.js'], online: false });
  });

  it('stores the whole list when it installs', async () => {
    await worker.dispatch('install', {});
    const cache = worker.caches.get('music-notes-trainer-v2')!;
    expect([...cache.map.keys()]).toEqual([
      'https://example.org/sightreading/',
      'https://example.org/sightreading/index.html',
      'https://example.org/sightreading/assets/app.js',
    ]);
  });

  it('answers from the store without asking the network, and ignores a ?query', async () => {
    await worker.dispatch('install', {});
    const response = await worker.get('https://example.org/sightreading/assets/app.js?v=3');
    expect(response?.body).toBe('stored https://example.org/sightreading/assets/app.js');
    expect(worker.fetched).toEqual([]);
  });

  it('does not let a Vary: Origin header keep a stored file from matching', async () => {
    await worker.dispatch('install', {});
    await worker.get('https://example.org/sightreading/assets/app.js');
    expect(worker.caches.get('music-notes-trainer-v2')!.lastOptions).toEqual({ ignoreSearch: true, ignoreVary: true });
  });

  it('opens a page offline: a navigation that is not stored gets the stored app', async () => {
    await worker.dispatch('install', {});
    const response = await worker.get('https://example.org/sightreading/some/page', 'navigate');
    expect(response?.body).toBe('stored https://example.org/sightreading/index.html');
  });

  it('fails an unknown file offline instead of making one up', async () => {
    await worker.dispatch('install', {});
    await expect(worker.get('https://example.org/sightreading/assets/unknown.js')).rejects.toThrow('offline');
  });

  it('keeps a file it had to fetch, for the next time', async () => {
    const online = runWorker({ precache: ['index.html'], online: true });
    await online.dispatch('install', {});
    const first = await online.get('https://example.org/sightreading/assets/lazy.js');
    expect(first?.body).toBe('network https://example.org/sightreading/assets/lazy.js');
    const second = await online.get('https://example.org/sightreading/assets/lazy.js');
    expect(second?.body).toBe('network https://example.org/sightreading/assets/lazy.js');
    expect(online.fetched).toHaveLength(1);
  });

  it('leaves other sites, other paths and non-GET requests alone', async () => {
    await worker.dispatch('install', {});
    let touched = false;
    const handler = worker.handlers.get('fetch')!;
    for (const request of [
      { method: 'GET', url: 'https://other.example/sightreading/x.js', mode: 'cors' },
      { method: 'GET', url: 'https://example.org/elsewhere/x.js', mode: 'cors' },
      { method: 'POST', url: 'https://example.org/sightreading/x', mode: 'cors' },
    ]) {
      handler({ request, respondWith: () => void (touched = true) });
    }
    expect(touched).toBe(false);
  });

  it('removes the stores of older versions when it takes over', async () => {
    await worker.caches.set('music-notes-trainer-old', new FakeCache());
    await worker.caches.set('someone-elses-cache', new FakeCache());
    await worker.dispatch('install', {});
    await worker.dispatch('activate', {});
    expect([...worker.caches.keys()].sort()).toEqual(['music-notes-trainer-v2', 'someone-elses-cache']);
    expect(worker.claimed).toEqual([true]);
  });
});
