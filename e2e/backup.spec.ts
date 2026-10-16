import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function makeSong(page: Page, name: string) {
  await page.goto('/#/maker');
  await page.locator('#makerName').fill(name);
  await page.locator('#makerNotes').fill('C4q D4q E4q F4q | G4w');
  await page.locator('.maker-save').click();
  await expect(page.locator('.maker-status')).toHaveText('Saved in My scores.');
}

async function saveBackup(page: Page, to: string): Promise<void> {
  const download = page.waitForEvent('download');
  await page.locator('#progressView .backup-save').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^music-notes-trainer-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await file.saveAs(to);
}

test.describe('Backup and restore', () => {
  test('the progress screen saves a backup with the settings and the scores', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.noteNames', 'solfege'));
    await makeSong(page, 'Backed up tune');
    await page.goto('/#/progress');
    const target = path.join(os.tmpdir(), `mnt-backup-${Date.now()}-a.json`);
    await saveBackup(page, target);
    const backup = JSON.parse(fs.readFileSync(target, 'utf8'));
    expect(backup.app).toBe('music-notes-trainer');
    expect(backup.version).toBe(1);
    expect(backup.storage['ui.noteNames']).toBe('solfege');
    expect(backup.scores).toHaveLength(1);
    expect(backup.scores[0]).toMatchObject({ title: 'Backed up tune', kind: 'maker' });
    await expect(page.locator('#progressView .backup-status')).toContainText('Scores: 1');
    fs.rmSync(target, { force: true });
  });

  test('a backup brings the scores and the settings back in a browser that has nothing', async ({ page, browser }) => {
    await makeSong(page, 'Travelling tune');
    await page.evaluate(() => localStorage.setItem('ui.locale', 'fa')); // a setting to carry over
    await page.goto('/#/progress');
    const target = path.join(os.tmpdir(), `mnt-backup-${Date.now()}-b.json`);
    await saveBackup(page, target);

    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/#/progress');
    await expect(other.locator('html')).toHaveAttribute('lang', 'en'); // nothing is set here
    await other.locator('#progressView .backup-file').setInputFiles(target);
    await expect(other.locator('#progressView .backup-ask-text')).toContainText('scores (1)');
    await other.locator('#progressView .backup-yes').click();
    await expect(other.locator('#progressView .backup-status')).toContainText('Restored');
    await expect(other.locator('html')).toHaveAttribute('lang', 'fa', { timeout: 10000 }); // the page reloaded
    await other.goto('/#/songs');
    await expect(other.locator('#songsView .my-scores .song-card')).toContainText('Travelling tune');
    await fresh.close();
    fs.rmSync(target, { force: true });
  });

  test('cancelling the question restores nothing', async ({ page, browser }) => {
    await makeSong(page, 'Staying tune');
    await page.goto('/#/progress');
    const target = path.join(os.tmpdir(), `mnt-backup-${Date.now()}-c.json`);
    await saveBackup(page, target);

    const fresh = await browser.newContext();
    const other = await fresh.newPage();
    await other.goto('/#/progress');
    await other.locator('#progressView .backup-file').setInputFiles(target);
    await other.locator('#progressView .backup-no').click();
    await expect(other.locator('#progressView .backup-ask')).toBeHidden();
    await other.goto('/#/songs');
    await expect(other.locator('#songsView .my-scores')).toHaveCount(0);
    await fresh.close();
    fs.rmSync(target, { force: true });
  });

  test('a file that is not a backup is refused with a message', async ({ page }) => {
    await page.goto('/#/progress');
    await page.locator('#progressView .backup-file').setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":"world"}') });
    await expect(page.locator('#progressView .backup-status')).toHaveText('This file is not a backup made by this app.');
    await expect(page.locator('#progressView .backup-ask')).toBeHidden();
  });

  test('a hostile backup writes only the keys of the app', async ({ page }) => {
    await page.goto('/#/progress');
    const evil = {
      app: 'music-notes-trainer',
      version: 1,
      exportedAt: '2026-10-16T10:00:00.000Z',
      storage: { 'ui.noteNames': 'solfege', evilKey: 'x', 'game.v1': 12345 },
      scores: [{ id: '../../etc', title: 'x', kind: 'maker', addedAt: 1, content: { encoding: 'text', data: '<x/>' } }],
    };
    await page.locator('#progressView .backup-file').setInputFiles({ name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) });
    await expect(page.locator('#progressView .backup-ask-text')).toContainText('settings (1) and scores (0)');
    await page.locator('#progressView .backup-yes').click();
    await expect(page.locator('#progressView .backup-status')).toContainText('Restored: settings 1, scores 0');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => localStorage.getItem('ui.noteNames') === 'solfege');
    expect(await page.evaluate(() => localStorage.getItem('evilKey'))).toBeNull();
  });

  test('the options panel has the backup buttons too, and they speak Persian', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui.locale', 'fa'));
    await page.goto('/#/');
    await page.locator('[data-tile="settings"]').click();
    await expect(page.locator('#optionsPanel')).toBeVisible();
    await expect(page.locator('#optionsPanel .backup-save')).toBeVisible();
    await expect(page.locator('#optionsPanel .backup-save')).toHaveText('ذخیره‌ی نسخه‌ی پشتیبان');
    await expect(page.locator('#optionsPanel .backup-restore')).toHaveText('بازگردانی از فایل');
  });

  test('the progress screen fits the screen without scrolling sideways', async ({ page }) => {
    await page.goto('/#/progress');
    await expect(page.locator('#progressView .backup-panel')).toBeVisible();
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(noOverflow).toBe(true);
  });
});
