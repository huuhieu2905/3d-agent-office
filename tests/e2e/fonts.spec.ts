import { expect, test } from '@playwright/test';

// 002 US6 / T063 / FR-033..035 / SC-011: the concept fonts are bundled and render Vietnamese with every
// request outside 127.0.0.1 blocked (Constitution III: no new outbound connection).

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const SAMPLE = 'Đặng Thị Hương — Ưng ỡ ữ ỵ';

test('Baloo 2 and Nunito load offline and cover Vietnamese', async ({ page }) => {
  const outside: string[] = [];
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    outside.push(u.hostname);
    return route.abort();
  });
  await page.goto(`/#k=${TOKEN}`);
  await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
  const loaded = await page.evaluate(async (text) => {
    await document.fonts.load(`700 16px "Baloo 2 Variable"`, text);
    await document.fonts.load(`400 16px "Nunito Variable"`, text);
    return {
      display: document.fonts.check(`700 16px "Baloo 2 Variable"`, text),
      body: document.fonts.check(`400 16px "Nunito Variable"`, text),
      faces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    };
  }, SAMPLE);
  expect(loaded.display).toBe(true);
  expect(loaded.body).toBe(true);
  expect(loaded.faces.some((f) => f.includes('Baloo 2'))).toBe(true);
  expect(loaded.faces.some((f) => f.includes('Nunito'))).toBe(true);

  // Name tags use the display face; the page body uses the body face.
  const tagFont = await page.locator('.tag').first().evaluate((el) => getComputedStyle(el).fontFamily);
  expect(tagFont).toContain('Baloo 2 Variable');
  const bodyFont = await page.locator('.app').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(bodyFont).toContain('Nunito Variable');
  // Open-Meteo is the only outside host the app may contact (blocked here, the office still works).
  expect(outside.filter((h) => !h.endsWith('open-meteo.com'))).toEqual([]);
});
