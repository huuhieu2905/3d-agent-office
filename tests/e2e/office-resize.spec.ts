import { expect, test, type Page } from '@playwright/test';
import { TID } from './testids';

// 002 US4 / T050 / FR-022..027 / U-4: choose the office length and width in arrange mode.


const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
type Layout = { floor: { width: number; depth: number }; items: { id: string; type: string; pos: { x: number; z: number } }[] };

const getLayout = async (page: Page): Promise<Layout> => (await page.request.get('/api/layout', { headers: auth })).json();
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Build mode' });
async function enterArrange(page: Page) {
  await page.getByTestId(TID.buildToggle).click();
  await expect(bar(page)).toBeVisible();
  await page.waitForTimeout(500);
}
async function save(page: Page) {
  await bar(page).getByRole('button', { name: 'Save' }).click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  // Start every test from the default 16 × 12 m office.
  const l = await getLayout(page);
  if (l.floor.width !== 16 || l.floor.depth !== 12) await page.request.put('/api/layout', { headers: auth, data: { ...l, floor: { width: 16, depth: 12 } } });
  await page.goto(`/#k=${TOKEN}`);
  await page.waitForTimeout(1500);
});

test('typing 24 × 18 grows the office at once; saved and kept after a reload, furniture untouched', async ({ page }) => {
  const before = await getLayout(page);
  await enterArrange(page);
  await page.getByTestId(TID.floorWidthInput).fill('24');
  await page.getByTestId(TID.floorDepthInput).fill('18');
  await save(page);
  const after = await getLayout(page);
  expect(after.floor).toEqual({ width: 24, depth: 18 });
  expect(after.items.map((i) => i.pos)).toEqual(before.items.map((i) => i.pos));
  await page.reload();
  await enterArrange(page);
  await expect(page.getByTestId(TID.floorWidthInput)).toHaveValue('24');
  await expect(page.getByTestId(TID.floorDepthInput)).toHaveValue('18');
});

test('dragging the east handle by about 3 m shows the new size and applies it', async ({ page }) => {
  await enterArrange(page);
  const from = await page.evaluate(() => window.__agentOffice!.project(16, 6, 0.15));
  const to = await page.evaluate(() => window.__agentOffice!.project(19, 6, 0.15));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await expect(page.locator('.size-label')).toHaveText(/19 × 12 m/);
  await page.mouse.up();
  await expect(page.getByTestId(TID.floorWidthInput)).toHaveValue('19');
  await save(page);
  expect((await getLayout(page)).floor).toEqual({ width: 19, depth: 12 });
});

test('5 m or 41 m is refused with a clear message and the office does not change', async ({ page }) => {
  await enterArrange(page);
  await page.getByTestId(TID.floorWidthInput).fill('5');
  await expect(bar(page).getByRole('alert')).toHaveText(/6–40 m, in 0\.5 m steps/);
  await page.getByTestId(TID.floorWidthInput).fill('41');
  await expect(bar(page).getByRole('alert')).toHaveText(/6–40 m, in 0\.5 m steps/);
  await save(page);
  expect((await getLayout(page)).floor).toEqual({ width: 16, depth: 12 });
});

test('shrinking past the furniture is blocked and the items in the way are named', async ({ page }) => {
  await enterArrange(page);
  await page.getByTestId(TID.floorWidthInput).fill('14');
  await expect(bar(page).getByText(/Can't shrink: \d+ item\(s\) in the way/)).toBeVisible();
  await bar(page).getByText(/Can't shrink/).click();
  expect((await page.evaluate(() => window.__agentOffice!.arrange())).selectedId).toBeTruthy();
  await save(page);
  expect((await getLayout(page)).floor).toEqual({ width: 16, depth: 12 });
  // The API refuses it too (L2-2).
  const l = await getLayout(page);
  const res = await page.request.put('/api/layout', { headers: auth, data: { layout: { ...l, floor: { width: 14, depth: 12 } } } });
  expect(res.status()).toBe(422);
  expect((await res.json()).error.code).toBe('FLOOR_TOO_SMALL');
});
