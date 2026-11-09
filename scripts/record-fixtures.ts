// Record sanitized fixtures from the real Antigravity App (read-only RPCs only).
// The output folder follows the running App version: tests/contract/fixtures/app-<version>/.
//
// Usage:
//   npx tsx scripts/record-fixtures.ts                                   # base fixtures + first test conversation
//   npx tsx scripts/record-fixtures.ts --conversation tools=<id> --conversation <id>
//   npx tsx scripts/record-fixtures.ts --sweep                           # only clean leftover test objects
//
// `--conversation name=<id>` writes GetCascadeTrajectorySteps.<name>.json; an unnamed id writes
// GetCascadeTrajectorySteps.json (+ GetCascadeTrajectory.json). Only conversations marked
// "[agent-office-test]" are accepted. Only imports the adapter's public API (Constitution II).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAppAdapter, recordRaw, type ReadOnlyRpc } from '../src/server/app-adapter/index';

const TEST_PREFIX = '[agent-office-test]';

interface ConvArg {
  name: string | null;
  id: string;
}

function parseConversations(argv: string[]): ConvArg[] {
  const out: ConvArg[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--conversation' || !argv[i + 1]) continue;
    const v = argv[++i]!;
    const eq = v.indexOf('=');
    out.push(eq > 0 ? { name: v.slice(0, eq), id: v.slice(eq + 1) } : { name: null, id: v });
  }
  return out;
}

if (process.argv.includes('--sweep')) {
  const { sweepTestArtifacts } = await import('../tests/live/sweep');
  const r = await sweepTestArtifacts();
  console.log(`swept ${r.conversations} test conversation(s), ${r.projects} test project(s)`);
  process.exit(0);
}

const adapter = createAppAdapter();
await adapter.start();
let version: string;
let requested: ConvArg[];
try {
  const conn = adapter.getConnection();
  if (conn.kind !== 'connected') throw new Error('Antigravity App is not connected');
  if (!/^\d+\.\d+\.\d+$/.test(conn.appVersion)) {
    throw new Error(`Refusing to record: App version is "${conn.appVersion}", not a release number`);
  }
  version = conn.appVersion;

  const list = await adapter.listConversations();
  const isTest = async (id: string): Promise<boolean> => {
    const c = list.find((x) => x.id === id);
    if (!c) return false;
    if (c.title.startsWith(TEST_PREFIX)) return true;
    const first = (await adapter.getSteps(id)).find((s) => s.kind === 'user');
    return (first?.text ?? '').startsWith(TEST_PREFIX);
  };

  requested = parseConversations(process.argv);
  if (requested.length === 0) {
    const auto = list.find((c) => c.title.startsWith(TEST_PREFIX));
    if (auto) requested = [{ name: null, id: auto.id }];
  }
  for (const r of requested) {
    if (!(await isTest(r.id))) throw new Error(`Conversation ${r.id} is not marked ${TEST_PREFIX}; refusing to record it`);
  }
} finally {
  await adapter.stop();
}

const OUT = join(import.meta.dirname, '..', 'tests', 'contract', 'fixtures', `app-${version}`);

async function save(name: string, method: ReadOnlyRpc, body: unknown) {
  const data = await recordRaw(method, body);
  await writeFile(join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`saved app-${version}/${name}.json`);
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

if (requested.length === 0) {
  console.warn(`No test conversation found (title starting with "${TEST_PREFIX}"); steps fixture skipped.`);
}
for (const r of requested) {
  if (r.name) {
    await save(`GetCascadeTrajectorySteps.${r.name}`, 'GetCascadeTrajectorySteps', { cascadeId: r.id });
  } else {
    await save('GetCascadeTrajectorySteps', 'GetCascadeTrajectorySteps', { cascadeId: r.id });
    await save('GetCascadeTrajectory', 'GetCascadeTrajectory', { cascadeId: r.id });
  }
}
