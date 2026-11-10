import { expect, test, type Page } from '@playwright/test';
import { TID } from './testids';

// 004 US2 (FR-010…FR-018, SC-002, SC-003, U4-2): delete an employee = permanently delete its conversation
// (and its subagents) in the App, after a confirmation; blocked while any agent of the tree is busy.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const PORT = Number(process.env.E2E_PORT ?? 4399);
const ctl = (a: string) => fetch(`http://127.0.0.1:${PORT + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string; body: Record<string, unknown> }[];
const employeeIds = async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/employees`, { headers: { authorization: `Bearer ${TOKEN}` } });
  return ((await r.json()) as { employees: { conversationId: string }[] }).employees.map((e) => e.conversationId);
};

/** Click the first employee (1 click) and return the id of the conversation whose chat opened. */
async function openFirstEmployee(page: Page): Promise<string> {
  const tag = page.locator('.tag').first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const box = (await tag.boundingBox())!;
  const steps = page.waitForRequest((r) => /\/api\/conversations\/[^/]+\/steps/.test(r.url()));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 28);
  await expect(page.locator('.chat')).toBeVisible();
  return /\/api\/conversations\/([^/]+)\/steps/.exec((await steps).url())![1]!;
}

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
});

test('cancel changes nothing; confirm deletes in ≤ 3 clicks and the employee leaves for good', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  const id = await openFirstEmployee(page); // click 1
  const before = (await employeeIds()).length;

  await page.getByTestId(TID.employeeDelete).click();
  const dialog = page.getByTestId(TID.confirmDelete);
  await expect(dialog).toContainText('permanently deleted in the Antigravity App');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect((await sent()).some((s) => s.method === 'DeleteCascadeTrajectory')).toBe(false);

  await page.getByTestId(TID.employeeDelete).click(); // click 2
  await page.getByTestId(TID.confirmDeleteOk).click(); // click 3
  await expect(page.locator('.chat')).toBeHidden();
  const del = (await sent()).find((s) => s.method === 'DeleteCascadeTrajectory')!;
  expect(del.body).toEqual({ cascadeId: id });
  await expect.poll(async () => (await employeeIds()).includes(id), { timeout: 10_000 }).toBe(false);
  expect((await employeeIds()).length).toBe(before - 1);

  await page.reload();
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  expect(await employeeIds()).not.toContain(id);
});

test('subagents are named in the dialog and leave together', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  const id = await openFirstEmployee(page);
  const [a, b] = (await employeeIds()).filter((x) => x !== id);
  await ctl(`parent/${a}/${id}`);
  await ctl(`parent/${b}/${a}`);
  await page.getByTestId(TID.employeeDelete).click();
  await expect(page.getByTestId(TID.confirmDelete)).toContainText('and its 2 subagent(s)', { timeout: 10_000 });
  // Wait for the server to finish: it re-checks the App ~250 ms after deleting. Ending the test earlier lets the
  // next test's `reset` bring the conversation back, and that re-check then deletes it again inside the next test.
  const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes(`/api/conversations/${id}`));
  await page.getByTestId(TID.confirmDeleteOk).click();
  expect((await deleted).status()).toBe(200);
  await expect.poll(async () => (await employeeIds()).filter((x) => [id, a, b].includes(x)).length, { timeout: 10_000 }).toBe(0);
});

test('busy agent: the button is disabled; starting while the dialog is open is refused', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  const id = await openFirstEmployee(page);

  await ctl(`run/${id}`);
  await expect(page.getByTestId(TID.employeeDelete)).toBeDisabled({ timeout: 10_000 });
  await expect(page.getByTestId(TID.employeeDelete)).toHaveAttribute('title', 'Stop the agent before deleting');

  await ctl(`idle/${id}`);
  await expect(page.getByTestId(TID.employeeDelete)).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId(TID.employeeDelete).click();
  await ctl(`run/${id}`); // the agent starts from the App while the dialog is open
  await page.getByTestId(TID.confirmDeleteOk).click();
  await expect(page.getByTestId(TID.confirmDeleteError)).toHaveText('The agent just started running — stop it and try again');
  // Only this conversation counts: a call left over from an earlier test must not make this one fail.
  expect((await sent()).some((s) => s.method === 'DeleteCascadeTrajectory' && s.body.cascadeId === id)).toBe(false);
  expect(await employeeIds()).toContain(id);
});

test('the App refusing keeps the employee and shows an error', async ({ page }) => {
  await ctl('delete-fail');
  await page.goto(`/#k=${TOKEN}`);
  const id = await openFirstEmployee(page);
  await page.getByTestId(TID.employeeDelete).click();
  await page.getByTestId(TID.confirmDeleteOk).click();
  await expect(page.getByTestId(TID.confirmDeleteError)).toHaveText('The App could not delete this conversation');
  expect(await employeeIds()).toContain(id);
});

test('006: Esc closes only the delete dialog, the chat stays open', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await openFirstEmployee(page);
  await page.getByTestId(TID.employeeDelete).click();
  const dialog = page.getByTestId(TID.confirmDelete);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.chat')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.chat')).toBeHidden();
});
