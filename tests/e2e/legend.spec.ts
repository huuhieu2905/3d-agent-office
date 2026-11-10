import { expect, test } from '@playwright/test';
import { TID } from './testids';

// 004 US1 (FR-001…FR-004, SC-001, U4-1): the project legend collapses, never overflows the screen and
// remembers its state. The mock gives each of its 8 conversations its own project; a short window makes
// that list taller than the room available, which is the same situation as 20 projects on a laptop.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
  await ctl('many-projects');
});

test('legend stays on screen, scrolls, collapses and remembers it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 300 });
  await page.goto(`/#k=${TOKEN}`);
  const toggle = page.getByTestId(TID.legendToggle);
  const list = page.getByTestId(TID.legendList);
  await expect(list.getByRole('button', { name: /Dự án thử/ })).toHaveCount(8, { timeout: 15_000 });

  // Inside the viewport, scrolling inside itself.
  const box = (await list.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(300);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  // Highlight one project, then collapse: the button shows the count and the highlighted colour.
  await list.getByRole('button', { name: 'Dự án thử 1', exact: true }).click();
  // Settings are saved debounced (300 ms); wait for the save before reloading.
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/settings') && r.request().method() === 'PUT');
  await toggle.click();
  await saved;
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(list).toBeHidden();
  await expect(toggle).toContainText('Projects (8)');
  await expect(toggle.locator('.tag-dot')).toHaveCount(1);

  // Remembered across a reload.
  await page.reload();
  await expect(page.getByTestId(TID.legendToggle)).toHaveAttribute('aria-expanded', 'false', { timeout: 15_000 });
  await page.getByTestId(TID.legendToggle).click();
  await expect(page.getByTestId(TID.legendList)).toBeVisible();
  await expect(page.getByTestId(TID.legendToggle)).toHaveAttribute('aria-expanded', 'true');
});

// Regression (2026-11-09): settings.json written before 004 has no `screensOff`; a selector returning a
// fresh `[]` for it re-rendered for ever (React #185) and left a white page.
test('settings without the 004 fields still render the office', async ({ page, request }) => {
  const auth = { authorization: `Bearer ${TOKEN}` };
  const s = (await (await request.get('/api/settings', { headers: auth })).json()) as Record<string, unknown>;
  delete s.firstRun;
  delete s.screensOff;
  delete s.legendCollapsed;
  expect((await request.put('/api/settings', { headers: auth, data: s })).ok()).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
