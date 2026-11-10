import { expect, test } from '@playwright/test';

// US7 / FR-070: V toggles overview ⇄ first person; the choice is remembered; build mode forces overview.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };

// These tests save "first person" as the camera; put the overview back so later specs start from it.
test.afterEach(async ({ request }) => {
  const settings = await (await request.get('/api/settings', { headers: auth })).json();
  delete settings.firstRun;
  await request.put('/api/settings', { headers: auth, data: { ...settings, camera: 'overview' } });
});

test('V switches to first person and back; the choice survives a reload', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeVisible();
  await expect(page.getByRole('button', { name: /Toàn cảnh/ })).toBeVisible();
  await page.waitForTimeout(600);
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.crosshair')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeHidden();
  await expect(page.getByRole('button', { name: /Góc nhìn thứ nhất/ })).toBeVisible();
});

test('entering build mode returns to the overview camera', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 }); // app ready (hotkeys bound)
  // The previous test may have left "first person" saved (its last toggle is saved with a debounce).
  await page.waitForTimeout(800);
  if (!(await page.locator('.crosshair').isVisible())) await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeVisible();
  await page.getByRole('button', { name: /Xây dựng/ }).click();
  await expect(page.locator('.crosshair')).toBeHidden();
  await page.getByRole('toolbar', { name: 'Chế độ xây dựng' }).getByRole('button', { name: 'Huỷ' }).click();
});

// ---- 004 US4 (FR-030…FR-036, U4-3): using things and walking out ---------------------------------

type Player = { x: number; z: number; pose: 'standing' | 'sit' | 'lie'; aim: { itemId: string; action: string } | null };
const player = (page: import('@playwright/test').Page) => page.evaluate(() => window.__agentOffice?.player() ?? null) as Promise<Player | null>;
const screensOff = async (request: import('@playwright/test').APIRequestContext) =>
  ((await (await request.get('/api/settings', { headers: auth })).json()) as { screensOff?: string[] }).screensOff ?? [];

async function enterFirstPerson(page: import('@playwright/test').Page) {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  if (!(await page.locator('.crosshair').isVisible())) await page.keyboard.press('v');
  await expect.poll(() => player(page), { timeout: 10_000 }).not.toBeNull();
}

/** Teleport in front of a layout item (world centre from the test hook) and look at it. */
async function lookAt(page: import('@playwright/test').Page, id: string, y: number, from: { dx: number; dz: number }) {
  await page.evaluate(
    ({ id, y, from }) => {
      const h = window.__agentOffice!;
      const c = h.itemWorld(id)!;
      const x = c.x + from.dx;
      const z = c.z + from.dz;
      const yaw = Math.atan2(c.x - x, c.z - z);
      const pitch = Math.atan2(y - 1.65, Math.hypot(c.x - x, c.z - z));
      h.teleportPlayer(x, z, yaw, pitch);
    },
    { id, y, from },
  );
}

const ids = async (request: import('@playwright/test').APIRequestContext) =>
  ((await (await request.get('/api/layout', { headers: auth })).json()) as { items: { id: string; type: string }[] }).items;

test('first person: screen off/on, sofa sit/lie/stand, water, plant; overview power button', async ({ page, request }) => {
  const items = await ids(request);
  const screen = items.find((i) => i.type === 'wall_screen')!.id;
  const sofa = items.find((i) => i.type === 'sofa')!.id;
  const cooler = items.find((i) => i.type === 'water_cooler')!.id;
  const plant = items.find((i) => i.type === 'plant')!.id;
  await enterFirstPerson(page);
  await expect(page.locator('.fp-help')).toContainText('dùng đồ vật');

  // Screen: on by default (it shows the quota) → E switches it off, remembered across a reload.
  await lookAt(page, screen, 1.6, { dx: 0, dz: 1.4 });
  await expect(page.getByTestId('fp-hint')).toHaveText('E — Tắt màn hình');
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/settings') && r.request().method() === 'PUT');
  await page.keyboard.press('e');
  await saved;
  expect(await screensOff(request)).toContain(screen);
  await page.reload();
  await expect.poll(() => player(page), { timeout: 15_000 }).not.toBeNull();
  await lookAt(page, screen, 1.6, { dx: 0, dz: 1.4 });
  await expect(page.getByTestId('fp-hint')).toHaveText('E — Bật màn hình');

  // Overview: the ⏻ button switches it back on.
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeHidden();
  await page.getByTestId('screen-power').first().click();
  await expect.poll(() => screensOff(request), { timeout: 5000 }).not.toContain(screen);
  await page.keyboard.press('v');
  await expect.poll(() => player(page), { timeout: 10_000 }).not.toBeNull();

  // Sofa: E sits, W stands up, Shift+E lies down, E stands up.
  await lookAt(page, sofa, 0.45, { dx: 0, dz: 1.3 });
  await expect(page.getByTestId('fp-hint')).toContainText('Ngồi');
  await page.keyboard.press('e');
  await expect.poll(async () => (await player(page))?.pose).toBe('sit');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await player(page))?.pose).toBe('standing');
  await lookAt(page, sofa, 0.45, { dx: 0, dz: 1.3 });
  await expect(page.getByTestId('fp-hint')).toContainText('Nằm');
  await page.keyboard.press('Shift+E');
  await expect.poll(async () => (await player(page))?.pose).toBe('lie');
  await page.keyboard.press('e');
  await expect.poll(async () => (await player(page))?.pose).toBe('standing');

  // Water and plant: a short effect (< 3 s), then control again.
  for (const [id, y] of [
    [cooler, 0.95],
    [plant, 0.75],
  ] as const) {
    await lookAt(page, id, y, { dx: 0, dz: -1.2 });
    if (!(await player(page))?.aim) await lookAt(page, id, y, { dx: 0, dz: 1.2 });
    if (!(await player(page))?.aim) await lookAt(page, id, y, { dx: 1.2, dz: 0 });
    if (!(await player(page))?.aim) await lookAt(page, id, y, { dx: -1.2, dz: 0 });
    await expect.poll(async () => (await player(page))?.aim?.itemId).toBe(id);
    await page.keyboard.press('e');
    await expect(page.locator('.fp-effect')).toBeVisible();
    await expect(page.locator('.fp-effect')).toBeHidden({ timeout: 3000 });
  }
});

test('first person: walks out of the door into the park, stopped by the glass', async ({ page, request }) => {
  const layout = (await (await request.get('/api/layout', { headers: auth })).json()) as { floor: { width: number; depth: number } };
  await enterFirstPerson(page);
  // Start position is the lobby just inside the (south) door; face the door and walk.
  const start = (await player(page))!;
  await page.evaluate(({ x, z }) => window.__agentOffice!.teleportPlayer(x, z, 0), start);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await player(page))!.z, { timeout: 8000 }).toBeGreaterThan(layout.floor.depth / 2 + 1.5);
  await page.keyboard.up('KeyW');
  // Through the north glass façade: no way.
  await page.evaluate(({ d }) => window.__agentOffice!.teleportPlayer(0, -d / 2 + 0.6, Math.PI), { d: layout.floor.depth });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  expect((await player(page))!.z).toBeGreaterThan(-layout.floor.depth / 2);
});

// T063 / SC-006: walk from the lobby to the nearest park shop on the door's side and back, ≤ 2 minutes.
test('first person: walk to a park shop and back within 2 minutes', async ({ page }) => {
  test.setTimeout(180_000);
  await enterFirstPerson(page);
  const start = (await player(page))!;
  const shops = await page.evaluate(() => window.__agentOffice!.shops());
  // The default door is on the south side (+z): pick the nearest shop with z > 0.
  const shop = shops.filter((s) => s.z > 0).sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z))[0]!;
  // Stand 2 m in front of the shop, on the office side.
  const len = Math.hypot(shop.x, shop.z);
  const front = { x: shop.x - (shop.x / len) * 2.2, z: shop.z - (shop.z / len) * 2.2 };
  const doorstep = { x: start.x, z: start.z + 3 };
  const t0 = Date.now();
  async function walkTo(target: { x: number; z: number }, near = 0.6) {
    await page.keyboard.down('KeyW');
    try {
      for (let i = 0; i < 600; i++) {
        const p = (await player(page))!;
        if (Math.hypot(target.x - p.x, target.z - p.z) < near) return true;
        await page.evaluate(({ p, t }) => window.__agentOffice!.teleportPlayer(p.x, p.z, Math.atan2(t.x - p.x, t.z - p.z)), { p, t: target });
        await page.waitForTimeout(100);
      }
      return false;
    } finally {
      await page.keyboard.up('KeyW');
    }
  }
  expect(await walkTo(doorstep), 'out of the door').toBe(true);
  expect(await walkTo(front, 0.8), `to the ${shop.id}`).toBe(true);
  expect(await walkTo(doorstep), 'back to the door').toBe(true);
  expect(await walkTo(start), 'back inside').toBe(true);
  expect(Date.now() - t0).toBeLessThanOrEqual(120_000);
});

