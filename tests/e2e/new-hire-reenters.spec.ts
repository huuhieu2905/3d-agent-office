import { expect, test, type Page } from '@playwright/test';
import { defaultLayout } from '../../src/server/services/default-layout';

// Bug new-hire-reenters-door: an employee who arrived after page load walked in from the door again every
// time the office grid was rebuilt (entering build mode, every draft edit). They must stay seated.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);

type Emp = { conversationId: string; deskId: string | null; visible: boolean };
type BrainInfo = { id: string; mode: string; x: number; z: number };
const brainOf = (page: Page, id: string) =>
  page.evaluate((i) => window.__agentOffice?.brains().find((b) => b.id === i) ?? null, id) as Promise<BrainInfo | null>;
const getEmployees = async (page: Page): Promise<Emp[]> => (await (await page.request.get('/api/employees', { headers: auth })).json()).employees;

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  expect((await page.request.put('/api/layout', { headers: auth, data: defaultLayout() })).status()).toBe(200);
  // Dry weather so nobody is kept inside or sent out by the real forecast.
  await page.route('**/api/weather**', (r) =>
    r.fulfill({ json: { city: 'hanoi', condition: 'clear', isDay: true, temperatureC: 28, fetchedAt: new Date().toISOString(), source: 'open-meteo' } }),
  );
});

test.afterEach(async () => {
  await ctl('reset');
});

test('an employee who arrived this session stays seated when build mode opens', async ({ page }) => {
  test.setTimeout(120_000);
  await expect.poll(async () => (await getEmployees(page)).filter((e) => e.visible && e.deskId).length).toBeGreaterThan(1);
  const id = (await getEmployees(page)).find((e) => e.visible && e.deskId)!.conversationId;

  // Hidden at page load, shown afterwards: this employee is a new arrival (walks in from the door).
  await ctl(`hide/${id}`);
  await expect.poll(async () => (await getEmployees(page)).some((e) => e.conversationId === id), { timeout: 20_000 }).toBe(false);
  await page.goto(`/#k=${TOKEN}`);
  await expect.poll(async () => (await page.evaluate(() => window.__agentOffice?.brains().length ?? 0)), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.__agentOffice!.setBreakInterval(10 * 60_000)); // no breaks during the test
  expect(await brainOf(page, id)).toBeNull();

  await ctl(`show/${id}`);
  await expect.poll(async () => (await brainOf(page, id))?.mode, { timeout: 20_000 }).toBe('entering');
  await expect.poll(async () => (await brainOf(page, id))?.mode, { timeout: 40_000, intervals: [500] }).toBe('seated');
  const seated = (await brainOf(page, id))!;

  // Build mode swaps in the draft layout → new grid → new brain. It must start seated, not at the door.
  await page.getByRole('button', { name: /Build/ }).click();
  await expect(page.getByRole('toolbar', { name: 'Build mode' })).toBeVisible();
  for (let i = 0; i < 10; i++) {
    const b = (await brainOf(page, id))!;
    expect(b.mode).toBe('seated');
    expect(Math.hypot(b.x - seated.x, b.z - seated.z)).toBeLessThan(0.5);
    await page.waitForTimeout(150);
  }
});
