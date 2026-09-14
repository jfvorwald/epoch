import { test, expect, type Page, type Route } from '@playwright/test';

const staging = 'https://epoch-staging.jaqstudios.com';
const owner = 'epoch-test-owner@gmail.com';
const tester = 'epoch-test-pilot@gmail.com';
type Report = { id: string; type: string; title: string; description: string; email: string; status: string; createdAt: string; build: string; level: number | null; wave: number | null; ship: string; userAgent: string };
type MockState = {
  reports: Report[]; requests: string[]; submissions: Record<string, unknown>[]; owner: boolean;
  notifications: { configured: boolean; pending: number; sent: number; lastFailure: { code: string; at: string } | null };
  notificationRequest?: (route: Route) => Promise<void>;
  post?: (route: Route, body: Record<string, unknown>) => Promise<void>;
};

async function mockStaging(page: Page, isOwner = false): Promise<MockState> {
  const state: MockState = { reports: [], requests: [], submissions: [], owner: isOwner, notifications: { configured: true, pending: 0, sent: 0, lastFailure: null } };
  await page.route('https://*.jaqstudios.com/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/beta/')) {
      const response = await route.fetch({ url: `http://127.0.0.1:5173${url.pathname}${url.search}` });
      return route.fulfill({ response });
    }
    state.requests.push(`${route.request().method()} ${url.pathname}`);
    if (url.pathname === '/api/beta/session') return route.fulfill({ json: { email: state.owner ? owner : tester, isOwner: state.owner } });
    if (url.pathname === '/api/beta/notifications') return state.notificationRequest ? state.notificationRequest(route) : route.fulfill({ json: state.notifications });
    if (url.pathname === '/api/beta/feedback.md') return route.fulfill({ contentType: 'text/plain; charset=utf-8', body: '# EPOCH staging beta feedback\n\n' + state.reports.map(report => `${report.title}\nStatus: ${report.status}`).join('\n\n') });
    if (route.request().method() === 'GET') return route.fulfill({ json: { reports: state.reports, ...(state.owner ? { testers: [owner, tester] } : {}) } });
    if (route.request().method() === 'PATCH') {
      const id = url.pathname.split('/').at(-1)!;
      const report = state.reports.find(item => item.id === id)!;
      report.status = route.request().postDataJSON().status;
      return route.fulfill({ json: { id, status: report.status } });
    }
    const body = route.request().postDataJSON();
    state.submissions.push(body);
    if (state.post) return state.post(route, body);
    if (!state.reports.some(report => report.id === body.id)) state.reports.unshift({ ...body, email: state.owner ? owner : tester, status: 'new', createdAt: new Date().toISOString(), userAgent: 'browser-test' });
    return route.fulfill({ json: { id: body.id } });
  });
  return state;
}

async function openFeedback(page: Page) {
  await page.getByRole('button', { name: 'Beta feedback' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
}

test('feedback appears only on the exact staging origin and never requests the API on production', async ({ page }) => {
  const state = await mockStaging(page);
  for (const origin of ['https://epoch.jaqstudios.com', 'https://epoch-staging-preview.jaqstudios.com']) {
    await page.goto(origin);
    await expect(page.locator('[data-action="launch"]')).toBeEnabled();
    await expect(page.locator('.beta-trigger')).toHaveCount(0);
    await expect(page.locator('#beta-dialog')).toHaveCount(0);
  }
  expect(state.requests).toEqual([]);
  await page.goto(staging);
  await expect(page.locator('.beta-trigger')).toBeVisible();
  expect(state.requests).toEqual([]);
});

test('testers can send private reports with flight context while gameplay stays paused', async ({ page }, info) => {
  const state = await mockStaging(page);
  await page.goto(staging);
  await page.locator('[data-action="launch"]:not(:disabled)').click();
  await expect(page.locator('#pause-control')).toBeVisible();
  await page.evaluate(() => (window as any).__EPOCH__.debug('startWave', { index: 0 }));
  const trigger = await page.locator('.beta-trigger').boundingBox();
  const playfield = await page.locator('#game-stage').boundingBox();
  expect(trigger!.y + trigger!.height <= playfield!.y || trigger!.x + trigger!.width <= playfield!.x || trigger!.x >= playfield!.x + playfield!.width).toBeTruthy();
  await openFeedback(page);
  await expect.poll(() => page.evaluate(() => (window as any).__EPOCH__.snapshot().screen)).toBe('paused');
  await expect(page.locator('.beta-session')).toContainText(tester);
  await expect(page.locator('.beta-flight-context')).toContainText('Level 1');
  await page.getByLabel('Title', { exact: true }).fill('Ship movement stops after pausing');
  await page.getByLabel('Details', { exact: true }).fill('Press p, resume, then drag left. I expected the ship to move.');
  await page.keyboard.press('p');
  await expect.poll(() => page.evaluate(() => (window as any).__EPOCH__.snapshot().screen)).toBe('paused');
  await page.screenshot({ path: info.outputPath('beta-form.png') });
  expect(await page.locator('#beta-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Send feedback' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('beta-form-submit.png') });
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.beta-submit-message')).toContainText('Feedback sent');
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0]).toMatchObject({ type: 'bug', title: 'Ship movement stops after pausing', level: 1, ship: 'strelka' });
  expect(state.submissions[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(state.submissions[0].wave).toBeGreaterThan(0);
  expect(state.submissions[0].email).toBeUndefined();
  await page.getByRole('tab', { name: 'Your reports' }).click();
  await expect(page.locator('.beta-report')).toHaveCount(1);
  await expect(page.locator('.beta-report h4')).toHaveText('Ship movement stops after pausing');
  await expect(page.locator('.beta-roster')).toBeHidden();
  await expect(page.locator('.beta-download')).toBeHidden();
  await expect(page.getByRole('button', { name: 'View Markdown' })).toBeHidden();
  await expect(page.locator('.beta-status-control')).toHaveCount(0);
  await expect(page.locator('.beta-notifications')).toBeHidden();
  expect(state.requests).not.toContain('GET /api/beta/notifications');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.beta-trigger')).toBeFocused();
  await expect(page.locator('[data-action="resume"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__EPOCH__.snapshot().screen)).toBe('paused');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-action="resume"]')).toBeFocused();
});

test('the owner sees the roster and inbox and can track a report status safely', async ({ page }, info) => {
  const state = await mockStaging(page, true);
  state.reports.push({ id: 'a63e21aa-764c-47e4-9a81-55e1963b2509', type: 'idea', title: '<img src=x onerror=alert(1)> Add a replay', description: 'I would like to replay a completed level.', email: tester, status: 'new', createdAt: '2026-09-14T12:00:00Z', build: 'v1.0.0 · test-build', level: 3, wave: 2, ship: 'strelka', userAgent: 'test' });
  await page.goto(staging);
  await openFeedback(page);
  await page.getByRole('tab', { name: 'Beta inbox' }).click();
  await expect(page.locator('.beta-roster')).toBeVisible();
  await expect(page.locator('.beta-roster li')).toHaveText([owner, tester]);
  const download = page.getByRole('link', { name: 'Download Markdown' });
  await page.getByRole('button', { name: 'View Markdown' }).click();
  await expect(page.getByRole('region', { name: 'Markdown inbox' })).toContainText('<img src=x onerror=alert(1)> Add a replay');
  await expect(page.locator('.beta-markdown img')).toHaveCount(0);
  expect(await page.locator('#beta-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBeTruthy();
  await expect(download).toBeVisible();
  await expect(download).toHaveAttribute('href', '/api/beta/feedback.md');
  await expect(download).toHaveAttribute('download', 'epoch-beta-feedback.md');
  await expect(page.locator('.beta-report h4')).toHaveText('<img src=x onerror=alert(1)> Add a replay');
  await expect(page.locator('.beta-report img')).toHaveCount(0);
  await expect(page.locator('.beta-report')).toContainText(tester);
  await page.getByRole('combobox', { name: 'Status for' }).selectOption('planned');
  await expect(page.locator('.beta-status')).toHaveText('planned');
  await expect(page.locator('.beta-list-message')).toHaveText('Status updated.');
  expect(state.reports[0].status).toBe('planned');
  await expect(page.getByRole('region', { name: 'Markdown inbox' })).toBeHidden();
  await page.getByRole('button', { name: 'View Markdown' }).click();
  await expect(page.getByRole('region', { name: 'Markdown inbox' })).toContainText('Status: planned');
  await page.screenshot({ path: info.outputPath('beta-inbox.png') });
});

test('owner email status shows queued delivery and setup problems without blocking report management', async ({ page }, info) => {
  const state = await mockStaging(page, true);
  state.notifications = { configured: true, pending: 2, sent: 3, lastFailure: { code: 'delivery_failed', at: '2026-09-14T12:00:00Z' } };
  state.reports.push({ id: 'a63e21aa-764c-47e4-9a81-55e1963b2509', type: 'bug', title: 'The guardian warning is hard to see', description: 'Give it a brighter outline.', email: tester, status: 'new', createdAt: '2026-09-14T12:00:00Z', build: 'v1.0.0 · test-build', level: 3, wave: 2, ship: 'strelka', userAgent: 'test' });
  await page.goto(staging);
  await openFeedback(page);
  await page.getByRole('tab', { name: 'Beta inbox' }).click();
  const status = page.locator('.beta-notifications');
  await expect(status).toContainText(`Email to ${owner}`);
  await expect(status).toContainText('2 queued · 3 accepted for delivery');
  await expect(status).toContainText('Delivery delayed; retry scheduled');
  await expect(page.locator('.beta-report h4')).toHaveText(state.reports[0].title);
  expect(await page.locator('#beta-dialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('beta-email-queued.png') });

  state.notifications = { configured: false, pending: 2, sent: 3, lastFailure: null };
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(status).toContainText('Setup needed · 2 queued');
  await expect(page.locator('.beta-report')).toHaveCount(1);

  state.notificationRequest = route => route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(status).toContainText('Delivery status unavailable. Reports are still saved here.');
  await expect(page.locator('.beta-report')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Status for' }).selectOption('planned');
  await expect(page.locator('.beta-status')).toHaveText('planned');
  await page.getByRole('button', { name: 'View Markdown' }).click();
  await expect(page.getByRole('region', { name: 'Markdown inbox' })).toContainText('Status: planned');
  await page.getByRole('tab', { name: 'Leave feedback' }).click();
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
});

test('a slow email status request cannot block reports or expose stale owner information after an account change', async ({ page }) => {
  const state = await mockStaging(page, true);
  let completeNotification: (() => void) | undefined;
  state.notificationRequest = async route => {
    await new Promise<void>(resolve => { completeNotification = resolve; });
    await route.fulfill({ json: { configured: true, pending: 5, sent: 8, lastFailure: null } });
  };
  state.reports.push({ id: 'a63e21aa-764c-47e4-9a81-55e1963b2509', type: 'idea', title: 'Add a replay', description: 'Replay a completed level.', email: tester, status: 'new', createdAt: '2026-09-14T12:00:00Z', build: 'v1.0.0 · test-build', level: 3, wave: 2, ship: 'strelka', userAgent: 'test' });
  await page.goto(staging);
  await openFeedback(page);
  await page.getByRole('tab', { name: 'Beta inbox' }).click();
  await expect(page.locator('.beta-notifications')).toContainText('Checking delivery status');
  await expect(page.locator('.beta-report h4')).toHaveText('Add a replay');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  state.owner = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Your reports' })).toBeVisible();
  await expect(page.locator('.beta-notifications')).toBeHidden();
  await expect(page.locator('.beta-notifications')).toBeEmpty();
  const response = page.waitForResponse('**/api/beta/notifications');
  completeNotification!();
  await response;
  await expect(page.locator('.beta-notifications')).toBeHidden();
  await expect(page.locator('.beta-notifications')).toBeEmpty();
  await expect(page.locator('.beta-report h4')).toHaveText('Add a replay');
  await expect(page.locator('.beta-roster')).toBeHidden();
  expect(state.requests.filter(request => request === 'GET /api/beta/notifications')).toHaveLength(1);
});

test('an uncertain submission retains its draft and id across closing and retrying', async ({ page }) => {
  const state = await mockStaging(page);
  state.post = async (route, body) => state.submissions.length === 1 ? route.abort('failed') : route.fulfill({ json: { id: body.id } });
  await page.goto(staging);
  await openFeedback(page);
  await page.getByLabel('Idea', { exact: false }).check();
  await page.getByLabel('Title', { exact: true }).fill('A visible guardian warning');
  await page.getByLabel('Details', { exact: true }).fill('Show a warning before the final wave begins.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.beta-submit-message')).toContainText('Retry submission');
  await expect(page.locator('.beta-submit-message')).not.toContainText('Feedback sent');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A visible guardian warning');
  await page.getByRole('button', { name: 'Close beta feedback' }).click();
  await page.locator('.beta-trigger').click();
  await expect(page.getByRole('button', { name: 'Retry submission' })).toBeEnabled();
  await expect(page.getByLabel('Details', { exact: true })).toHaveValue('Show a warning before the final wave begins.');
  await page.getByRole('button', { name: 'Retry submission' }).click();
  await expect(page.locator('.beta-submit-message')).toContainText('Feedback sent');
  expect(state.submissions).toHaveLength(2);
  expect(state.submissions[1]).toEqual(state.submissions[0]);
});

test('offline and expired sign-in errors preserve the draft without claiming it was sent', async ({ page, context }) => {
  const state = await mockStaging(page);
  await page.goto(staging);
  await openFeedback(page);
  await page.getByLabel('Title', { exact: true }).fill('A bug during an offline flight');
  await page.getByLabel('Details', { exact: true }).fill('Keep this description until I can reconnect.');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.beta-submit-message')).toContainText('offline');
  expect(state.submissions).toHaveLength(0);
  await context.setOffline(false);
  state.post = async route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('.beta-submit-message')).toContainText('sign-in has expired');
  await expect(page.locator('.beta-submit-message')).not.toContainText('Feedback sent');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A bug during an offline flight');
  await expect(page.getByLabel('Details', { exact: true })).toHaveValue('Keep this description until I can reconnect.');
  await expect(page.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('target', '_blank');
});
