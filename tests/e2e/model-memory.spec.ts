import { expect, test, type Page } from '@playwright/test';
import { TID } from './testids';

// 002 US1 / FR-001..004 / SC-001: the model picked for a conversation is remembered for that
// conversation across closing the chat, reloads and other conversations; a remembered model that the
// App stops offering is flagged and blocks sending instead of being swapped silently.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const auth = { authorization: `Bearer ${TOKEN}` };
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
const FLASH_HIGH = 'MODEL_PLACEHOLDER_M318'; // what the fixture's last user turn used
const FLASH_MEDIUM = 'MODEL_PLACEHOLDER_M319';

async function openChatOf(page: Page, name: string) {
  const tag = page.locator('.tag', { hasText: name }).first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const box = (await tag.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 28);
  await expect(page.locator('.chat')).toBeVisible();
  await expect(page.locator('.chat strong')).toHaveText(name);
}
const picker = (page: Page) => page.getByTestId(TID.modelPicker).locator('select');
const closeChat = (page: Page) => page.getByRole('button', { name: 'Close' }).click();

let names: string[] = [];

test.beforeEach(async ({ request }) => {
  await ctl('open');
  await ctl('reset');
  await expect.poll(async () => (await (await request.get('/api/employees', { headers: auth })).json()).employees.length).toBeGreaterThan(1);
  const { employees } = await (await request.get('/api/employees', { headers: auth })).json();
  names = (employees as { name: string; visible: boolean; conversationId: string }[]).filter((e) => e.visible).map((e) => e.name);
  // Forget choices left by earlier tests.
  for (const e of employees as { conversationId: string }[]) await request.put(`/api/employees/${e.conversationId}/profile`, { headers: auth, data: { preferredModel: null } });
});

test('a model picked without sending is kept after closing the chat and after a reload', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await openChatOf(page, names[0]!);
  await expect(picker(page)).toHaveValue(FLASH_HIGH);
  await picker(page).selectOption(FLASH_MEDIUM);
  await expect(page.getByText('Saved for this conversation')).toBeVisible();
  await closeChat(page);
  await openChatOf(page, names[0]!);
  await expect(picker(page)).toHaveValue(FLASH_MEDIUM);
  await page.reload();
  await openChatOf(page, names[0]!);
  await expect(picker(page)).toHaveValue(FLASH_MEDIUM);
});

test('another conversation keeps its own model', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await openChatOf(page, names[0]!);
  await picker(page).selectOption(FLASH_MEDIUM);
  await expect(page.getByText('Saved for this conversation')).toBeVisible();
  await closeChat(page);
  await openChatOf(page, names[1]!);
  await expect(picker(page)).toHaveValue(FLASH_HIGH);
});

test('a remembered model the App no longer offers is flagged and sending is blocked', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await openChatOf(page, names[0]!);
  await picker(page).selectOption(FLASH_MEDIUM);
  await expect(page.getByText('Saved for this conversation')).toBeVisible();
  await ctl(`hide-model/${FLASH_MEDIUM}`);
  await page.waitForTimeout(5_500); // the adapter caches the App's model list for 5 s
  await page.reload();
  await openChatOf(page, names[0]!);
  await expect(page.getByTestId(TID.modelUnavailable)).toBeVisible();
  await expect(picker(page)).toHaveValue(FLASH_MEDIUM);
  await page.locator('.chat textarea').fill('Chào');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
});
