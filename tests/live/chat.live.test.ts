import { describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation } from '../../src/server/app-adapter/index';

// T062: A6 (messages are USER_INPUT, not SYSTEM_MESSAGE) and A7 (cancel → IDLE ≤ 3 s) on the real App.

describe('live: chat', () => {
  it('sends as the user and cancels within 3 s', async () => {
    const a = createAppAdapter();
    await a.start();
    expect(a.getConnection().kind).toBe('connected');
    const model = (await a.getModels()).find((m) => /Flash/.test(m.label))?.modelId ?? (await a.getModels())[0]!.modelId;
    const { conversationId: id } = await a.startConversation({ parts: [{ text: '[agent-office-test] chat. Reply OK only. No tools.' }], model });
    try {
      await new Promise((r) => setTimeout(r, 6000));
      await a.sendMessage(id, { parts: [{ text: 'Write 500 words about the sea. No tools.' }], model });
      await new Promise((r) => setTimeout(r, 2500));
      const steps = await a.getSteps(id);
      const users = steps.filter((s) => s.kind === 'user');
      expect(users.length).toBeGreaterThanOrEqual(2);
      expect(users.every((s) => s.rawType === 'USER_INPUT')).toBe(true);
      const t0 = Date.now();
      await a.cancel(id);
      let status = '';
      while (Date.now() - t0 < 3000) {
        status = (await a.listConversations()).find((c) => c.id === id)?.runStatus ?? '';
        if (status === 'IDLE') break;
        await new Promise((r) => setTimeout(r, 150));
      }
      expect(status).toBe('IDLE');
    } finally {
      await a.stop();
      await deleteTestConversation(id).catch(() => undefined);
    }
  });
});
