import { expect, test } from '@playwright/test';

// T060 / FR-006 / SC-010 / quality gate 1: graceful degradation when the App quits, restarts, changes port.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const control = (action: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${action}`);

test.beforeEach(async () => {
  await control('open');
});

test('office shows employees, then a disconnected banner when the App quits, and recovers ≤ 10 s', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.banner')).toHaveCount(0);

  await control('quit');
  await expect(page.getByText('Not connected to the Antigravity App')).toBeVisible({ timeout: 5_000 });

  await control('open');
  const t0 = Date.now();
  await expect(page.locator('.banner')).toHaveCount(0, { timeout: 10_000 });
  expect(Date.now() - t0).toBeLessThan(10_000);
  // No page reload was needed: employees are still on screen.
  await expect(page.locator('.tag').first()).toBeVisible();
});

test('reconnects by itself when the App restarts with a new port and token', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  await control('restart');
  await expect(page.locator('.banner')).toHaveCount(0, { timeout: 10_000 });
  const res = await page.evaluate(async (t) => {
    const r = await fetch('/api/health', { headers: { authorization: `Bearer ${t}` } });
    return r.json();
  }, TOKEN);
  expect(res.connection.kind).toBe('connected');
});

test('rejects requests without the session token', async ({ request }) => {
  const res = await request.get('/api/employees');
  expect(res.status()).toBe(401);
});
