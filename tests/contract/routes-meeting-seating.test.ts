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
import type { Employee, OfficeLayout } from '../../src/shared/domain';
import { FakeFinder, FakeTransport } from './helpers';

// 007 US3 — contracts/local-api.md L7-1 / L7-4: meetingSeating in PUT /api/layout; desks stay reserved.

const SESSION = 'session-token-for-meeting-seats-0123456789';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), 'ao-meeting-'));
  const log = createLogger(new Writable({ write: (_c, _e, cb) => cb() }));
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport: new FakeTransport(), healthIntervalMs: 60_000 });
  const services = createServices({ adapter, hub: new WsHub(log), log, dataDir, pollIntervalMs: 60_000 });
  const server = await createHttpServer({ adapter, log, sessionToken: SESSION, services, port: 0, webRoot: '/nonexistent' });
  await adapter.start();
  await services.start();
  const port = await server.listen();
  // The adapter connects asynchronously; wait until the fake App's conversations are seated.
  for (let i = 0; i < 50 && !services.employees.snapshot().employees.some((e) => e.deskId); i++) {
    await services.employees.refresh();
    await new Promise((r) => setTimeout(r, 50));
  }
  cleanup.push(async () => {
    await server.close();
    await services.stop();
    await adapter.stop();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5 });
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { authorization: `Bearer ${SESSION}`, 'content-type': 'application/json' };
  const employees = async (): Promise<Employee[]> => {
    await services.employees.refresh();
    return ((await (await fetch(`${base}/api/employees`, { headers })).json()) as { employees: Employee[] }).employees;
  };
  const layout = async (): Promise<OfficeLayout> => (await fetch(`${base}/api/layout`, { headers })).json() as Promise<OfficeLayout>;
  const put = (body: unknown) => fetch(`${base}/api/layout`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { employees, layout, put };
}

const withTable = (l: OfficeLayout): OfficeLayout => ({
  ...l,
  items: [...l.items, { id: 'mt-1', type: 'meeting_table_8', pos: { x: 14, z: 3 }, rotation: 90 }],
});

describe('L7-1 meetingSeating', () => {
  it('saves a meeting seat and keeps the desk reserved', async () => {
    const t = await setup();
    const [a] = (await t.employees()).filter((e) => e.deskId);
    expect(a).toBeDefined();
    const res = await t.put({ layout: withTable(await t.layout()), meetingSeating: { [a!.conversationId]: 'mt-1#3' } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { meetingSeating: Record<string, string> }).meetingSeating).toEqual({ [a!.conversationId]: 'mt-1#3' });
    const after = (await t.employees()).find((e) => e.conversationId === a!.conversationId)!;
    expect(after).toMatchObject({ meetingSeatId: 'mt-1#3', deskId: a!.deskId });
  });

  it('an employee without a desk is not given one while in a meeting', async () => {
    const t = await setup();
    const [a] = (await t.employees()).filter((e) => e.deskId);
    // Take the desk away and seat them at the table in the same save; desks are free afterwards.
    const res = await t.put({ layout: withTable(await t.layout()), seating: { [a!.conversationId]: null }, meetingSeating: { [a!.conversationId]: 'mt-1#0' } });
    expect(res.status).toBe(200);
    const after = (await t.employees()).find((e) => e.conversationId === a!.conversationId)!;
    expect(after).toMatchObject({ meetingSeatId: 'mt-1#0', deskId: null });
  });

  it('422 for a duplicate seat, a seat out of range or a desk id', async () => {
    const t = await setup();
    const [a, b] = (await t.employees()).filter((e) => e.deskId);
    const l = withTable(await t.layout());
    const dup = await t.put({ layout: l, meetingSeating: { [a!.conversationId]: 'mt-1#1', [b!.conversationId]: 'mt-1#1' } });
    expect(dup.status).toBe(422);
    expect(((await dup.json()) as { conversationIds: string[] }).conversationIds).toEqual([b!.conversationId]);
    expect((await t.put({ layout: l, meetingSeating: { [a!.conversationId]: 'mt-1#8' } })).status).toBe(422);
    expect((await t.put({ layout: l, meetingSeating: { [a!.conversationId]: a!.deskId } })).status).toBe(422);
  });

  it('a body without meetingSeating behaves as before', async () => {
    const t = await setup();
    const res = await t.put({ layout: withTable(await t.layout()) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { meetingSeating: unknown }).meetingSeating).toEqual({});
  });
});
