import { expect, test } from '@playwright/test';

// US5 / FR-050..054: layout save with validation, seat changes, build mode toolbar.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
});

test('a valid layout is saved and survives reload; an invalid one is refused with the culprit', async ({ request }) => {
  const layout = await (await request.get('/api/layout', { headers: auth })).json();
  const plus = { ...layout, items: [...layout.items, { id: 'plant-e2e', type: 'plant', cell: { x: 3, z: 21 }, rotation: 0 }] };
  expect((await request.put('/api/layout', { headers: auth, data: plus })).status()).toBe(200);
  const again = await (await request.get('/api/layout', { headers: auth })).json();
  expect(again.items.some((i: { id: string }) => i.id === 'plant-e2e')).toBe(true);

  const desk = layout.items.find((i: { type: string }) => i.type === 'desk');
  const bad = { ...layout, items: [...layout.items, { id: 'on-desk', type: 'plant', cell: desk.cell, rotation: 0 }] };
  const res = await request.put('/api/layout', { headers: auth, data: bad });
  expect(res.status()).toBe(422);
  expect((await res.json()).invalidItems).toContain('on-desk');
});

test('moving an employee to an occupied desk swaps the two', async ({ request }) => {
  await expect.poll(async () => (await (await request.get('/api/employees', { headers: auth })).json()).employees.length).toBeGreaterThan(1);
  const { employees } = await (await request.get('/api/employees', { headers: auth })).json();
  const [a, b] = employees.filter((e: { deskId: string | null }) => e.deskId);
  await request.put(`/api/employees/${a.conversationId}/profile`, { headers: auth, data: { deskId: b.deskId } });
  await expect
    .poll(async () => {
      const list = (await (await request.get('/api/employees', { headers: auth })).json()).employees as { conversationId: string; deskId: string }[];
      const na = list.find((e) => e.conversationId === a.conversationId)!;
      const nb = list.find((e) => e.conversationId === b.conversationId)!;
      return [na.deskId, nb.deskId];
    })
    .toEqual([b.deskId, a.deskId]);
});

test('build mode opens a toolbar with the furniture palette and can be cancelled', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await page.getByRole('button', { name: /Xây dựng/ }).click();
  const bar = page.getByRole('toolbar', { name: 'Chế độ xây dựng' });
  await expect(bar.getByRole('button', { name: 'Bàn làm việc' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Vách kính' })).toBeVisible();
  await bar.getByRole('button', { name: 'Huỷ' }).click();
  await expect(bar).toBeHidden();
});
