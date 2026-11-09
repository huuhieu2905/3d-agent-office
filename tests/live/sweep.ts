import { createAppAdapter, deleteTestConversation, deleteTestProject } from '../../src/server/app-adapter/index';

// Spec 003 edge case "a live test was interrupted": remove leftover [agent-office-test] objects.
// Deletion goes ONLY through deleteTest*, which refuse anything that is not marked as a test.
// Prints counts only — never titles or content (Constitution III).

export const TEST_PREFIX = '[agent-office-test]';

export async function sweepTestArtifacts(): Promise<{ conversations: number; projects: number }> {
  const a = createAppAdapter();
  await a.start();
  const convIds: string[] = [];
  let projectIds: string[];
  try {
    if (a.getConnection().kind !== 'connected') return { conversations: 0, projects: 0 };
    const list = await a.listConversations();
    for (const c of list) {
      if (c.title.startsWith(TEST_PREFIX)) {
        convIds.push(c.id);
        continue;
      }
      // Untitled conversations: the App titles them later; check the first user message.
      if (c.stepCount > 0 && c.stepCount < 200) {
        const first = (await a.getSteps(c.id)).find((s) => s.kind === 'user');
        if ((first?.text ?? '').startsWith(TEST_PREFIX)) convIds.push(c.id);
      }
    }
    projectIds = (await a.listProjects()).filter((p) => p.name.startsWith(TEST_PREFIX)).map((p) => p.id);
  } finally {
    await a.stop();
  }
  let conversations = 0;
  let projects = 0;
  for (const id of convIds) if (await deleteTestConversation(id).catch(() => false)) conversations++;
  for (const id of projectIds) if (await deleteTestProject(id).catch(() => false)) projects++;
  if (conversations || projects) console.log(`[sweep] removed ${conversations} test conversation(s), ${projects} test project(s)`);
  return { conversations, projects };
}
