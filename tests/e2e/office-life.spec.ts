import { expect, test, type Page } from '@playwright/test';

// 004 US3 (FR-020…FR-025, SC-004, SC-005): idle employees drink water, rest on the sofa and go out to the
// park shops; at most a third are outside; nobody overlaps or gets stuck; work calls them back running.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const PORT = Number(process.env.E2E_PORT ?? 4399);
const ctl = (a: string) => fetch(`http://127.0.0.1:${PORT + 1}/${a}`);

type BrainInfo = { id: string; mode: string; activity: string | null; x: number; z: number; outside: boolean };
const brains = (page: Page) => page.evaluate(() => window.__agentOffice!.brains()) as Promise<BrainInfo[]>;

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  // Dry weather: rain keeps everyone inside (FR-029), and the real forecast must not decide the test.
  await page.route('**/api/weather**', (r) =>
    r.fulfill({ json: { city: 'hanoi', condition: 'clear', isDay: true, temperatureC: 28, fetchedAt: new Date().toISOString(), source: 'open-meteo' } }),
  );
});

test('breaks: water, sofa and shop; outing cap; no overlap, nobody stuck; work calls them back', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/#k=${TOKEN}`);
  await expect.poll(async () => (await page.evaluate(() => window.__agentOffice?.brains().length ?? 0)), { timeout: 30_000 }).toBeGreaterThanOrEqual(6);
  await page.evaluate(() => window.__agentOffice!.setBreakInterval(6000));

  const seen = new Set<string>();
  const still = new Map<string, { x: number; z: number; since: number }>();
  let outsider: BrainInfo | null = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000 && !(seen.has('water') && seen.has('sofa') && seen.has('shop') && outsider)) {
    const list = await brains(page);
    const cap = Math.max(1, Math.floor(list.length / 3));
    expect(list.filter((b) => b.outside).length, 'outing cap (FR-024)').toBeLessThanOrEqual(cap);
    for (const b of list) {
      if (b.activity) seen.add(b.activity);
      // Walking somewhere but standing still > 5 s = stuck (SC-004).
      const moving = b.mode === 'walking' || b.mode === 'outing';
      const prev = still.get(b.id);
      if (moving && prev && Math.hypot(prev.x - b.x, prev.z - b.z) < 0.05) {
        expect(Date.now() - prev.since, `${b.id} stuck`).toBeLessThan(5000);
      } else still.set(b.id, { x: b.x, z: b.z, since: Date.now() });
      if (!moving) still.delete(b.id);
      if (b.mode === 'resting' && b.outside) outsider = b;
    }
    // Nobody stands inside anybody (people at a desk or resting are seated and may be closer).
    const walkers = list.filter((b) => b.mode === 'walking' || b.mode === 'outing');
    for (let i = 0; i < walkers.length; i++)
      for (let j = i + 1; j < walkers.length; j++)
        expect(Math.hypot(walkers[i]!.x - walkers[j]!.x, walkers[i]!.z - walkers[j]!.z), 'overlap').toBeGreaterThanOrEqual(0.3);
    await page.waitForTimeout(500);
  }
  expect([...seen]).toEqual(expect.arrayContaining(['water', 'sofa', 'shop']));
  expect(outsider, 'someone rested at a shop').not.toBeNull();

  // Work arrives while at the shop: badge ≤ 2 s (plus the server's 2-poll debounce), at the desk ≤ 30 s.
  const id = outsider!.id;
  const emps = (await (await fetch(`http://127.0.0.1:${PORT}/api/employees`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()) as {
    employees: { conversationId: string; name: string }[];
  };
  const name = emps.employees.find((e) => e.conversationId === id)!.name;
  await ctl(`run/${id}`);
  const started = Date.now();
  // T065: the badge above the head changes wherever they are (≤ 2 s, plus the server's 2-poll debounce).
  await expect(page.locator('.tag', { hasText: name }).locator('.tag-badge')).toBeVisible({ timeout: 2500 });
  await expect.poll(async () => (await brains(page)).find((b) => b.id === id)?.mode, { timeout: 4000, intervals: [200] }).not.toBe('resting');
  await expect.poll(async () => (await brains(page)).find((b) => b.id === id)?.mode, { timeout: 30_000, intervals: [500] }).toBe('seated');
  expect(Date.now() - started).toBeLessThanOrEqual(32_000);
});

// T063 / FR-025: one click on an employee sitting at a park shop opens the chat (overview camera).
test('clicking an employee at a park shop opens the chat', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto(`/#k=${TOKEN}`);
  await expect.poll(async () => (await page.evaluate(() => window.__agentOffice?.brains().length ?? 0)), { timeout: 30_000 }).toBeGreaterThanOrEqual(6);
  await page.evaluate(() => window.__agentOffice!.setBreakInterval(5000));
  const vp = page.viewportSize()!;
  // Zoom the overview camera out so the shops around the park are on screen.
  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(100);
  }
  const floor = (await (await fetch(`http://127.0.0.1:${PORT}/api/layout`, { headers: { authorization: `Bearer ${TOKEN}` } })).json()) as { floor: { width: number; depth: number } };
  let clicked: string | null = null;
  const t0 = Date.now();
  while (!clicked && Date.now() - t0 < 150_000) {
    for (const b of await brains(page)) {
      if (b.mode !== 'resting' || !b.outside) continue;
      const pt = await page.evaluate(({ x, z }) => window.__agentOffice!.project(x, z, 0.7), { x: b.x + floor.floor.width / 2, z: b.z + floor.floor.depth / 2 });
      if (pt.x < 40 || pt.y < 80 || pt.x > vp.width - 40 || pt.y > vp.height - 40) continue;
      const steps = page.waitForRequest((r) => r.url().includes(`/api/conversations/${b.id}/steps`), { timeout: 3000 }).catch(() => null);
      await page.mouse.click(pt.x, pt.y);
      if (await steps) {
        clicked = b.id;
        break;
      }
      await page.keyboard.press('Escape');
    }
    if (!clicked) await page.waitForTimeout(500);
  }
  expect(clicked, 'an employee at a shop was clicked and its chat opened').not.toBeNull();
  await expect(page.locator('.chat')).toBeVisible();
});
