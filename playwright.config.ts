import { defineConfig, devices } from '@playwright/test';

// the offline tests need the production build (it has the service worker); everything else runs on the dev server
const OFFLINE = /offline\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // eight parallel browsers on this laptop make the timing tests and page loads flaky, four do not
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173/sightreading/',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      testIgnore: OFFLINE,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      testIgnore: OFFLINE,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Chrome Landscape',
      testIgnore: OFFLINE,
      use: {
        ...devices['Pixel 5 landscape'],
      },
    },
    {
      name: 'offline',
      testMatch: OFFLINE,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173/sightreading/' },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173/sightreading/',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      // a fresh build every time, so the tests never run against an old one
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/sightreading/',
      reuseExistingServer: false,
      timeout: 240000,
    },
  ],
});
