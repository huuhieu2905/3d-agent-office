import { afterEach, describe, expect, it } from 'vitest';
import { AppUnavailableError, createAppAdapter } from '../../src/server/app-adapter/index';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';
import { mapConversations } from '../../src/server/app-adapter/mappers/conversation';
import { verifiedVersionList } from '../../src/server/app-adapter/versions';
import { FakeFinder, FakeTransport, FIXTURE_SETS, fixtureFrom, serverArgs } from './helpers';

const adapters: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  while (adapters.length) await adapters.pop()!.stop();
});

function setup(fixtureSet?: string) {
  const finder = new FakeFinder();
  const transport = new FakeTransport(fixtureSet);
  const adapter = createAppAdapter({ finder, transport, healthIntervalMs: 50 });
  adapters.push(adapter);
  return { finder, transport, adapter };
}

const until = async (cond: () => boolean, ms = 2000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('A1 — no App running', () => {
  it('reports searching and fails reads fast', async () => {
    const { finder, adapter } = setup();
    finder.proc = null;
    await adapter.start();
    expect(adapter.getConnection()).toEqual({ kind: 'searching' });
    const t0 = Date.now();
    await expect(adapter.listConversations()).rejects.toBeInstanceOf(AppUnavailableError);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});

describe('connection', () => {
  it('connects to the port that answers JSON, not the gRPC-only one', async () => {
    const { adapter, transport } = setup();
    await adapter.start();
    expect(adapter.getConnection()).toEqual({
      kind: 'connected',
      appVersion: '2.24.0',
      versionSupported: true,
      verifiedVersions: verifiedVersionList(),
    });
    await adapter.listConversations();
    expect(transport.calls.at(-1)!.port).toBe(50002);
  });

  it('A2 — rediscovers when the App restarts with a new PID, port and token', async () => {
    const { adapter, finder, transport } = setup();
    await adapter.start();
    finder.proc = { pid: 2000, args: serverArgs({ token: 'second-token-abcdefghijklmnop' }) };
    finder.ports = [50005];
    transport.apiPort = 50005;
    transport.token = 'second-token-abcdefghijklmnop';
    await until(() => transport.calls.some((c) => c.port === 50005));
    await until(() => adapter.getConnection().kind === 'connected');
    await expect(adapter.listConversations()).resolves.toBeInstanceOf(Array);
  });

  it('A2 — goes back to searching when the App quits', async () => {
    const { adapter, finder } = setup();
    await adapter.start();
    finder.proc = null;
    await until(() => adapter.getConnection().kind === 'searching');
  });

  it('A3-1 — flags an unverified App version, lists the verified ones, and keeps reading and writing', async () => {
    const { adapter, finder, transport } = setup();
    finder.proc = { pid: 1000, args: serverArgs({ version: '2.30.0' }) };
    await adapter.start();
    expect(adapter.getConnection()).toEqual({
      kind: 'connected',
      appVersion: '2.30.0',
      versionSupported: false,
      verifiedVersions: verifiedVersionList(),
    });
    await expect(adapter.listConversations()).resolves.not.toHaveLength(0);
    // A3-1c: writes are not blocked on an unverified version.
    transport.handlers.CancelCascadeInvocation = () => ({});
    await expect(adapter.cancel('6fae0dee-f41d-4d51-93f6-f074134cb79e')).resolves.toBeUndefined();
  });
});

describe.each(FIXTURE_SETS)('mappers on recorded fixtures (App %s)', (version) => {
  it('maps conversations with ids, status and project', () => {
    const list = mapConversations(fixtureFrom(version, 'GetAllCascadeTrajectories'));
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      expect(c.id).toMatch(/[0-9a-f-]{36}/);
      expect(['IDLE', 'RUNNING', 'BUSY', 'CANCELING', 'UNKNOWN']).toContain(c.runStatus);
    }
    expect(list.some((c) => c.projectId)).toBe(true);
  });

  it('maps steps into known kinds', () => {
    const steps = mapSteps(fixtureFrom(version, 'GetCascadeTrajectorySteps'));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.map((s) => s.kind)).toContain('user');
    expect(steps.map((s) => s.kind)).toContain('agent');
    expect(steps.every((s) => s.status !== 'UNKNOWN')).toBe(true);
  });

  it('lists projects', async () => {
    const { adapter } = setup(version);
    await adapter.start();
    const projects = await adapter.listProjects();
    expect(projects.map((p) => p.id)).toContain('default-cli-project');
    expect(projects.every((p) => /^#[0-9a-f]{6}$/.test(p.color))).toBe(true);
  });
});

describe('A5 — malformed responses do not crash', () => {
  it('handles missing fields and unknown step types', () => {
    expect(mapConversations({})).toEqual([]);
    expect(mapConversations({ trajectorySummaries: { 'abc-1': {} } })[0]).toMatchObject({
      id: 'abc-1',
      title: 'Nhân viên mới',
      runStatus: 'UNKNOWN',
    });
    const steps = mapSteps({ steps: [{ type: 'CORTEX_STEP_TYPE_BRAND_NEW', status: 'CORTEX_STEP_STATUS_DONE' }, null] });
    expect(steps[0]).toMatchObject({ kind: 'other', rawType: 'BRAND_NEW', status: 'DONE' });
    expect(steps[1]).toMatchObject({ kind: 'other', status: 'UNKNOWN' });
    expect(mapSteps('nonsense')).toEqual([]);
  });
});
