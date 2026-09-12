import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, name: string, email: string) {
  page.on('pageerror', error => console.log('PAGE ERROR', error.message));
  await page.goto('/login');
  await page.getByRole('combobox').selectOption('ja');
  const popupPromise = page.waitForEvent('popup', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Google でログイン', exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  // Firebase Auth Emulator's local Google identity dialog (not Google OAuth).
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill(name);
  await popup.locator('#sign-in').click();
  await expect(page.getByRole('heading', { name: `${name}さん、また会おう。` })).toBeVisible();
}

async function create(page: Page, title: string) {
  await page.goto('/new');
  await page.getByLabel('予定の名前', { exact: true }).fill(title);
  await page.getByLabel('候補 1', { exact: true }).fill('2026-09-20T12:00');
  await page.getByRole('button', { name: '予定をつくる', exact: true }).click();
  await expect(page.locator('.share-link span')).toBeVisible();
  const invite = await page.locator('.share-link span').innerText();
  expect(invite).toMatch(/^http:\/\/127\.0\.0\.1:3007\/m\//);
  return invite;
}

async function join(page: Page, url: string, name: string) {
  await page.goto(url);
  await page.getByLabel('名前', { exact: true }).fill(name);
  await page.getByRole('button', { name: '参加する', exact: true }).click();
  await expect(page.locator('.event-plan-panel')).toBeVisible();
}

async function addPlan(page: Page, title: string, place: string, time: string) {
  const panel = page.locator('.event-plan-panel');
  await panel.getByLabel('タイトル', { exact: true }).fill(title);
  await panel.getByLabel('時刻だけ選択').fill(time);
  await panel.getByLabel('場所・任意').fill(place);
  await panel.getByRole('button', { name: '検索', exact: true }).click();
  await panel.locator('.plan-place-results button').filter({ hasText: place }).first().click();
  await panel.getByRole('button', { name: '予定を追加', exact: true }).click();
  const item = panel.locator('.plan-item').filter({ hasText: title });
  await expect(item).toBeVisible();
  await item.getByLabel('予定の状態', { exact: true }).selectOption('completed');
  await expect(item).toHaveClass(/completed/);
}

test('two registered users: invitation, plan, completion, friends and Journey', async ({ browser }, testInfo) => {
  const options = { locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: testInfo.project.use.viewport };
  const first = await browser.newContext(options);
  const second = await browser.newContext(options);
  // Prevent accidental calls to production APIs from this isolated test suite.
  for (const context of [first, second]) {
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(30_000);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      // Firebase's popup SDK still loads Google's static gapi runtime even
      // when its identity provider, token exchange and data are emulated.
      if (['127.0.0.1', 'localhost', 'apis.google.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
          || (url.hostname === 'unpkg.com' && /^\/material-components-web@10(?:\.\d+\.\d+)?\//.test(url.pathname))) return route.continue();
      return route.abort();
    });
  }
  const a = await first.newPage();
  const b = await second.newPage();
  const run = Date.now();
  await login(a, 'Web Alice', `web-a-${run}@example.test`);
  console.log('PASS Web Alice Google-emulator popup login');
  await login(b, 'Web Bob', `web-b-${run}@example.test`);
  console.log('PASS Web Bob Google-emulator popup login');
  await a.reload();
  await expect(a.getByRole('heading', { name: 'Web Aliceさん、また会おう。' })).toBeVisible();
  const groupName = `Home group ${run}`;
  await a.goto('/profile');
  await a.getByPlaceholder('新しいグループ名', { exact: true }).fill(groupName);
  await a.getByRole('button', { name: '+ グループを作る', exact: true }).click();
  await expect(a.locator('.room-grid').getByRole('link').filter({ hasText: groupName })).toBeVisible();
  await a.goto('/');
  const group = a.locator('.home-groups').getByRole('link').filter({ hasText: groupName });
  await expect(group).toBeVisible();
  await expect(group).toContainText('管理者');
  expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await a.screenshot({ path: testInfo.outputPath('home-groups.png'), fullPage: true });
  await group.click();
  await expect(a).toHaveURL(/\/rooms\//);
  await expect(a.getByRole('heading', { name: groupName, exact: true })).toBeVisible();
  console.log('PASS group created, visible on home, opens group room');
  const title = `Web shared ${run}`;
  const invite = await create(a, title);
  console.log('PASS Web create and invitation URL');
  await join(b, invite, 'Web Bob');
  await b.reload();
  await expect(b.getByRole('button', { name: '参加する', exact: true })).toHaveCount(0);
  await expect(b.locator('.event-plan-panel')).toBeVisible();
  await a.getByRole('button', { name: 'おすすめの日程で決定', exact: true }).click();
  await expect(a.locator('.finalized-schedule')).toBeVisible();
  await addPlan(a, 'First stop', '東京駅', '12:00');
  await addPlan(b, 'Second stop', '渋谷駅', '14:00');
  expect(await b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(a.locator('.plan-item').filter({ hasText: 'Second stop' })).toBeVisible();
  await a.getByRole('button', { name: '予定を完了', exact: true }).click();
  await expect(a.locator('.completed-note')).toBeVisible();
  await expect(b.locator('.completed-note')).toBeVisible();
  // Reverse the roles: the other friend's unfinished meetup must be visible too.
  const reverseTitle = `Bob pending ${run}`;
  const reverse = await create(b, reverseTitle);
  await join(a, reverse, 'Web Alice');
  for (const [page, peerName] of [[a, 'Web Bob'], [b, 'Web Alice']] as const) {
    await page.goto('/');
    await page.getByRole('button', { name: '友だち', exact: true }).click();
    const friend = page.locator('.social-friend-card').filter({ hasText: peerName });
    await expect(friend).toBeVisible();
    await expect(friend.locator('.social-friend-count')).toHaveText('1 回の思い出');
    await expect(page.locator('.social-empty[role="alert"]')).toHaveCount(0);
    await friend.getByRole('link').click();
    await expect(page.getByText('一緒に完了した予定 1回', { exact: true })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(reverseTitle, { exact: true })).toBeVisible();
    await page.goto('/journey');
    const play = page.getByRole('button', { name: '再生', exact: true });
    await expect(play).toBeEnabled();
    await play.click();
    await expect(page.getByRole('button', { name: '一時停止', exact: true })).toBeVisible();
    await expect.poll(async () => Number(await page.getByLabel('旅の再生位置').inputValue())).toBeGreaterThan(0);
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${peerName.replace(' ', '-')}-journey.png`), fullPage: true });
  }
  await first.close();
  await second.close();
});
