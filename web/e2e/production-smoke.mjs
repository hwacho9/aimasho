// Live browsing smoke test: no Google login or meetup/relationship mutations.
// The app itself may initialize an anonymous Firebase Auth session on /profile.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

const origin = 'https://aimasho.web.app';
const browser = await chromium.launch({ headless: true });
mkdirSync('test-results/production', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'ja-JP' });
    const page = await context.newPage();
    const errors = [];
    const assetFailures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/_next/static/') && !response.ok()) assetFailures.push(response.status());
    });
    for (const path of ['/', '/login', '/profile', '/journey']) {
      const response = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 60000 });
      assert.equal(response.status(), 200, path);
      await page.locator('body').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `Overflow: ${path}`);
      if (path === '/login') await page.getByRole('button', { name: /Google/ }).waitFor({ timeout: 15000 });
      await page.screenshot({ path: `test-results/production/${viewport.width}-${path.replaceAll('/', '') || 'home'}.png`, fullPage: true });
      console.log(`${viewport.width}px ${path}: HTTP 200, no horizontal overflow`);
    }
    assert.deepEqual(assetFailures, [], 'Failed JavaScript/CSS assets');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    await context.close();
  }
  console.log('Production browser smoke test passed. No meetup/relationship writes; real Google login is a separate check.');
} finally {
  await browser.close();
}
