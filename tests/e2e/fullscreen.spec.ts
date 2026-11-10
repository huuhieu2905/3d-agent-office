import { expect, test } from '@playwright/test';

// 006 US4 / FR-014..017: fullscreen toggle (button or F) in both views, kept across view switches.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const isFull = (page: import('@playwright/test').Page) => page.evaluate(() => document.fullscreenElement !== null);

test.afterEach(async ({ request }) => {
  const settings = await (await request.get('/api/settings', { headers: auth })).json();
  delete settings.firstRun;
  await request.put('/api/settings', { headers: auth, data: { ...settings, camera: 'overview' } });
});

test('fullscreen turns on from the overview, survives V, and F turns it off', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  const toggle = page.getByTestId('fullscreen-toggle');
  await toggle.click();
  // Some headless browsers refuse fullscreen; then the app must say so and keep working (FR-017).
  const refused = page.getByRole('status').filter({ hasText: 'Fullscreen is not available' });
  await expect.poll(async () => (await isFull(page)) || (await refused.isVisible())).toBe(true);
  test.skip(!(await isFull(page)), 'this browser refuses fullscreen; the refusal message was shown');

  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveText('Exit fullscreen');
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeVisible();
  expect(await isFull(page)).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(() => isFull(page)).toBe(false);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
