import { expect, test } from '@playwright/test';

// US7 / FR-070: V toggles overview ⇄ first person; the choice is remembered; build mode forces overview.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';

test('V switches to first person and back; the choice survives a reload', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeVisible();
  await expect(page.getByRole('button', { name: /Toàn cảnh/ })).toBeVisible();
  await page.waitForTimeout(600);
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.crosshair')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeHidden();
  await expect(page.getByRole('button', { name: /Góc nhìn thứ nhất/ })).toBeVisible();
});

test('entering build mode returns to the overview camera', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 }); // app ready (hotkeys bound)
  await page.keyboard.press('v');
  await expect(page.locator('.crosshair')).toBeVisible();
  await page.getByRole('button', { name: /Xây dựng/ }).click();
  await expect(page.locator('.crosshair')).toBeHidden();
  await page.getByRole('toolbar', { name: 'Chế độ xây dựng' }).getByRole('button', { name: 'Huỷ' }).click();
});
