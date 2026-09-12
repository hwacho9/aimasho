import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'desktop-web', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-web', use: { viewport: { width: 390, height: 844 } } },
  ],
  use: {
    baseURL: 'http://127.0.0.1:3007',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    // Traces/storage state could retain even demo tokens. Do not persist them.
    trace: 'off',
  },
});
