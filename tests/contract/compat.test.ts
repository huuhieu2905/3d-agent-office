import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countUnknownStepTypes, diffPaths, normalizedPaths, scanRpcNames, USED_RPCS } from '../../src/server/app-adapter/compat';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';

// Spec 003 US4 (T043/T044): pure helpers of the read-only compatibility check.

describe('scanRpcNames', () => {
  it('reports which RPC names the binary exposes', () => {
    const bin = Buffer.from('\0garbage/exa.language_server_pb.LanguageServerService/GetUserStatus\0more\0');
    expect(scanRpcNames(bin, ['GetUserStatus', 'StartCascade'])).toEqual([
      { name: 'GetUserStatus', present: true },
      { name: 'StartCascade', present: false },
    ]);
  });
});

describe('normalizedPaths / diffPaths', () => {
  it('keeps key names only, normalises ids and arrays', () => {
    const p = normalizedPaths({
      trajectorySummaries: { '0571b7b9-0a15-4569-b564-0d8870ac8d70': { title: 'SECRET-TITLE', workspaces: [{ branchName: 'main' }] } },
      list: { '12': 1 },
    });
    expect([...p].sort()).toEqual([
      '.list',
      '.list.*',
      '.trajectorySummaries',
      '.trajectorySummaries.*',
      '.trajectorySummaries.*.title',
      '.trajectorySummaries.*.workspaces',
      '.trajectorySummaries.*.workspaces[].branchName',
    ]);
    expect(JSON.stringify([...p])).not.toContain('SECRET-TITLE');
  });

  it('lists added and removed paths', () => {
    expect(diffPaths(new Set(['.a', '.b']), new Set(['.b', '.c']))).toEqual({ added: ['.a'], removed: ['.c'] });
  });
});

describe('countUnknownStepTypes', () => {
  it('counts raw types of steps mapped to `other`', () => {
    const steps = mapSteps({
      steps: [
        { type: 'CORTEX_STEP_TYPE_BRAND_NEW', status: 'CORTEX_STEP_STATUS_DONE' },
        { type: 'CORTEX_STEP_TYPE_BRAND_NEW', status: 'CORTEX_STEP_STATUS_DONE' },
        { type: 'CORTEX_STEP_TYPE_OTHER_NEW', status: 'CORTEX_STEP_STATUS_DONE' },
        { type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE', userInput: { items: [{ text: 'hi' }] } },
      ],
    });
    expect(countUnknownStepTypes(steps)).toEqual([
      { rawType: 'BRAND_NEW', count: 2 },
      { rawType: 'OTHER_NEW', count: 1 },
    ]);
  });
});

describe('USED_RPCS covers every RPC the adapter calls', () => {
  const root = join(import.meta.dirname, '..', '..', 'src', 'server', 'app-adapter');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(root);
  // call('X'), call<T>('X'), rpc.call('X'), transport.call(target, 'X'), openStream(target, 'X') — across lines.
  const CALL = /(?:\bcall|\bopenStream)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*(?:[\w.]+\s*,\s*)?'([A-Z][A-Za-z]+)'/g;
  const found = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(CALL)) found.add(m[1]!);

  it('finds the calls (sanity: stream + health probe)', () => {
    expect(found).toContain('GetAllWorkflows');
    expect(found).toContain('StreamAgentStateUpdates');
    expect(found).toContain('GetMatchingContextScopeItems');
  });

  it('every called RPC is listed', () => {
    const listed = new Set<string>(USED_RPCS);
    expect([...found].filter((n) => !listed.has(n))).toEqual([]);
  });
});

describe('inspectCompat (fake App)', () => {
  it('calls read-only RPCs only, reads the binary, and reports names/counts without content', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { inspectCompat } = await import('../../src/server/app-adapter/index');
    const { FakeFinder, FakeTransport, FIXTURE_SETS, fixturesDir, serverArgs } = await import('./helpers');
    const dir = await mkdtemp(join(tmpdir(), 'ao-compat-'));
    try {
      const bin = join(dir, 'language_server');
      await writeFile(bin, Buffer.from('xx exa.language_server_pb.LanguageServerService/GetUserStatus yy LanguageServerService/StartCascade'));
      const finder = new FakeFinder();
      const args = serverArgs();
      args[0] = bin;
      finder.proc = { pid: 1000, args };
      const transport = new FakeTransport();
      transport.handlers.GetAllSkills = () => ({ skills: [{ name: 'x' }] });
      transport.handlers.GetCascadeTrajectorySteps = () => ({
        steps: [{ type: 'CORTEX_STEP_TYPE_BRAND_NEW', status: 'CORTEX_STEP_STATUS_DONE', brandNew: { secretField: 'TOP-SECRET-CONTENT-99' } }],
      });
      const report = await inspectCompat({ finder, transport, fixturesRoot: join(fixturesDir(FIXTURE_SETS[0]!), '..') });

      const READ_ONLY = new Set(['GetAllCascadeTrajectories', 'GetCascadeTrajectorySteps', 'GetCascadeTrajectory', 'GetUserStatus', 'GetSlashCommands', 'GetAllSkills', 'GetAllWorkflows', 'GetAvailableModels', 'GetMatchingContextScopeItems', 'ListProjects', 'ReadProjects']);
      expect(transport.calls.map((c) => c.method).filter((m) => !READ_ONLY.has(m))).toEqual([]);
      expect(report.rpcs.find((r) => r.name === 'GetUserStatus')?.present).toBe(true);
      expect(report.rpcs.find((r) => r.name === 'StartCascade')?.present).toBe(true);
      expect(report.rpcs.find((r) => r.name === 'CancelCascadeInvocation')?.present).toBe(false);
      expect(report.unknownStepTypes).toEqual([{ rawType: 'BRAND_NEW', count: report.scannedConversations }]);
      expect(report.baseline).not.toBeNull();
      const steps = report.fieldDiff.find((d) => d.rpc === 'GetCascadeTrajectorySteps');
      expect(steps?.contentDependent).toBe(true);
      expect(steps?.added).toContain('.steps[].brandNew.secretField');
      expect(JSON.stringify(report)).not.toContain('TOP-SECRET-CONTENT-99');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
