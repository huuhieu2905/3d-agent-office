import { expect, test } from '@playwright/test';

// US6 / FR-053, FR-060, FR-063, FR-064: city + theme are chosen, shown with weather attribution, and persisted.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';

test('choosing a city and dark mode is applied, attributed and remembered after reload', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByLabel('Thành phố').selectOption('singapore');
  await page.getByLabel('Giao diện').selectOption('dark');
  await page.getByRole('button', { name: 'Xong' }).click();
  await expect(page.locator('.weather-badge')).toContainText('Singapore');
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
  await page.waitForTimeout(600); // debounced save
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.weather-badge')).toContainText('Singapore');
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
});
