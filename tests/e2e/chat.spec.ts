import { expect, test, type Page } from '@playwright/test';

// T074 / FR-020..025 / SC-003: one click opens the chat; messages and stop reach the (mock) App;
// a failed send keeps the text and offers "Gửi lại".

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string; body: Record<string, unknown> }[];

async function clickFirstEmployee(page: Page) {
  const tag = page.locator('.tag').first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800); // let seated robots settle
  const box = (await tag.boundingBox())!;
  // The name tag floats above the head; the robot body is just below it.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 28);
}

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
});

test('one click on an employee opens the chat with its history', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await clickFirstEmployee(page);
  await expect(page.locator('.chat')).toBeVisible();
  await expect(page.locator('.chat .msg').first()).toBeVisible({ timeout: 10_000 });
});

test('sending a message reaches the App as a user message with the chosen model', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await clickFirstEmployee(page);
  await page.locator('.chat textarea').fill('Chào bạn');
  await expect(page.locator('.model-picker select')).not.toHaveValue('');
  await page.locator('.chat textarea').press('Enter');
  await expect.poll(async () => (await sent()).filter((s) => s.method === 'SendUserCascadeMessage').length).toBe(1);
  const msg = (await sent()).find((s) => s.method === 'SendUserCascadeMessage')!;
  expect(msg.body.items).toEqual([{ text: 'Chào bạn' }]);
  expect((msg.body.cascadeConfig as { plannerConfig: { planModel: string } }).plannerConfig.planModel).toMatch(/^MODEL_/);
  await expect(page.locator('.chat textarea')).toHaveValue('');
});

test('stop button cancels a working employee', async ({ page }) => {
  await ctl('running');
  await page.goto(`/#k=${TOKEN}`);
  await clickFirstEmployee(page);
  await page.getByRole('button', { name: /Dừng/ }).click();
  await expect.poll(async () => (await sent()).some((s) => s.method === 'CancelCascadeInvocation')).toBe(true);
});

test('a failed send keeps the text and can be retried', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await clickFirstEmployee(page);
  await expect(page.locator('.model-picker select')).not.toHaveValue('');
  await ctl('quit');
  await expect(page.getByText('Chưa kết nối được Antigravity App')).toBeVisible({ timeout: 5_000 });
  await page.locator('.chat textarea').fill('Tin quan trọng');
  await page.locator('.chat textarea').press('Enter');
  await expect(page.getByRole('button', { name: 'Gửi lại' })).toBeVisible();
  await expect(page.locator('.chat textarea')).toHaveValue('Tin quan trọng');
  await ctl('open');
  await expect(page.locator('.banner')).toHaveCount(0, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Gửi lại' }).click();
  await expect.poll(async () => (await sent()).filter((s) => s.method === 'SendUserCascadeMessage').length).toBe(1);
});

// Spec 003 US3 (U3-4, U3-5): error text with "Xem thêm", and web searches.
test('shows the error message (300 chars + Xem thêm) and the web search query', async ({ page }) => {
  await ctl('error-and-search');
  await page.goto(`/#k=${TOKEN}`);
  await clickFirstEmployee(page);
  const err = page.getByTestId('step-error');
  await expect(err).toBeVisible({ timeout: 10_000 });
  await expect(err).toContainText('API error (attempt 1)');
  await expect(err).not.toContainText('END-OF-ERROR');
  await err.getByRole('button', { name: 'Xem thêm' }).click();
  await expect(err).toContainText('END-OF-ERROR');
  await expect(page.getByTestId('step-web-search')).toHaveText(/Đã tìm: Open-Meteo API/);
});
