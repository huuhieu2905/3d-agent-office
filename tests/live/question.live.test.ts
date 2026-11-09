import { beforeAll, describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation } from '../../src/server/app-adapter/index';
import type { QuestionAnswer, Step } from '../../src/shared/domain';
import { sweepTestArtifacts } from './sweep';

// Spec 003 T036 (A3-3e): the agent asks with ask_question; we answer (single, multi, write-in);
// the App records exactly that answer and the agent continues.

beforeAll(async () => {
  await sweepTestArtifacts();
}, 120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CASES: { name: string; prompt: string; answer: (q: NonNullable<Step['question']>) => QuestionAnswer }[] = [
  {
    name: 'single choice',
    prompt: 'Use the ask_question tool once to ask me to pick ONE colour from Red or Blue (single choice). Then repeat my answer. No commands.',
    answer: (q) => ({ answers: [{ selectedOptionIds: [q.entries[0]!.options.at(-1)!.id] }] }),
  },
  {
    name: 'multi-select',
    prompt: 'Use the ask_question tool once, with isMultiSelect true, to ask which days I am free: Mon, Tue, Wed. Then repeat my answer. No commands.',
    answer: (q) => ({ answers: [{ selectedOptionIds: q.entries[0]!.options.slice(0, 2).map((o) => o.id) }] }),
  },
  {
    name: 'write-in',
    prompt: 'Use the ask_question tool once to ask me to pick a fruit from Apple or Pear. Then repeat my answer. No commands.',
    answer: () => ({ answers: [{ selectedOptionIds: [], writeIn: 'Mango' }] }),
  },
];

describe('live: agent questions', () => {
  for (const c of CASES) {
    it(`answers a ${c.name} question and the agent continues`, async () => {
      const a = createAppAdapter();
      await a.start();
      expect(a.getConnection().kind).toBe('connected');
      let id: string | null = null;
      try {
        const models = await a.getModels();
        const model = models.find((m) => /Flash/.test(m.label))?.modelId ?? models[0]!.modelId;
        ({ conversationId: id } = await a.startConversation({ model, parts: [{ text: `[agent-office-test] question-${c.name}. ${c.prompt}` }] }));
        let waiting: Step | undefined;
        for (let i = 0; i < 60 && !waiting; i++) {
          await sleep(2000);
          waiting = (await a.getSteps(id)).find((s) => s.kind === 'question' && s.status === 'WAITING');
        }
        expect(waiting, 'agent asked a question').toBeDefined();
        expect(waiting!.permission).toBeNull();
        const answer = c.answer(waiting!.question!);
        await a.answerQuestion(id, waiting!.question!.requestId, answer);

        let done: Step | undefined;
        for (let i = 0; i < 30 && !done; i++) {
          await sleep(1000);
          done = (await a.getSteps(id)).find((s) => s.index === waiting!.index && s.status !== 'WAITING');
        }
        expect(done?.question?.state).toBe('answered');
        const got = done!.question!.entries[0]!;
        expect(got.selectedOptionIds).toEqual(answer.answers[0]!.selectedOptionIds);
        expect(got.writeIn).toBe(answer.answers[0]!.writeIn ?? null);

        let continued = false;
        for (let i = 0; i < 30 && !continued; i++) {
          await sleep(1000);
          continued = (await a.getSteps(id)).some((s) => s.index > waiting!.index && s.kind === 'agent');
        }
        expect(continued, 'agent continued after the answer').toBe(true);
      } finally {
        await a.stop();
        if (id) await deleteTestConversation(id).catch(() => undefined);
      }
    });
  }
});
