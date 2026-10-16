// Run after `vite build`: writes the list of files and a version into dist/sw.js.
// Usage: node scripts/build-sw.mjs [dist-folder]
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const worker = path.join(dist, 'sw.js');

/** Every file under `dir`, as paths with forward slashes relative to `root`, in a fixed order. */
function listFiles(root, dir = root) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(root, full));
    else found.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return found;
}

const SKIP = (file) => file === 'sw.js' || file.endsWith('.md') || file.startsWith('.');

const files = listFiles(dist).filter((file) => !SKIP(file));
if (!files.includes('index.html')) throw new Error(`${dist} has no index.html: run vite build first`);

const hash = createHash('sha256');
for (const file of files) {
  hash.update(file);
  hash.update(readFileSync(path.join(dist, file)));
}
hash.update(readFileSync(worker)); // the worker's own code counts too
const version = hash.digest('hex').slice(0, 12);
// the folder itself, so a visit to the address without index.html is answered too
const precache = ['', ...files];

let source = readFileSync(worker, 'utf8');
const versionLine = "const VERSION = 'dev';";
const listLine = 'const PRECACHE = [];';
if (!source.includes(versionLine) || !source.includes(listLine)) throw new Error('sw.js does not have the lines to fill in');
source = source.replace(versionLine, () => `const VERSION = '${version}';`).replace(listLine, () => `const PRECACHE = ${JSON.stringify(precache)};`);
writeFileSync(worker, source);

const total = files.reduce((sum, file) => sum + statSync(path.join(dist, file)).size, 0);
console.log(`sw.js: ${files.length} files (${(total / 1048576).toFixed(1)} MB) cached, version ${version}`);
