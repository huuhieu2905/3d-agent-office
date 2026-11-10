import { expect, test, type Page } from '@playwright/test';

// Spec 003 US2 (contracts/local-api.md U3-1…U3-3): answer an agent's multiple-choice question.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string; body: Record<string, unknown> }[];
const answers = async () =>
  (await sent())
    .filter((s) => s.method === 'HandleCascadeUserInteraction')
    .map((s) => (s.body.interaction as { askQuestion?: { responses: unknown[] } }).askQuestion?.responses);

async function openChat(page: Page) {
  await page.goto(`/#k=${TOKEN}`);
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
  await ctl('question');
});

test('a waiting question shows choices, not allow/deny, and sends the picked answers', async ({ page }) => {
  await openChat(page);
  const prompt = page.getByTestId('question-prompt');
  await expect(prompt).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Deny' })).toHaveCount(0);
  await expect(page.getByTestId('question-option-0-1')).toHaveAttribute('type', 'radio');
  await expect(page.getByTestId('question-option-1-1')).toHaveAttribute('type', 'checkbox');

  const submit = page.getByTestId('question-submit');
  await expect(submit).toBeDisabled();
  await page.getByTestId('question-option-0-2').check();
  await expect(submit).toBeDisabled(); // second sub-question still unanswered
  await page.getByTestId('question-option-1-1').check();
  await page.getByTestId('question-option-1-3').check();
  await submit.click();

  await expect.poll(answers).toEqual([
    [
      { question: 'Chọn **một** màu cho biển hiệu?', selectedOptionIds: ['2'] },
      { question: 'Những ngày nào bạn rảnh?', selectedOptionIds: ['1', '3'] },
    ],
  ]);
  await expect(prompt).toContainText('Sent');
  await page.getByTestId('question-dismiss').click();
  await expect(prompt).toHaveCount(0);
  // History shows the chosen answers.
  await expect(page.getByTestId('step-question')).toContainText('→ Xanh');
  await expect(page.getByTestId('step-question')).toContainText('→ Thứ 2, Thứ 4');
});

test('"Other" sends a write-in answer', async ({ page }) => {
  await openChat(page);
  await page.getByTestId('question-other-0').check();
  await page.getByTestId('question-writein-0').fill('Tím');
  await page.getByTestId('question-option-1-2').check();
  await page.getByTestId('question-submit').click();
  await expect.poll(answers).toEqual([
    [
      { question: 'Chọn **một** màu cho biển hiệu?', selectedOptionIds: [], writeInResponse: 'Tím' },
      { question: 'Những ngày nào bạn rảnh?', selectedOptionIds: ['2'] },
    ],
  ]);
});

test('an App rejection keeps the choices and the typed text', async ({ page }) => {
  await ctl('question-reject');
  await openChat(page);
  await page.getByTestId('question-other-0').check();
  await page.getByTestId('question-writein-0').fill('Tím');
  await page.getByTestId('question-option-1-1').check();
  await page.getByTestId('question-submit').click();
  await expect(page.getByText('The App did not accept this answer')).toBeVisible();
  await expect(page.getByTestId('question-writein-0')).toHaveValue('Tím');
  await expect(page.getByTestId('question-option-1-1')).toBeChecked();
  await expect(page.getByTestId('question-submit')).toBeEnabled();
});

test('a question canceled while the form is open locks the form and sends nothing', async ({ page }) => {
  await openChat(page);
  await page.getByTestId('question-option-0-1').check();
  await ctl('question-cancel');
  const prompt = page.getByTestId('question-prompt');
  await expect(prompt).toContainText('This question was canceled', { timeout: 10_000 });
  await expect(page.getByTestId('question-option-0-1')).toBeDisabled();
  await expect(page.getByTestId('question-option-0-1')).toBeChecked();
  expect(await answers()).toEqual([]);
  await page.getByTestId('question-dismiss').click();
  await expect(prompt).toHaveCount(0);
  await expect(page.getByTestId('step-question')).toContainText('Canceled');
});
