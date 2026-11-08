import { expect, test, type Page } from '@playwright/test';

// 002 US6 / T064 / FR-030..032 / SC-010: every screen in the concept E+ look, light and dark; main text
// colours keep ≥ 4.5:1 contrast. Screenshots go to test-results/concept/ for review against the mock-up.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';

function luminance(hex: string): number {
  let c = hex.replace('#', '');
  if (c.length === 3) c = [...c].map((ch) => ch + ch).join(''); // the CSS minifier shortens #ffffff to #fff
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

async function tokens(page: Page) {
  return page.locator('.app').evaluate((el) => {
    const s = getComputedStyle(el);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { text: v('--text'), muted: v('--muted'), panel: v('--panel-solid'), bg: v('--bg'), accent: v('--accent'), accentInk: v('--accent-ink') };
  });
}

async function shoot(page: Page, theme: string) {
  const dir = `test-results/concept/${theme}`;
  await page.screenshot({ path: `${dir}/office.png` });
  await page.getByRole('button', { name: 'Quota', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/quota.png` });
  await page.getByRole('dialog', { name: 'Quota tài khoản' }).getByRole('button', { name: 'Đóng', exact: true }).last().click();
  const tag = page.locator('.tag').first();
  await expect(tag).toBeVisible();
  await page.waitForTimeout(800); // let seated employees settle
  const box = (await tag.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 28);
  await expect(page.locator('.chat')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: `${dir}/chat.png` });
  await page.locator('.chat').getByRole('button', { name: 'Đóng' }).click();
  await page.getByRole('button', { name: /Xây dựng/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/arrange.png` });
  await page.getByRole('toolbar', { name: 'Chế độ xây dựng' }).getByRole('button', { name: 'Huỷ' }).click();
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: concept colours with readable contrast, screens captured`, async ({ page }) => {
    test.setTimeout(150_000); // four full-page screenshots of a WebGL scene
    await page.goto(`/#k=${TOKEN}`);
    await expect(page.locator('.tag').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Cài đặt' }).click();
    await page.getByLabel('Giao diện').selectOption(theme);
    await page.getByRole('button', { name: 'Xong' }).click();
    await expect(page.locator('.app')).toHaveClass(new RegExp(`theme-${theme}`));
    await page.waitForTimeout(800);
    const t = await tokens(page);
    expect(t.accent).toBe(theme === 'light' ? '#1f6f6a' : '#5fb3a9');
    expect(contrast(t.text, t.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.muted, t.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.accentInk, t.accent)).toBeGreaterThanOrEqual(4.5);
    await shoot(page, theme);
  });
}
