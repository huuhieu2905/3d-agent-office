import { afterEach, describe, expect, it } from 'vitest';
import { AppRejectedError, AppUnavailableError, createAppAdapter } from '../../src/server/app-adapter/index';
import { RpcError } from '../../src/server/app-adapter/types';
import { FakeFinder, FakeTransport, fixtureFrom, hasFixture } from './helpers';

// 004 US2 — contracts/app-adapter.md A4-1a…c (deleteConversation). The recorded App response (T014) is
// used when present; otherwise the App's empty reply `{}` is assumed.

const CONV = '00000000-0000-4000-8000-0000000000d1';
const SECRET = 'very private conversation title 7c1f';
const response = hasFixture('2.29.0', 'DeleteCascadeTrajectory') ? fixtureFrom('2.29.0', 'DeleteCascadeTrajectory') : {};

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

async function setup(handler: (body: unknown) => unknown, initial = [CONV], opts: { keep?: boolean } = {}) {
  const transport = new FakeTransport();
  const listed = new Set(initial);
  transport.handlers.DeleteCascadeTrajectory = ((body: unknown) => {
    const r = handler(body);
    // Like the App: gone afterwards — unless this test simulates the App keeping it (`keep`).
    if (!opts.keep) listed.delete((body as { cascadeId: string }).cascadeId);
    return r;
  }) as never;
  transport.handlers.GetAllCascadeTrajectories = () => ({
    trajectorySummaries: Object.fromEntries([...listed].map((id) => [id, { summary: SECRET, status: 'CASCADE_RUN_STATUS_IDLE' }])),
  });
  transport.handlers.GetCascadeTrajectorySteps = () => ({ steps: [] });
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
  await adapter.start();
  stops.push(() => adapter.stop());
  return { adapter, transport };
}

describe('A4-1 deleteConversation', () => {
  it('A4-1a sends DeleteCascadeTrajectory {cascadeId}', async () => {
    const { adapter, transport } = await setup(() => response);
    await adapter.deleteConversation(CONV);
    const call = transport.calls.find((c) => c.method === 'DeleteCascadeTrajectory');
    expect(call?.body).toEqual({ cascadeId: CONV });
  });

  it('A4-1b not connected → AppUnavailableError; HTTP 500 → AppRejectedError without App text', async () => {
    const { adapter } = await setup(() => {
      throw new RpcError('app', `DeleteCascadeTrajectory: HTTP 500 ${SECRET}`, 500);
    });
    const err = await adapter.deleteConversation(CONV).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppRejectedError);
    expect(String((err as Error).message)).not.toContain(SECRET);

    const off = createAppAdapter({ finder: new FakeFinder(), transport: new FakeTransport(), healthIntervalMs: 60_000 });
    await expect(off.deleteConversation(CONV)).rejects.toBeInstanceOf(AppUnavailableError);
  });

  it('A4-1c the App errors but the conversation is already gone → resolves (idempotent)', async () => {
    const { adapter } = await setup(() => {
      throw new RpcError('protocol', 'DeleteCascadeTrajectory: HTTP 404', 404);
    }, []);
    await expect(adapter.deleteConversation(CONV)).resolves.toBeUndefined();
  });

  it('ends a live watch of the conversation before deleting it (App 2.29.0 brought it back otherwise)', async () => {
    const { adapter, transport } = await setup(() => response);
    let watched = 0;
    adapter.watchConversation(CONV, () => void watched++);
    await new Promise((r) => setTimeout(r, 50));
    await adapter.deleteConversation(CONV);
    const before = transport.calls.length;
    await new Promise((r) => setTimeout(r, 400));
    // No step reads of the deleted conversation after the delete.
    expect(transport.calls.slice(before).filter((c) => c.method === 'GetCascadeTrajectorySteps')).toEqual([]);
  });

  it('still listed after retries → AppRejectedError (the employee stays)', async () => {
    const { adapter, transport } = await setup(() => response, [CONV], { keep: true });
    await expect(adapter.deleteConversation(CONV)).rejects.toBeInstanceOf(AppRejectedError);
    expect(transport.calls.filter((c) => c.method === 'DeleteCascadeTrajectory')).toHaveLength(3);
  });
});
