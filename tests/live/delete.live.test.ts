import { beforeAll, describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { createLogger } from '../../src/server/log';
import { sweepTestArtifacts } from './sweep';

// 004 T014 (A4-1d): delete a [agent-office-test] conversation through DELETE /api/conversations/:id on the
// real App and check it is gone. Only ever deletes conversations this test created (Constitution workflow).

const SESSION = 'session-token-for-live-delete-0123456789ab';

beforeAll(async () => {
  await sweepTestArtifacts();
}, 120_000);

describe('live: delete a conversation', () => {
  it('deletes through the route and the App no longer lists it', async () => {
    const a = createAppAdapter();
    await a.start();
    expect(a.getConnection().kind).toBe('connected');
    let conversationId: string | null = null;
    const services = { employees: { refresh: async () => undefined }, profiles: { setMember: async () => undefined } } as never;
    const server = await createHttpServer({ adapter: a, log: createLogger(), sessionToken: SESSION, port: 0, webRoot: '/nonexistent', services });
    const port = await server.listen();
    try {
      const models = await a.getModels();
      const model = models.find((m) => /Flash/.test(m.label))?.modelId ?? models[0]!.modelId;
      ({ conversationId } = await a.startConversation({ parts: [{ text: '[agent-office-test] delete. Reply OK only. No tools.' }], model }));

      // Wait until the App lists it and the agent is idle (the route refuses busy agents).
      let idle = false;
      for (let i = 0; i < 240 && !idle; i++) {
        const c = (await a.listConversations()).find((x) => x.id === conversationId);
        idle = c?.runStatus === 'IDLE';
        if (!idle) await new Promise((r) => setTimeout(r, 500));
      }
      expect(idle).toBe(true);

      const res = await fetch(`http://127.0.0.1:${port}/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${SESSION}` },
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { removed: string[] }).removed).toContain(conversationId);
      expect((await a.listConversations()).some((c) => c.id === conversationId)).toBe(false);
      conversationId = null;
    } finally {
      await server.close();
      await a.stop();
      if (conversationId) await deleteTestConversation(conversationId).catch(() => undefined);
    }
  }, 180_000);
});
