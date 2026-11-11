import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { WsHub } from '../../src/server/http/ws-hub';
import { createLogger } from '../../src/server/log';
import { createServices } from '../../src/server/services/index';
import type { Employee, ProjectConversations } from '../../src/shared/domain';
import { FakeFinder, FakeTransport } from './helpers';

// 009 contracts/api.md: GET /api/projects/:id/conversations, POST join / leave, POST /api/conversations limit, DELETE.

const SESSION = 'session-token-for-membership-0123456789ab';
const P = 'proj-a';
const NEW_ID = '00000000-0000-4000-8000-0000000000e2';
const WRITES = ['StartCascade', 'SendUserCascadeMessage', 'DeleteCascadeTrajectory', 'CancelCascadeInvocation', 'HandleCascadeUserInteraction'];

interface Conv {
  project?: string;
  parent?: string;
  steps?: number;
  minutesAgo?: number;
  running?: boolean;
}

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup(initial: Record<string, Conv>) {
  const list: Record<string, Conv> = { ...initial };
  const transport = new FakeTransport();
  const now = Date.now();
  transport.handlers.GetAllCascadeTrajectories = () => ({
    trajectorySummaries: Object.fromEntries(
      Object.entries(list).map(([id, c]) => [
        id,
        {
          summary: `title ${id}`,
          status: c.running ? 'CASCADE_RUN_STATUS_RUNNING' : 'CASCADE_RUN_STATUS_IDLE',
          stepCount: c.steps ?? 3,
          lastModifiedTime: new Date(now - (c.minutesAgo ?? 0) * 60_000).toISOString(),
          trajectoryMetadata: { projectId: c.project ?? P, ...(c.parent ? { parentConversationId: c.parent } : {}) },
        },
      ]),
    ),
  });
  transport.handlers.GetCascadeTrajectorySteps = () => ({ steps: [] });
  transport.handlers.StartCascade = () => ({ cascadeId: NEW_ID });
  transport.handlers.SendUserCascadeMessage = () => ({});
  transport.handlers.DeleteCascadeTrajectory = (body) => {
    const id = (body as { cascadeId: string }).cascadeId;
    for (const [k, c] of Object.entries(list)) if (k === id || c.parent === id) delete list[k];
    return {};
  };
  const dataDir = await mkdtemp(join(tmpdir(), 'ao-membership-'));
  const log = createLogger(new Writable({ write: (_c, _e, cb) => cb() }));
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
  const services = createServices({ adapter, hub: new WsHub(log), log, dataDir, pollIntervalMs: 60_000 });
  const server = await createHttpServer({ adapter, log, sessionToken: SESSION, services, port: 0, webRoot: '/nonexistent' });
  await adapter.start();
  await services.start();
  const port = await server.listen();
  // Wait until the first poll has seeded members AND published employees (their busy/idle states).
  for (let i = 0; i < 50 && (!(await services.profiles.membersSeeded()) || services.employees.snapshot().employees.length === 0); i++) {
    await services.employees.refresh();
    await new Promise((r) => setTimeout(r, 20));
  }
  cleanup.push(async () => {
    await server.close();
    await services.stop();
    await adapter.stop();
    await new Promise((r) => setTimeout(r, 50)); // let fire-and-forget usage writes land before removing the dir
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5 });
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { authorization: `Bearer ${SESSION}`, 'content-type': 'application/json' };
  const post = (path: string, body: unknown = {}) => fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const get = (path: string) => fetch(`${base}${path}`, { headers });
  const employees = async (): Promise<Employee[]> => {
    await services.employees.refresh();
    return ((await (await get('/api/employees')).json()) as { employees: Employee[] }).employees;
  };
  const writes = () => transport.calls.filter((c) => WRITES.includes(c.method)).map((c) => c.method);
  return { list, services, post, get, employees, writes, del: (id: string) => fetch(`${base}/api/conversations/${id}`, { method: 'DELETE', headers: { authorization: headers.authorization } }) };
}

/** `n` top-level conversations in project P, seeded as members. */
const members = (n: number, running = false): Record<string, Conv> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`m${i}`, { minutesAgo: i, running }]));

describe('GET /api/projects/:id/conversations', () => {
  it('lists only the project top-level non-empty conversations, newest first, with inOffice', async () => {
    const t = await setup({ m0: {} });
    Object.assign(t.list, { old: { minutesAgo: 600 }, newer: { minutesAgo: 5 }, sub: { parent: 'old' }, empty: { steps: 0 }, other: { project: 'proj-b' } });
    const res = await t.get(`/api/projects/${P}/conversations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectConversations;
    expect(body.conversations.map((c) => [c.id, c.inOffice])).toEqual([
      ['m0', true],
      ['newer', false],
      ['old', false],
    ]);
    expect(body).toMatchObject({ members: 1, limit: 20 });
    expect(t.writes()).toEqual([]);
  });

  it('400 on a bad id', async () => {
    const t = await setup({ m0: {} });
    expect((await t.get('/api/projects/bad%20id/conversations')).status).toBe(400);
  });
});

describe('POST /api/conversations/:id/join', () => {
  it('makes a conversation a member without writing to the App; again → alreadyMember', async () => {
    const t = await setup({ m0: {} });
    t.list.old = { minutesAgo: 600 };
    const r1 = await t.post('/api/conversations/old/join');
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ conversationId: 'old', alreadyMember: false, evicted: null });
    expect((await t.employees()).find((e) => e.conversationId === 'old')?.visible).toBe(true);
    expect(await (await t.post('/api/conversations/old/join')).json()).toEqual({ conversationId: 'old', alreadyMember: true, evicted: null });
    expect(t.writes()).toEqual([]);
  });

  it('404 for an unknown conversation, 400 for a subagent', async () => {
    const t = await setup({ m0: {} });
    t.list.sub = { parent: 'm0' };
    expect((await t.post('/api/conversations/nope/join')).status).toBe(404);
    expect((await t.post('/api/conversations/sub/join')).status).toBe(400);
  });

  it('at 20 members the idle member inactive the longest leaves; nothing is deleted in the App', async () => {
    const t = await setup(members(20));
    t.list.extra = { minutesAgo: 900 };
    const res = await t.post('/api/conversations/extra/join');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversationId: 'extra', alreadyMember: false, evicted: { conversationId: 'm19', title: 'title m19' } });
    const emps = await t.employees();
    expect(emps.find((e) => e.conversationId === 'm19')?.visible).toBe(false);
    expect(emps.find((e) => e.conversationId === 'extra')?.visible).toBe(true);
    expect(t.writes()).toEqual([]);
    expect((await t.post('/api/conversations/m3/join')).status).toBe(200);
  });

  it('409 OFFICE_FULL only when all 20 members are busy', async () => {
    const t = await setup(members(20, true));
    t.list.extra = { minutesAgo: 900 };
    const res = await t.post('/api/conversations/extra/join');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'OFFICE_FULL', members: 20, limit: 20 } });
  });
});

describe('POST /api/conversations (new hire)', () => {
  it('the new conversation becomes a member', async () => {
    const t = await setup({ m0: {} });
    const res = await t.post('/api/conversations', { parts: [{ text: 'hi' }], model: 'MODEL_X', projectId: P });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ conversationId: NEW_ID, evicted: null });
    expect(await t.services.profiles.isMember(NEW_ID)).toBe(true);
  });

  it('at 20 members it makes room and reports who left', async () => {
    const t = await setup(members(20));
    const res = await t.post('/api/conversations', { parts: [{ text: 'hi' }], model: 'MODEL_X', projectId: P });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ conversationId: NEW_ID, evicted: { conversationId: 'm19', title: 'title m19' } });
    expect(await t.services.profiles.isMember('m19')).toBe(false);
  });

  it('409 OFFICE_FULL when all 20 are busy, and nothing is created in the App', async () => {
    const t = await setup(members(20, true));
    const res = await t.post('/api/conversations', { parts: [{ text: 'hi' }], model: 'MODEL_X', projectId: P });
    expect(res.status).toBe(409);
    expect(t.writes()).toEqual([]);
  });
});

describe('POST /api/conversations/:id/leave and DELETE', () => {
  it('leave frees member, desk and seat, sends nothing to the App', async () => {
    const t = await setup({ m0: {}, m1: {} });
    expect((await t.services.profiles.get('m1')).deskId).not.toBeNull();
    expect((await t.post('/api/conversations/m1/leave')).status).toBe(200);
    const p = await t.services.profiles.get('m1');
    expect(p).toMatchObject({ memberSince: null, deskId: null, meetingSeatId: null });
    expect((await t.employees()).find((e) => e.conversationId === 'm1')?.visible).toBe(false);
    expect(t.writes()).toEqual([]);
  });

  it('DELETE clears membership for the whole tree', async () => {
    const t = await setup({ m0: {}, m1: {} });
    t.list.child = { parent: 'm1' };
    await t.services.profiles.setMember('child', true); // even if it was ever marked
    expect((await t.del('m1')).status).toBe(200);
    expect(await t.services.profiles.isMember('m1')).toBe(false);
    expect(await t.services.profiles.isMember('child')).toBe(false);
  });
});
