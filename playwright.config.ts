import { defineConfig, devices } from '@playwright/test';

// the offline and first-paint tests need the production build (it has the service worker and the real index.html);
// everything else runs on the dev server
const OFFLINE = /(offline|firstpaint\.prod|update\.prod)\.spec\.ts/;
// screenshot baselines: desktop Chrome only, run on purpose (`--project=visual`), not with the default projects
const VISUAL = /visual\.spec\.ts/;
// what runs against the published site (the update test serves the build from the test itself, so it does not)
const LIVE = /(offline|firstpaint\.prod)\.spec\.ts/;
const NOT_DEFAULT = [OFFLINE, VISUAL];
// the folder the app is served from (`base` in vite.config.ts), on the dev server (5173) and on `vite preview` (4173)
const BASE = '/zirobam/';
const DEV_URL = `http://localhost:5173${BASE}`;
const PREVIEW_URL = `http://localhost:4173${BASE}`;
// the published site: `LIVE_URL=https://hesamsamani.me/zirobam/ npx playwright test --project=live` runs the offline tests against it
const LIVE_URL = process.env.LIVE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // eight parallel browsers on this laptop make the timing tests and page loads flaky, four do not
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  use: {
    baseURL: DEV_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: NOT_DEFAULT,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      testIgnore: NOT_DEFAULT,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Chrome Landscape',
      testIgnore: NOT_DEFAULT,
      use: {
        ...devices['Pixel 5 landscape'],
      },
    },
    {
      name: 'visual',
      testMatch: VISUAL,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'offline',
      testMatch: OFFLINE,
      use: { ...devices['Desktop Chrome'], baseURL: PREVIEW_URL },
    },
    ...(LIVE_URL ? [{ name: 'live', testMatch: LIVE, use: { ...devices['Desktop Chrome'], baseURL: LIVE_URL } }] : []),
  ],

  // nothing to start when the tests run against the published site
  webServer: LIVE_URL ? undefined : [
    {
      command: 'npm run dev',
      url: DEV_URL,
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      // a fresh build every time, so the tests never run against an old one
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: PREVIEW_URL,
      reuseExistingServer: false,
      timeout: 240000,
    },
  ],
});
