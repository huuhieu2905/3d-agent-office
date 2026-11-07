import { expect, test, type Page } from '@playwright/test';

// 002 US2 / T029 — written first to reproduce the drag & drop bugs (R2-02):
// in arrange mode an object is selected by a click and dragged to any spot (0.05 m), an employee is
// pressed and dragged onto a desk (also a desk placed in the draft, before saving); outside arrange mode
// nothing can be dragged and one click still opens the chat.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);

declare global {
  interface Window {
    __agentOffice?: {
      project(x: number, z: number, y?: number): { x: number; y: number };
      arrange(): { active: boolean; selectedId: string | null; drag: unknown; seating: Record<string, string | null>; past: number };
    };
  }
}

type Item = { id: string; type: string; pos: { x: number; z: number }; rotation: number };
type Layout = { floor: { width: number; depth: number }; items: Item[] };
type Emp = { conversationId: string; name: string; deskId: string | null; visible: boolean };

const project = (page: Page, x: number, z: number, y = 0) => page.evaluate(([a, b, c]) => window.__agentOffice!.project(a!, b!, c!), [x, z, y]);

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, opts: { release?: boolean } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  if (opts.release !== false) await page.mouse.up();
}

async function getLayout(page: Page): Promise<Layout> {
  return (await page.request.get('/api/layout', { headers: auth })).json();
}
async function getEmployees(page: Page): Promise<Emp[]> {
  return (await (await page.request.get('/api/employees', { headers: auth })).json()).employees;
}
async function enterArrange(page: Page) {
  await page.getByRole('button', { name: /Xây dựng/ }).click();
  await expect(page.getByRole('toolbar', { name: 'Chế độ xây dựng' })).toBeVisible();
  await page.waitForTimeout(600);
}
async function save(page: Page) {
  const bar = page.getByRole('toolbar', { name: 'Chế độ xây dựng' });
  await bar.getByRole('button', { name: 'Lưu' }).click();
  await expect(bar).toBeHidden({ timeout: 20_000 }); // the PUT has completed (headless frames can be slow)
}
const centre = (it: Item) => ({ x: it.pos.x + (it.type === 'desk' ? 0.75 : 0.25), z: it.pos.z + (it.type === 'desk' ? 0.5 : 0.25) });
/** Where to press a desk: its back half (monitor side); a seated employee covers the front half. */
const grip = (it: Item) => ({ x: it.pos.x + 0.75, z: it.pos.z + 0.15 });

async function bodyOf(page: Page, name: string) {
  const tag = page.locator('.tag', { hasText: name }).first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  const box = (await tag.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height + 28 };
}

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  await page.goto(`/#k=${TOKEN}`);
  await expect.poll(async () => (await getEmployees(page)).filter((e) => e.deskId).length).toBeGreaterThan(1);
  await page.waitForTimeout(1200); // let seated employees settle
});

test('a desk is selected by a click and dragged off the old grid; the spot is saved', async ({ page }) => {
  const before = await getLayout(page);
  const desk = before.items.find((i) => i.type === 'desk')!;
  await enterArrange(page);
  const c = grip(desk);
  const target = { x: c.x, z: c.z + 0.25 }; // 0.25 m south: impossible on the old 0.5 m grid
  // Move it into the free aisle south of the desk row, a quarter metre at a time is enough to prove 0.05 m.
  await drag(page, await project(page, c.x, c.z, 0.76), await project(page, target.x, target.z, 0.76));
  await save(page);
  await expect(page.getByRole('toolbar', { name: 'Chế độ xây dựng' })).toBeHidden();
  const after = (await getLayout(page)).items.find((i) => i.id === desk.id)!;
  expect(Math.abs(after.pos.x - desk.pos.x)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(after.pos.z - (desk.pos.z + 0.25))).toBeLessThanOrEqual(0.05);
});

test('dropping a desk on another object puts it back', async ({ page }) => {
  const before = await getLayout(page);
  const [a, b] = before.items.filter((i) => i.type === 'desk');
  await enterArrange(page);
  await drag(page, await project(page, grip(a!).x, grip(a!).z, 0.76), await project(page, grip(b!).x, grip(b!).z, 0.76));
  await save(page);
  const after = (await getLayout(page)).items.find((i) => i.id === a!.id)!;
  expect(after.pos).toEqual(a!.pos);
});

test('an employee dragged onto a free desk sits there; onto an occupied desk the two swap', async ({ page }) => {
  const layout = await getLayout(page);
  const emps = (await getEmployees(page)).filter((e) => e.visible && e.deskId);
  const used = new Set(emps.map((e) => e.deskId));
  const free = layout.items.find((i) => i.type === 'desk' && !used.has(i.id))!;
  const [first, second] = emps;
  await enterArrange(page);
  await drag(page, await bodyOf(page, first!.name), await project(page, centre(free).x, centre(free).z, 0.76));
  await save(page);
  await expect.poll(async () => (await getEmployees(page)).find((e) => e.conversationId === first!.conversationId)!.deskId).toBe(free.id);

  await page.waitForTimeout(2500); // walk to the new desk
  await enterArrange(page);
  const secondDesk = layout.items.find((i) => i.id === second!.deskId)!;
  await drag(page, await bodyOf(page, first!.name), await project(page, centre(secondDesk).x, centre(secondDesk).z, 0.76));
  await save(page);
  await expect
    .poll(async () => {
      const list = await getEmployees(page);
      return [list.find((e) => e.conversationId === first!.conversationId)!.deskId, list.find((e) => e.conversationId === second!.conversationId)!.deskId];
    })
    .toEqual([second!.deskId, free.id]);
});

test('an employee can be seated at a desk placed in the draft, before saving', async ({ page }) => {
  const emp = (await getEmployees(page)).find((e) => e.visible && e.deskId)!;
  await enterArrange(page);
  await page.getByRole('toolbar', { name: 'Chế độ xây dựng' }).getByRole('button', { name: 'Bàn làm việc' }).click();
  // An empty spot in the south-east corner of the default office.
  const spot = await project(page, 12, 10.4, 0);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  await page.keyboard.press('Escape'); // leave the palette
  await expect.poll(async () => page.evaluate(() => document.querySelector('.build')?.textContent ?? '')).not.toContain('Đang lưu');
  await drag(page, await bodyOf(page, emp.name), await project(page, 12, 10.6, 0.76));
  await save(page);
  const layout = await getLayout(page);
  const newDesk = layout.items.find((i) => i.type === 'desk' && Math.abs(i.pos.x + 0.75 - 12) < 0.6 && i.pos.z > 9.5)!;
  expect(newDesk).toBeTruthy();
  await expect.poll(async () => (await getEmployees(page)).find((e) => e.conversationId === emp.conversationId)!.deskId).toBe(newDesk.id);
});

test('dropping an employee on the floor, or pressing Esc mid-drag, changes nothing', async ({ page }) => {
  const emp = (await getEmployees(page)).find((e) => e.visible && e.deskId)!;
  const desk = (await getLayout(page)).items[0]!;
  await enterArrange(page);
  await drag(page, await bodyOf(page, emp.name), await project(page, 15, 6.6, 0));
  await drag(page, await project(page, grip(desk).x, grip(desk).z, 0.76), await project(page, 15, 6.6, 0.76), { release: false });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await save(page);
  expect((await getEmployees(page)).find((e) => e.conversationId === emp.conversationId)!.deskId).toBe(emp.deskId);
  expect((await getLayout(page)).items.find((i) => i.id === desk.id)!.pos).toEqual(desk.pos);
});

test('outside arrange mode nothing is dragged and one click opens the chat', async ({ page }) => {
  const emp = (await getEmployees(page)).find((e) => e.visible && e.deskId)!;
  const before = await getLayout(page);
  const desk = before.items.find((i) => i.type === 'desk')!;
  await drag(page, await bodyOf(page, emp.name), await project(page, 15, 6.6, 0));
  await drag(page, await project(page, grip(desk).x, grip(desk).z, 0.76), await project(page, 15, 6.6, 0.76));
  expect((await getEmployees(page)).find((e) => e.conversationId === emp.conversationId)!.deskId).toBe(emp.deskId);
  expect((await getLayout(page)).items.find((i) => i.id === desk.id)!.pos).toEqual(desk.pos);
  await page.keyboard.press('Escape');
  const body = await bodyOf(page, emp.name);
  await page.mouse.click(body.x, body.y);
  await expect(page.locator('.chat strong')).toHaveText(emp.name);
});
