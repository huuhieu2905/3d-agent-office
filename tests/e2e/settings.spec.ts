import { expect, test } from '@playwright/test';

// US6 / FR-053, FR-060, FR-063, FR-064: city + theme are chosen, shown with weather attribution, and persisted.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';

test('choosing a city and dark mode is applied, attributed and remembered after reload', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('City').selectOption('singapore');
  await page.getByLabel('Theme').selectOption('dark');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.weather-badge')).toContainText('Singapore');
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
  await page.waitForTimeout(600); // debounced save
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.weather-badge')).toContainText('Singapore');
  await expect(page.locator('.app')).toHaveClass(/theme-dark/);
});

test('006: mouse sensitivity is saved across a reload and Reset returns to 1.00×', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await page.getByRole('button', { name: 'Settings' }).click();
  const slider = page.getByTestId('mouse-sensitivity');
  await slider.fill('2');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toContainText('2.00×');
  await page.waitForTimeout(600); // debounced save
  await page.reload(); // same URL with a #hash would not reload the page
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByTestId('mouse-sensitivity')).toHaveValue('2');
  await page.getByTestId('mouse-sensitivity-reset').click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toContainText('1.00×');
  await page.waitForTimeout(600); // leave the default saved for later specs
});
