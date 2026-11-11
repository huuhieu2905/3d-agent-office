import { expect, test, type Page } from '@playwright/test';
import { defaultLayout, desks } from '../../src/server/services/default-layout';
import { TID } from './testids';

// 009 (contracts/ui.md, contracts/api.md): hire an existing conversation, the 20-member office, remove from office.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const PORT = Number(process.env.E2E_PORT ?? 4399);
const auth = { authorization: `Bearer ${TOKEN}` };
const PROJECT = 'a7e11e00-1106-4000-8000-000000000001';
const ctl = (a: string) => fetch(`http://127.0.0.1:${PORT + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string }[];
const add = (id: string, title: string) => ctl(`add/${id}/${PROJECT}/${encodeURIComponent(title)}`);

type Emp = { conversationId: string; name: string; visible: boolean; isSubagent: boolean; deskId: string | null; visualState: string };
const employees = async (page: Page): Promise<Emp[]> => (await (await page.request.get('/api/employees', { headers: auth })).json()).employees;
const members = async (page: Page) => (await employees(page)).filter((e) => e.visible && !e.isSubagent).length;
const isVisible = async (page: Page, id: string) => (await employees(page)).find((e) => e.conversationId === id)?.visible ?? false;

async function openHire(page: Page) {
  await page.getByRole('button', { name: '+ Hire employee' }).click();
  const hire = page.getByRole('dialog', { name: 'Hire a new employee' });
  await hire.getByLabel('Project').selectOption(PROJECT);
  return hire;
}

/** Fill the office to 20 members by joining conversations added to the "App". */
async function fillOffice(page: Page) {
  const missing = 20 - (await members(page));
  for (let i = 0; i < missing; i++) {
    await add(`e2e-fill-${i}`, `[test-009] fill ${i}`);
  }
  await expect.poll(async () => (await employees(page)).filter((e) => e.conversationId.startsWith('e2e-fill-')).length).toBe(missing);
  for (let i = 0; i < missing; i++) {
    expect((await page.request.post(`/api/conversations/e2e-fill-${i}/join`, { headers: auth, data: {} })).status()).toBe(200);
  }
  await expect.poll(() => members(page)).toBe(20);
}

test.beforeEach(async ({ page }) => {
  await ctl('open');
  await ctl('reset');
  await page.goto(`/#k=${TOKEN}`);
});

test.afterEach(async () => {
  await ctl('reset');
});

test('US1: rehire an existing conversation — chat opens, employee walks in, nothing created in the App', async ({ page }) => {
  await add('e2e-old-1', '[test-009] old work');
  const hire = await openHire(page);
  await expect(hire.getByTestId(TID.hireModeNew)).toHaveAttribute('aria-checked', 'true');
  await hire.getByTestId(TID.hireModeExisting).click();
  await expect(hire.locator('textarea')).toHaveCount(0);
  const item = hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] old work' });
  await expect(item).not.toContainText('in the office');
  await item.click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect(hire).toBeHidden();
  await expect(page.locator('.chat')).toContainText('[test-009] old work');
  await expect.poll(() => isVisible(page, 'e2e-old-1'), { timeout: 2_000 }).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.__agentOffice?.brains().some((b) => b.id === 'e2e-old-1') ?? false), { timeout: 20_000 }).toBe(true);
  expect((await sent()).some((s) => s.method === 'StartCascade' || s.method === 'SendUserCascadeMessage')).toBe(false);
});

test('US1/AC5: hiring an existing conversation from an empty desk seats it at that desk', async ({ page }) => {
  expect((await page.request.put('/api/layout', { headers: auth, data: defaultLayout() })).status()).toBe(200);
  await add('e2e-desk', '[test-009] at a desk');
  const taken = new Set((await employees(page)).map((e) => e.deskId));
  const free = desks(defaultLayout()).map((d) => d.id).find((id) => !taken.has(id))!;
  await expect.poll(() => page.evaluate(() => !!window.__agentOffice)).toBe(true);
  await page.evaluate((d) => window.__agentOffice!.openHireAtDesk(d), free);
  const hire = page.getByRole('dialog', { name: 'Hire a new employee' });
  await hire.getByLabel('Project').selectOption(PROJECT);
  await hire.getByTestId(TID.hireModeExisting).click();
  await hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] at a desk' }).click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect.poll(async () => (await employees(page)).find((e) => e.conversationId === 'e2e-desk')?.deskId).toBe(free);
});

test('US1: picking a conversation already in the office only opens its chat', async ({ page }) => {
  const before = await members(page);
  const hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  const item = hire.getByTestId(TID.hireConversationItem).filter({ hasText: 'in the office' }).first();
  await item.click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect(page.locator('.chat')).toBeVisible();
  expect(await members(page)).toBe(before);
});

test('US2: New is the default and keeps the typed task and model across a mode switch', async ({ page }) => {
  const hire = await openHire(page);
  await hire.locator('textarea').fill('[test-009] task');
  await expect(hire.locator('.model-picker select')).not.toHaveValue('');
  const model = await hire.locator('.model-picker select').inputValue();
  await hire.getByTestId(TID.hireModeExisting).click();
  await hire.getByTestId(TID.hireModeNew).click();
  await expect(hire.locator('textarea')).toHaveValue('[test-009] task');
  await expect(hire.locator('.model-picker select')).toHaveValue(model);
  await expect(hire.getByTestId(TID.hireOfficeCount)).toContainText(`${await members(page)}/20 in the office`);
});

test('US3: a conversation created in the App does not enter the office, but is listed', async ({ page }) => {
  await add('e2e-app-made', '[test-009] made in the App');
  await expect.poll(async () => (await employees(page)).some((e) => e.conversationId === 'e2e-app-made')).toBe(true);
  expect(await isVisible(page, 'e2e-app-made')).toBe(false);
  const hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  await expect(hire.getByTestId(TID.hireConversationList)).toContainText('[test-009] made in the App');
});

test('US3: a full office sends the idle member inactive the longest out; they can be hired back', async ({ page }) => {
  await fillOffice(page);
  await add('e2e-extra', '[test-009] extra');
  // The two oldest members are recorded fixture conversations; keep the oldest busy so the next one is chosen.
  const OLDEST = '77ea14f4-bdc6-403f-bdb5-c637f3d2a5fb';
  const NEXT = 'a7e11e00-1106-4000-8000-000000000002';
  await ctl(`run/${OLDEST}`);
  await expect.poll(async () => (await employees(page)).find((e) => e.conversationId === OLDEST)?.visualState).toBe('working');
  const leaver = (await employees(page)).find((e) => e.conversationId === NEXT)!;

  let hire = await openHire(page);
  await expect(hire.getByTestId(TID.hireOfficeFull)).toContainText(`The office is full (20/20). Hiring will send ${leaver.name} (last active`);
  await hire.getByTestId(TID.hireModeExisting).click();
  await hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] extra' }).click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect(hire).toBeHidden();
  await expect.poll(() => isVisible(page, 'e2e-extra')).toBe(true);
  await expect.poll(() => isVisible(page, NEXT)).toBe(false);
  expect(await isVisible(page, OLDEST)).toBe(true);
  expect(await members(page)).toBe(20);
  expect((await sent()).some((s) => s.method === 'DeleteCascadeTrajectory' || s.method === 'StartCascade')).toBe(false);

  // Hire them back: they return, and someone else makes room.
  await page.locator('.chat').getByRole('button', { name: 'Close' }).click();
  hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  const back = hire.getByTestId(TID.hireConversationItem).filter({ hasText: leaver.name });
  await expect(back).not.toContainText('in the office');
  await back.click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect.poll(() => isVisible(page, NEXT)).toBe(true);
  expect(await members(page)).toBe(20);
});

test('US3: when all 20 members are busy, hiring is blocked and the API answers 409', async ({ page }) => {
  await fillOffice(page);
  await add('e2e-extra', '[test-009] extra');
  await ctl('running');
  await expect.poll(async () => (await employees(page)).filter((e) => e.visible && e.visualState === 'working').length).toBe(20);
  const hire = await openHire(page);
  await expect(hire.getByTestId(TID.hireOfficeFull)).toContainText('The office is full (20/20) and everyone is busy.');
  await hire.locator('textarea').fill('[test-009] full');
  await expect(hire.getByRole('button', { name: 'Hire' })).toBeDisabled();
  await hire.getByTestId(TID.hireModeExisting).click();
  await hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] extra' }).click();
  await expect(hire.getByRole('button', { name: 'Hire' })).toBeDisabled();
  await hire.getByTestId(TID.hireConversationItem).filter({ hasText: 'in the office' }).first().click();
  await expect(hire.getByRole('button', { name: 'Hire' })).toBeEnabled();
  const res = await page.request.post('/api/conversations', { headers: auth, data: { parts: [{ text: '[test-009] full' }], model: 'M', projectId: PROJECT } });
  expect(res.status()).toBe(409);
  expect((await sent()).some((s) => s.method === 'StartCascade')).toBe(false);
});

test('FR-018: with 20 members a subagent is hidden but listed under "+N more" and opens its chat', async ({ page }) => {
  await fillOffice(page);
  await add('e2e-sub', '[test-009] subagent');
  await ctl('parent/e2e-sub/e2e-fill-0');
  await add('e2e-outsider', '[test-009] outsider');
  await expect.poll(async () => (await employees(page)).find((e) => e.conversationId === 'e2e-sub')?.isSubagent).toBe(true);
  expect(await isVisible(page, 'e2e-sub')).toBe(false);
  const more = page.getByRole('button', { name: /\+1 more employees/ });
  await more.click();
  await expect(page.locator('.overflow')).not.toContainText('[test-009] outsider');
  await page.locator('.overflow').getByRole('button', { name: /\[test-009\] subagent/ }).click();
  await expect(page.locator('.chat')).toContainText('[test-009] subagent');
});

test('US4: Remove from office keeps the conversation and frees the place', async ({ page }) => {
  await add('e2e-rm', '[test-009] to remove');
  let hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  await hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] to remove' }).click();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect.poll(() => isVisible(page, 'e2e-rm')).toBe(true);
  const before = await members(page);
  await page.getByTestId(TID.chatRemoveFromOffice).click();
  await expect(page.locator('.chat')).toBeHidden();
  await expect.poll(() => isVisible(page, 'e2e-rm')).toBe(false);
  expect(await members(page)).toBe(before - 1);
  expect((await sent()).some((s) => s.method === 'DeleteCascadeTrajectory')).toBe(false);
  hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  await expect(hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] to remove' })).not.toContainText('in the office');
});

test('US5: gone conversation, App not connected, empty project, filter', async ({ page }) => {
  for (let i = 0; i < 11; i++) await add(`e2e-many-${i}`, `[test-009] many ${i}`);
  const hire = await openHire(page);
  await hire.getByTestId(TID.hireModeExisting).click();
  await expect(hire.getByTestId(TID.hireConversationItem).filter({ hasText: '[test-009] many' })).toHaveCount(11);
  await hire.getByTestId(TID.hireFilter).fill('many 10');
  await expect(hire.getByTestId(TID.hireConversationItem)).toHaveCount(1);
  await hire.getByTestId(TID.hireConversationItem).click();
  await ctl('hide/e2e-many-10');
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect(hire).toContainText('This conversation no longer exists in the Antigravity App.');

  // A project created from the dialog has no conversations.
  await hire.getByLabel('Project').selectOption('__new__');
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('button', { name: /Documents/ }).click();
  await dialog.getByRole('button', { name: /Create project at/ }).click();
  await expect(hire).toContainText('No conversations in this project yet.');

  await ctl('quit');
  await expect.poll(async () => (await page.request.get(`/api/projects/${PROJECT}/conversations`, { headers: auth })).status()).toBe(503);
  await hire.getByLabel('Project').selectOption(PROJECT);
  await expect(hire).toContainText('The Antigravity App is not connected.');
});
