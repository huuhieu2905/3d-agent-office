import { expect, test } from '@playwright/test';

// T083 / FR-031, FR-032: browse folders, create a project on a folder, project required when hiring.

const TOKEN = 'e2e-session-token-0123456789abcdefghij';
const ctl = (a: string) => fetch(`http://127.0.0.1:${Number(process.env.E2E_PORT ?? 4399) + 1}/${a}`);
const sent = async () => (await (await ctl('sent')).json()) as { method: string; body: Record<string, unknown> }[];

test.beforeEach(async () => {
  await ctl('open');
  await ctl('reset');
});

test('create a project by browsing to a folder', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await page.getByRole('button', { name: '+ New project' }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('button', { name: /code/ }).click();
  await dialog.getByRole('button', { name: /website/ }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue('website');
  await dialog.getByRole('button', { name: /Create project at ~\/code\/website/ }).click();
  await expect(dialog).toBeHidden();
  const create = (await sent()).find((s) => s.method === 'CreateProject')!;
  const project = create.body.project as { id: string; name: string; projectResources: { resources: { folderUri: string }[] } };
  expect(project.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(project.name).toBe('website');
  expect(project.projectResources.resources[0]!.folderUri).toMatch(/\/code\/website$/);
});

test('hiring requires a project; a new project can be created inline and is pre-selected', async ({ page }) => {
  await page.goto(`/#k=${TOKEN}`);
  await page.getByRole('button', { name: '+ Hire employee' }).click();
  const hire = page.getByRole('dialog', { name: 'Hire a new employee' });
  await hire.locator('textarea').fill('Làm trang chủ');
  await expect(hire.locator('.model-picker select')).not.toHaveValue('');
  await expect(hire.getByRole('button', { name: 'Hire' })).toBeDisabled();
  await hire.getByLabel('Project').selectOption('__new__');
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByRole('button', { name: /Documents/ }).click();
  await dialog.getByRole('button', { name: /Create project at/ }).click();
  await expect(hire.getByRole('button', { name: 'Hire' })).toBeEnabled();
  await hire.getByRole('button', { name: 'Hire' }).click();
  await expect.poll(async () => (await sent()).find((s) => s.method === 'StartCascade')?.body).toMatchObject({
    projectEnvConfig: { projectId: expect.stringMatching(/^[0-9a-f-]{36}$/) },
  });
});

test('the API refuses folders outside home and conversations without a project', async ({ request }) => {
  const auth = { authorization: `Bearer ${TOKEN}` };
  expect((await request.get('/api/fs/dirs?path=/etc', { headers: auth })).status()).toBe(400);
  expect((await request.post('/api/conversations', { headers: auth, data: { parts: [{ text: 'x' }], model: 'M' } })).status()).toBe(400);
});
