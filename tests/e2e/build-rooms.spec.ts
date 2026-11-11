import { expect, test, type Page } from '@playwright/test';
import { defaultLayout } from '../../src/server/services/default-layout';

// 007: build mode rooms — rotate while placing, long glass + office door, meeting rooms, wall art.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);

type Item = { id: string; type: string; pos: { x: number; z: number }; rotation: number; picture?: string };
type Emp = { conversationId: string; name: string; deskId: string | null; meetingSeatId: string | null; visible: boolean };

const project = (page: Page, x: number, z: number, y = 0) => page.evaluate(([a, b, c]) => window.__agentOffice!.project(a!, b!, c!), [x, z, y]);
const items = (page: Page) => page.evaluate(() => window.__agentOffice!.arrange().items as Item[]);
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Build mode' });

async function enterArrange(page: Page) {
  await page.getByRole('button', { name: /Build/ }).click();
  await expect(bar(page)).toBeVisible();
  await page.waitForTimeout(600);
}

/** Pick a palette item, hover the floor point, then click it. `keys` are pressed while hovering. */
async function placeAt(page: Page, type: string, x: number, z: number, keys: string[] = []) {
  const pick = page.getByTestId(`palette-${type}`);
  // Clicking the active palette item un-picks it, so only click when it is not already picked.
  if (!((await pick.getAttribute('class')) ?? '').includes('active')) await pick.click();
  const p = await project(page, x, z);
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(p.x + 1, p.y);
  for (const k of keys) await page.keyboard.press(k);
  await page.waitForTimeout(150);
  const before = (await items(page)).length;
  await page.mouse.click(p.x + 1, p.y);
  await expect.poll(async () => (await items(page)).length, { message: `${type} placed at ${x}, ${z}` }).toBeGreaterThan(before);
}

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  // The mock reset does not touch the saved layout; start every test from the default office.
  expect((await page.request.put('/api/layout', { headers: auth, data: defaultLayout() })).status()).toBe(200);
  await page.goto(`/#k=${TOKEN}`);
  await page.waitForTimeout(800);
});

test('rotate while placing: R turns the ghost and the placed item keeps that rotation', async ({ page }) => {
  await enterArrange(page);
  await page.getByTestId('palette-sofa').click();
  await expect(page.getByTestId('build-rotate-placing')).toBeVisible();
  await page.getByTestId('palette-sofa').click(); // unpick; placeAt picks it again
  const before = (await items(page)).length;
  // East of the desk rows (desks end at x = 12.5): free floor.
  await placeAt(page, 'sofa', 14.5, 6, ['r', 'r']);
  await expect.poll(async () => (await items(page)).length).toBe(before + 1);
  const sofas = (await items(page)).filter((i) => i.type === 'sofa');
  expect(sofas.at(-1)!.rotation).toBe(180);
  // The palette stays picked with the same rotation for the next one.
  const p = await project(page, 14.5, 8.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x + 1, p.y);
  await expect.poll(async () => (await items(page)).filter((i) => i.type === 'sofa').length).toBe(sofas.length + 1);
  expect((await items(page)).filter((i) => i.type === 'sofa').at(-1)!.rotation).toBe(180);
});

test('room with long glass and an office door: closed room is refused, a door makes it valid and it saves', async ({ page }) => {
  await enterArrange(page);
  const save = bar(page).getByRole('button', { name: 'Save' });
  // A 2 m × 3 m room east of the desk rows (x 14–16, z 3–6). Items are placed north → south so the tall
  // glass already placed never sits between the camera and the next click point.
  await placeAt(page, 'long_glass', 15, 3); // north side, rotation 0
  await placeAt(page, 'desk', 15, 4); // desk inside, seat towards the south
  await placeAt(page, 'long_glass', 14, 4, ['r']); // west side z 3–5, rotation 90
  await placeAt(page, 'long_glass', 14, 6); // z 5–7: closes the 1 m gap (runs past the south corner)
  await placeAt(page, 'long_glass', 15, 6, ['r', 'r', 'r']); // south side, rotation 0 → the room is closed
  await expect(bar(page).getByText('No path from the door to this desk')).toBeVisible();
  await expect(save).toBeDisabled();

  // Undo the south wall and the gap piece, put an office door in the gap, close the room again.
  for (let i = 0; i < 2; i++) await page.keyboard.press('ControlOrMeta+z');
  await placeAt(page, 'office_door', 14, 5.5, ['r']); // z 5–6, rotation 90
  await placeAt(page, 'long_glass', 15, 6, ['r', 'r', 'r']);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
  const saved: { items: Item[] } = await (await page.request.get('/api/layout', { headers: auth })).json();
  expect(saved.items.filter((i) => i.type === 'long_glass')).toHaveLength(3);
  expect(saved.items.find((i) => i.type === 'office_door')).toMatchObject({ pos: { x: 14, z: 5 }, rotation: 90 });
});

async function bodyOf(page: Page, name: string) {
  const tag = page.locator('.tag', { hasText: name }).first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  const box = (await tag.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height + 28 };
}
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}
const getEmployees = async (page: Page): Promise<Emp[]> => (await (await page.request.get('/api/employees', { headers: auth })).json()).employees;

test('meeting room: employees are dragged onto table seats, swap, survive a reload and keep their desks', async ({ page }) => {
  await expect.poll(async () => (await getEmployees(page)).filter((e) => e.visible && e.deskId).length).toBeGreaterThan(2);
  await page.waitForTimeout(1200); // let seated employees settle
  const [a, b, c] = (await getEmployees(page)).filter((e) => e.visible && e.deskId);
  await enterArrange(page);
  // An 8-seat table turned 90°, east of the desk rows: footprint x 14–15, z 3–6.
  await placeAt(page, 'meeting_table_8', 14.5, 4.5, ['r']);
  await page.keyboard.press('Escape');
  const table = (await items(page)).find((i) => i.type === 'meeting_table_8')!;
  expect(table.pos).toEqual({ x: 14, z: 3 });
  // Seat #0 (east side, north) and seat #3 (west side, north) of the turned table.
  const seat0 = await project(page, 15.375, 3.5, 0.75);
  const seat3 = await project(page, 13.625, 3.5, 0.75);
  await dragTo(page, await bodyOf(page, a!.name), seat0);
  await dragTo(page, await bodyOf(page, b!.name), seat3);
  await dragTo(page, await bodyOf(page, c!.name), seat0); // occupied by a → swap: a leaves the meeting
  const seating = await page.evaluate(() => window.__agentOffice!.arrange().meetingSeating);
  expect(seating).toEqual({ [a!.conversationId]: null, [b!.conversationId]: `${table.id}#3`, [c!.conversationId]: `${table.id}#0` });

  await bar(page).getByRole('button', { name: 'Save' }).click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  const seatOf = async (id: string) => {
    const e = (await getEmployees(page)).find((x) => x.conversationId === id)!;
    return [e.meetingSeatId, e.deskId];
  };
  await expect.poll(() => seatOf(b!.conversationId)).toEqual([`${table.id}#3`, b!.deskId]);
  await expect.poll(() => seatOf(c!.conversationId)).toEqual([`${table.id}#0`, c!.deskId]);
  // One click on an employee in the meeting still opens their chat.
  await page.waitForTimeout(4000); // walk to the table
  const body = await bodyOf(page, b!.name);
  await page.mouse.click(body.x, body.y);
  await expect(page.locator('.chat strong')).toHaveText(b!.name);
});

// A real 1 × 1 PNG (the browser decodes and re-encodes it before upload).
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('hang a photo frame and show an uploaded picture; a non-image is refused; nothing leaves 127.0.0.1', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (r) => hosts.add(new URL(r.url()).hostname));
  await enterArrange(page);
  // Inside of the west outer wall, z 6–6.5: the pointer just east of the wall → faces east.
  await placeAt(page, 'photo_frame', 0.15, 6.25);
  const frame = (await items(page)).find((i) => i.type === 'photo_frame')!;
  expect(frame).toMatchObject({ pos: { x: 0, z: 6 }, rotation: 90 });
  await page.keyboard.press('Escape'); // leave the palette
  const f = await project(page, 0.08, 6.25, 0.7); // on a cut-down wall the frame stands on its top edge
  await page.mouse.click(f.x, f.y);
  await expect(page.getByTestId('frame-change-picture')).toBeVisible();

  await page.getByTestId('frame-picture-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(bar(page).getByRole('alert')).toHaveText('Choose a PNG, JPEG or WebP image');
  await page.getByTestId('frame-picture-input').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.getByTestId('frame-reset-picture')).toBeVisible();
  const picture = (await items(page)).find((i) => i.id === frame.id)!.picture;
  expect(picture).toMatch(/^[0-9a-f]{32}\.(webp|jpg)$/);

  await bar(page).getByRole('button', { name: 'Save' }).click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  const saved: { items: Item[] } = await (await page.request.get('/api/layout', { headers: auth })).json();
  expect(saved.items.find((i) => i.id === frame.id)!.picture).toBe(picture);
  expect((await page.request.get(`/api/pictures/${picture}`, { headers: auth })).status()).toBe(200);
  expect([...hosts]).toEqual(['127.0.0.1']);
});

// 008 US1: a room east of the desk rows (x 13–16, z 3–9) whose west wall has an office door at x = 13, z 5–6.
function roomLayout(base: { items: Item[] }) {
  const add = (id: string, type: string, x: number, z: number, rotation = 0) => ({ id, type, pos: { x, z }, rotation });
  return {
    ...base,
    items: [
      ...base.items.filter((i) => i.type !== 'water_cooler'),
      add('n1', 'long_glass', 14, 3), add('n2', 'glass_wall', 13, 3), add('n3', 'glass_wall', 13.5, 3),
      add('w1', 'long_glass', 13, 3, 90), add('wd', 'office_door', 13, 5, 90), add('w2', 'long_glass', 13, 6, 90),
      add('w3', 'glass_wall', 13, 8, 90), add('w4', 'glass_wall', 13, 8.5, 90),
      add('s1', 'long_glass', 14, 9), add('s2', 'glass_wall', 13, 9), add('s3', 'glass_wall', 13.5, 9),
      add('room-desk', 'desk', 14, 4),
    ],
  };
}

test('employees open an office door, walk through, and it closes behind them', async ({ page }) => {
  await expect.poll(async () => (await getEmployees(page)).filter((e) => e.visible && e.deskId).length).toBeGreaterThan(1);
  const emp = (await getEmployees(page)).find((e) => e.visible && e.deskId)!;
  const base = await (await page.request.get('/api/layout', { headers: auth })).json();
  const put = await page.request.put('/api/layout', { headers: auth, data: { layout: roomLayout(base), seating: { [emp.conversationId]: 'room-desk' } } });
  expect(put.status()).toBe(200);
  await page.reload();
  const brainOf = () => page.evaluate((id) => window.__agentOffice?.brains().find((b) => b.id === id) ?? null, emp.conversationId);
  // Seated inside the room (world x > 13 − 16/2 = 5).
  await expect.poll(async () => { const b = await brainOf(); return !!b && b.mode === 'seated' && b.x > 5; }, { timeout: 40_000 }).toBe(true);

  // Sample every frame in the page: did the employee cross the door line (x = 5) while the door was closed?
  await page.evaluate((id) => {
    const w = window as unknown as { __doorLog: { crossedClosed: boolean; maxOpen: number; done: boolean; crossings: number } };
    w.__doorLog = { crossedClosed: false, maxOpen: 0, done: false, crossings: 0 };
    let side = 1;
    const loop = () => {
      const h = window.__agentOffice!;
      const b = h.brains().find((x) => x.id === id);
      const open = h.doors().find((d) => d.id === 'wd')?.openness ?? 0;
      w.__doorLog.maxOpen = Math.max(w.__doorLog.maxOpen, open);
      if (b) {
        const s = Math.sign(b.x - 5);
        if (s !== 0 && s !== side) {
          w.__doorLog.crossings++;
          if (open < 0.8) w.__doorLog.crossedClosed = true;
        }
        if (s !== 0) side = s;
      }
      if (!w.__doorLog.done) requestAnimationFrame(loop);
    };
    loop();
  }, emp.conversationId);

  // Move them to a desk outside the room: they must leave through the door.
  await page.request.put(`/api/employees/${emp.conversationId}/profile`, { headers: auth, data: { deskId: 'desk-1' } });
  await expect.poll(async () => { const b = await brainOf(); return !!b && b.mode === 'seated' && b.x < 5; }, { timeout: 40_000 }).toBe(true);
  await page.waitForTimeout(3000);
  const log = await page.evaluate(() => (window as unknown as { __doorLog: { crossedClosed: boolean; maxOpen: number; done: boolean; crossings: number } }).__doorLog);
  expect(log.crossings).toBe(1);
  expect(log.maxOpen).toBeGreaterThanOrEqual(0.8);
  expect(log.crossedClosed).toBe(false);
  expect((await page.evaluate(() => window.__agentOffice!.doors()))[0]!.openness).toBe(0);
});

// Same room, but the door sits between two desk rows (x = 13, z 3–4) so a first-person body (0.4 m) can reach it.
function fpRoomLayout(base: { items: Item[] }) {
  const room = roomLayout(base);
  const moved: Record<string, Item> = {
    w1: { id: 'w1', type: 'long_glass', pos: { x: 13, z: 4 }, rotation: 90 },
    wd: { id: 'wd', type: 'office_door', pos: { x: 13, z: 3 }, rotation: 90 },
    w2: { id: 'w2', type: 'long_glass', pos: { x: 13, z: 6 }, rotation: 90 },
  };
  return { ...room, items: room.items.map((i) => moved[i.id] ?? i) };
}

test('first person: E opens and closes an office door; a closed door blocks the way', async ({ page }) => {
  const base = await (await page.request.get('/api/layout', { headers: auth })).json();
  expect((await page.request.put('/api/layout', { headers: auth, data: fpRoomLayout(base) })).status()).toBe(200);
  try {
    await page.reload();
    await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(800);
    if (!(await page.locator('.crosshair').isVisible())) await page.keyboard.press('v');
    const player = () => page.evaluate(() => window.__agentOffice?.player() ?? null);
    const openness = () => page.evaluate(() => window.__agentOffice!.doors().find((d) => d.id === 'wd')!.openness);
    await expect.poll(player, { timeout: 10_000 }).not.toBeNull();
    // The door line is world x = 5, z −1…0. West of it a desk ends at x = 4.5, so stand in the gap beside
    // the door and look east and down at it.
    const face = (x: number, yaw: number, pitch: number) => page.evaluate(([x, yaw, pitch]) => window.__agentOffice!.teleportPlayer(x!, -2.5, yaw!, pitch), [x, yaw, pitch]);
    await face(4.8, Math.PI / 2, -1.1);
    await expect.poll(async () => (await player())?.aim?.action).toBe('Open door');
    await page.keyboard.press('e');
    await expect.poll(openness).toBeGreaterThanOrEqual(0.8);
    await page.keyboard.down('KeyW');
    await expect.poll(async () => (await player())!.x, { timeout: 5000 }).toBeGreaterThan(5.4);
    await page.keyboard.up('KeyW');
    // From inside: close it, then try to walk back out.
    await face(5.8, -Math.PI / 2, -0.55);
    await expect.poll(async () => (await player())?.aim?.action).toBe('Close door');
    await page.keyboard.press('e');
    await expect.poll(openness, { timeout: 5000 }).toBe(0);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    expect((await player())!.x).toBeGreaterThan(5);
  } finally {
    const settings = await (await page.request.get('/api/settings', { headers: auth })).json();
    delete settings.firstRun;
    await page.request.put('/api/settings', { headers: auth, data: { ...settings, camera: 'overview' } });
  }
});

test('008: a painting hangs on the glass façade next to the wall screen and survives a reload', async ({ page }) => {
  await enterArrange(page);
  // Just inside the north façade, west of the wall screen (x 6.5–8): the pointer is south of the line → faces in.
  await placeAt(page, 'painting', 4.25, 0.15);
  const p = (await items(page)).find((i) => i.type === 'painting')!;
  expect(p).toMatchObject({ pos: { x: 3.75, z: 0 }, rotation: 0 });
  await bar(page).getByRole('button', { name: 'Save' }).click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  const saved: { items: Item[] } = await (await page.request.get('/api/layout', { headers: auth })).json();
  expect(saved.items.find((i) => i.id === p.id)).toMatchObject({ pos: { x: 3.75, z: 0 }, rotation: 0 });
});

test('008: a frame moves 15 cm along its wall and 40 cm up with the keys, takes a typed height, and is saved', async ({ page }) => {
  await enterArrange(page);
  await placeAt(page, 'photo_frame', 0.15, 6.25); // west outer wall, z 6–6.5, facing east
  const frame = (await items(page)).find((i) => i.type === 'photo_frame')!;
  expect(frame).toMatchObject({ pos: { x: 0, z: 6 }, rotation: 90, height: 1.5 });
  await page.keyboard.press('Escape');
  const f = await project(page, 0.08, 6.25, 0.7); // on a cut-down wall the frame stands on its top edge
  await page.mouse.click(f.x, f.y);
  await expect(page.getByTestId('frame-height-input')).toBeVisible();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  const moved = (await items(page)).find((i) => i.id === frame.id)!;
  expect(moved.pos).toEqual({ x: 0, z: 6.15 });
  expect((moved as Item & { height?: number }).height).toBeCloseTo(1.9, 5);
  await page.getByTestId('frame-height-input').fill('1.2');
  await expect.poll(async () => ((await items(page)).find((i) => i.id === frame.id) as Item & { height?: number }).height).toBe(1.2);
  await bar(page).getByRole('button', { name: 'Save' }).click();
  await expect(bar(page)).toBeHidden({ timeout: 20_000 });
  await page.reload();
  const saved: { items: (Item & { height?: number })[] } = await (await page.request.get('/api/layout', { headers: auth })).json();
  expect(saved.items.find((i) => i.id === frame.id)).toMatchObject({ pos: { x: 0, z: 6.15 }, height: 1.2 });
});
