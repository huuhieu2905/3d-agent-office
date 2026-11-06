import { expect, test, type Page } from '@playwright/test';

// Wave 2 e2e: `/` menu (FR-027), permission approval (FR-029, US1 scenario 3), quota panel (FR-040/041).

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string; body: Record<string, unknown> }[];

async function openFirstChat(page: Page) {
  const tag = page.locator('.tag').first();
  await expect(tag).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  const box = (await tag.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 28);
  await expect(page.locator('.chat')).toBeVisible();
}

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
});

test('typing / lists commands and skills like the App; Enter picks one', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await openFirstChat(page);
  await expect(page.locator('.model-picker select')).not.toHaveValue('');
  await page.locator('.chat textarea').fill('/pl');
  const menu = page.getByRole('listbox', { name: 'Lệnh và skill' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('option').first()).toContainText('/plan');
  await page.locator('.chat textarea').press('Enter');
  await expect(page.locator('.chat textarea')).toHaveValue('/plan ');
});

test('a waiting employee shows a permission prompt; "Cho phép" answers the App', async ({ page }) => {
  await ctl('waiting');
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.badge-waiting').first()).toBeVisible({ timeout: 20_000 });
  await openFirstChat(page);
  const prompt = page.getByRole('alertdialog', { name: 'Agent xin quyền' });
  await expect(prompt).toContainText('echo second_check');
  await prompt.getByRole('button', { name: 'Cho phép' }).click();
  await expect.poll(async () => (await sent()).find((s) => s.method === 'HandleCascadeUserInteraction')?.body).toMatchObject({
    interaction: { stepIndex: 6, permission: { allow: true } },
  });
});

test('quota button opens the panel with plan and model groups', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await page.getByRole('button', { name: /Quota/ }).click();
  const panel = page.getByRole('dialog', { name: 'Quota tài khoản' });
  await expect(panel).toContainText('Gói:');
  await expect(panel.locator('tbody tr').first()).toBeVisible();
  await expect(panel).not.toContainText('@');
});
