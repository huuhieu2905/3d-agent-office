// Record sanitized fixtures from the real Antigravity App 2.24.0 (read-only RPCs only).
// Usage: npx tsx scripts/record-fixtures.ts [--conversation <id>]
// Only imports the adapter's public API (Constitution II).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAppAdapter, recordRaw, type ReadOnlyRpc } from '../src/server/app-adapter/index';

const OUT = join(import.meta.dirname, '..', 'tests', 'contract', 'fixtures', 'app-2.24.0');
const TEST_PREFIXES = ['[agent-office-test]', '3d-agent-office test'];

async function pickConversation(): Promise<string | null> {
  const i = process.argv.indexOf('--conversation');
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  const adapter = createAppAdapter();
  await adapter.start();
  try {
    const list = await adapter.listConversations();
    return list.find((c) => TEST_PREFIXES.some((p) => c.title.startsWith(p)))?.id ?? null;
  } finally {
    await adapter.stop();
  }
}

async function save(name: string, method: ReadOnlyRpc, body: unknown) {
  const data = await recordRaw(method, body);
  await writeFile(join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`saved ${name}.json`);
}

await mkdir(OUT, { recursive: true });
await save('GetAllCascadeTrajectories', 'GetAllCascadeTrajectories', {});
await save('GetUserStatus', 'GetUserStatus', {});
await save('GetAllSkills', 'GetAllSkills', {});
await save('GetSlashCommands', 'GetSlashCommands', {
  cascadeConfig: { plannerConfig: { planModel: 'MODEL_PLACEHOLDER_M318' } },
});
const projectIds = (await recordRaw('ListProjects', {})) as { projectIds?: string[] };
await save('ListProjects', 'ListProjects', {});
await save('ReadProjects', 'ReadProjects', { ids: projectIds.projectIds ?? [] });
const conv = await pickConversation();
if (conv) {
  await save('GetCascadeTrajectorySteps', 'GetCascadeTrajectorySteps', { cascadeId: conv });
  await save('GetCascadeTrajectory', 'GetCascadeTrajectory', { cascadeId: conv });
} else {
  console.warn('No test conversation found (title starting with "[agent-office-test]"); steps fixture skipped.');
}
