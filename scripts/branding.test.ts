// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/locales/en';
import { fa } from '../src/i18n/locales/fa';

/**
 * The name, the address and the icons of the app. The app is called ZiroBam and is served under /zirobam/; the old
 * name and path of the upstream project must not be left behind anywhere a browser or a test would look.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => existsSync(path.join(ROOT, file));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(file: string): [number, number] {
  const bytes = readFileSync(path.join(ROOT, file));
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is a PNG`).toBe(true);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('the address', () => {
  it('serves the app under /zirobam/ and leaves no /sightreading/ path in the config, page, scripts or end-to-end tests', () => {
    expect(read('vite.config.ts')).toContain("base: '/zirobam/'");
    const files = ['vite.config.ts', 'playwright.config.ts', 'index.html', 'Start-Trainer.ps1', 'package.json', 'public/manifest.webmanifest', 'public/sw.js']
      .concat(readdirSync(path.join(ROOT, 'e2e')).filter((f: string) => f.endsWith('.ts')).map((f: string) => `e2e/${f}`));
    for (const file of files) expect(read(file), file).not.toContain('/sightreading');
  });

  it('is called zirobam in the package, with the address of the live site', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.name).toBe('zirobam');
    expect(pkg.homepage).toBe('https://hesamsamani.me/zirobam/');
    expect(pkg.scripts.deploy).toBeUndefined();
    expect(pkg.devDependencies['gh-pages']).toBeUndefined();
    const lock = JSON.parse(read('package-lock.json'));
    expect(lock.name).toBe('zirobam');
    expect(lock.packages[''].name).toBe('zirobam');
  });
});

describe('the name', () => {
  it('is ZiroBam on the home screen in English, and the Persian form of it in Persian', () => {
    expect(en['menu.title']).toBe('ZiroBam');
    expect(fa['menu.title']).toBe('زیر و بم');
    expect(en['app.documentTitle']).toContain('ZiroBam');
    expect(fa['app.documentTitle']).toContain('زیر و بم');
  });

  it('is in the title, the description and the names of the installed app', () => {
    const html = read('index.html');
    expect(html).toContain('<meta name="application-name" content="ZiroBam"');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="ZiroBam"');
    expect(html).toMatch(/<title[^>]*>ZiroBam/);
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.name).toBe('ZiroBam');
    expect(manifest.short_name).toBe('ZiroBam');
  });

  it('points the GitHub link at the repository of the app, not the upstream one', () => {
    const html = read('index.html');
    expect(html).toContain('https://github.com/Hesamsamani/zirobam');
    expect(html).not.toContain('ftrain/sightreading"');
  });

  it('gives the backup file the name of the app, and keeps the id inside the file that old backups carry', () => {
    const backup = read('src/backup/backup.ts');
    expect(backup).toContain("export const BACKUP_APP = 'music-notes-trainer'");
    expect(backup).toMatch(/`zirobam-backup-\$\{/);
  });
});

describe('the service worker', () => {
  it('keeps its stores under its own prefix and cleans up the ones of the old name too', () => {
    const worker = read('public/sw.js');
    expect(worker).toContain("const CACHE_PREFIX = 'zirobam-'");
    expect(worker).toContain("'music-notes-trainer-'");
  });
});

describe('the icons', () => {
  const html = read('index.html');
  const hrefOf = (rel: string, type?: string) => {
    const tag = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`rel="${rel}"`) && (!type || t.includes(`type="${type}"`)));
    return /href="([^"]+)"/.exec(tag ?? '')?.[1];
  };
  /** `/zirobam/icons/x.png` is `public/icons/x.png`. */
  const publicFile = (href: string) => `public/${href.replace(/^\/zirobam\//, '')}`;

  it('links an .ico for every browser, a vector icon, the icon of the home screen and the manifest, all under /zirobam/', () => {
    for (const href of [hrefOf('icon', 'image/x-icon'), hrefOf('icon', 'image/svg+xml'), hrefOf('apple-touch-icon'), hrefOf('manifest')]) {
      expect(href, 'a link is missing').toMatch(/^\/zirobam\//);
      expect(exists(publicFile(href!)), href).toBe(true);
    }
    expect(html).toMatch(/<link rel="icon" href="\/zirobam\/favicon\.ico" sizes="32x32"/);
  });

  it('has the sizes each icon is named for', () => {
    expect(pngSize(publicFile(hrefOf('apple-touch-icon')!))).toEqual([180, 180]);
    expect(pngSize('public/icons/favicon-32.png')).toEqual([32, 32]);
    expect(pngSize('public/icons/icon-192.png')).toEqual([192, 192]);
    expect(pngSize('public/icons/icon-512.png')).toEqual([512, 512]);
    expect(pngSize('public/icons/icon-maskable-512.png')).toEqual([512, 512]);
  });

  it('lists exactly the three icons the manifest promises, and every one exists', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icon of manifest.icons) expect(exists(`public/${icon.src}`), icon.src).toBe(true);
  });

  it('packs 16, 32 and 48 pixels into favicon.ico, each one a PNG', () => {
    const ico = readFileSync(path.join(ROOT, 'public/favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const at = 6 + i * 16;
      sizes.push(ico[at]);
      const offset = ico.readUInt32LE(at + 12);
      expect(ico.subarray(offset, offset + 8).equals(PNG_SIGNATURE), `entry ${i} is a PNG`).toBe(true);
      expect(ico.readUInt32BE(offset + 16)).toBe(ico[at]);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('draws the mark as an SVG with a viewBox, so it stays sharp at any size', () => {
    const svg = read('public/favicon.svg');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).not.toMatch(/<(script|image)\b/);
  });
});
