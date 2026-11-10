import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { RpcError } from '../../src/server/app-adapter/types';
import { createHttpServer } from '../../src/server/http/app';
import { createLogger } from '../../src/server/log';
import { subtreeIds } from '../../src/server/services/employees';
import { FakeFinder, FakeTransport } from './helpers';

// 004 US2 — contracts/local-api.md L4-1: DELETE /api/conversations/:id.

const SESSION = 'session-token-for-delete-route-0123456789ab';
const PARENT = '00000000-0000-4000-8000-0000000000a1';
const CHILD = '00000000-0000-4000-8000-0000000000a2';
const GRANDCHILD = '00000000-0000-4000-8000-0000000000a3';
const OTHER = '00000000-0000-4000-8000-0000000000b1';

interface Conv {
  status?: string;
  parent?: string;
  /** Status of the last step. */
  step?: string;
}

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup(convs: Record<string, Conv>, onDelete: () => unknown = () => ({}), connect = true) {
  const transport = new FakeTransport();
  const deleted: string[] = [];
  const list = { ...convs };
  transport.handlers.GetAllCascadeTrajectories = () => ({
    trajectorySummaries: Object.fromEntries(
      Object.entries(list).map(([id, c]) => [
        id,
        { summary: `title ${id}`, status: c.status ?? 'CASCADE_RUN_STATUS_IDLE', trajectoryMetadata: c.parent ? { parentConversationId: c.parent } : {} },
      ]),
    ),
  });
  transport.handlers.GetCascadeTrajectorySteps = (body) => {
    const c = list[(body as { cascadeId: string }).cascadeId];
    return { steps: [{ type: 'CORTEX_STEP_TYPE_RUN_COMMAND', status: c?.step ?? 'CORTEX_STEP_STATUS_DONE' }] };
  };
  transport.handlers.DeleteCascadeTrajectory = (body) => {
    const r = onDelete();
    const id = (body as { cascadeId: string }).cascadeId;
    deleted.push(id);
    for (const gone of subtreeIds(id, Object.entries(list).map(([k, c]) => ({ id: k, parentId: c.parent ?? null })))) delete list[gone];
    return r;
  };
  const finder = new FakeFinder();
  if (!connect) finder.proc = null;
  const adapter = createAppAdapter({ finder, transport, healthIntervalMs: 60_000 });
  await adapter.start();
  const desks = new Map<string, string | null>(Object.keys(convs).map((id) => [id, `desk-${id}`]));
  let refreshed = 0;
  const services = {
    employees: { refresh: async () => void refreshed++ },
    profiles: { update: async (id: string, p: { deskId?: string | null }) => void (p.deskId === null && desks.set(id, null)) },
  } as never;
  const lines: string[] = [];
  const log = createLogger(
    new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    }),
  );
  const server = await createHttpServer({ adapter, log, sessionToken: SESSION, port: 0, webRoot: '/nonexistent', services });
  const port = await server.listen();
  cleanup.push(async () => {
    await server.close();
    await adapter.stop();
  });
  const del = (id: string) => fetch(`http://127.0.0.1:${port}/api/conversations/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${SESSION}` } });
  return { del, deleted, desks, refreshed: () => refreshed, lines };
}

describe('subtreeIds', () => {
  it('collects every descendant and survives a cycle', () => {
    const convs = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: null },
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
    ];
    expect(subtreeIds('a', convs).sort()).toEqual(['a', 'b', 'c']);
    expect(subtreeIds('x', convs).sort()).toEqual(['x', 'y']);
  });
});

describe('L4-1 DELETE /api/conversations/:id', () => {
  it('200 — deletes, frees the desks of the whole tree, refreshes', async () => {
    const t = await setup({ [PARENT]: {}, [CHILD]: { parent: PARENT }, [GRANDCHILD]: { parent: CHILD }, [OTHER]: {} });
    const res = await t.del(PARENT);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { removed: string[] }).removed.sort()).toEqual([PARENT, CHILD, GRANDCHILD].sort());
    expect(t.deleted).toEqual([PARENT]);
    expect(t.desks.get(PARENT)).toBeNull();
    expect(t.desks.get(GRANDCHILD)).toBeNull();
    expect(t.desks.get(OTHER)).toBe(`desk-${OTHER}`);
    expect(t.refreshed()).toBe(1);
  });

  it('400 / 404 / 503', async () => {
    const t = await setup({ [PARENT]: {} });
    expect((await t.del('bad id!')).status).toBe(400);
    expect((await t.del(OTHER)).status).toBe(404);
    const off = await setup({ [PARENT]: {} }, () => ({}), false);
    expect((await off.del(PARENT)).status).toBe(503);
    expect(t.deleted).toEqual([]);
  });

  it('409 — the conversation or any subagent is busy; nothing changes', async () => {
    for (const [convs, busy] of [
      [{ [PARENT]: { status: 'CASCADE_RUN_STATUS_RUNNING' } }, PARENT],
      [{ [PARENT]: {}, [CHILD]: { parent: PARENT, step: 'CORTEX_STEP_STATUS_WAITING' } }, CHILD],
      [{ [PARENT]: { status: 'CASCADE_RUN_STATUS_CANCELING' } }, PARENT],
    ] as const) {
      const t = await setup(convs as Record<string, Conv>);
      const res = await t.del(PARENT);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: { code: string; busyId: string } };
      expect(body.error.code).toBe('AGENT_BUSY');
      expect(body.error.busyId).toBe(busy);
      expect(t.deleted).toEqual([]);
      expect(t.desks.get(PARENT)).toBe(`desk-${PARENT}`);
    }
  });

  it('502 — the App refuses; profiles untouched, App text not leaked', async () => {
    const t = await setup({ [PARENT]: {} }, () => {
      throw new RpcError('app', 'HTTP 500 secret-app-detail', 500);
    });
    const res = await t.del(PARENT);
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain('APP_REJECTED');
    expect(text).not.toContain('secret-app-detail');
    expect(t.desks.get(PARENT)).toBe(`desk-${PARENT}`);
    expect(t.refreshed()).toBe(0);
  });
});
