import { afterEach, describe, expect, it } from 'vitest';
import { AppRejectedError, createAppAdapter, QuestionNotPendingError } from '../../src/server/app-adapter/index';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';
import { RpcError } from '../../src/server/app-adapter/types';
import { FakeFinder, FakeTransport, fixtureFrom, hasFixture } from './helpers';

// Spec 003 US2 — contracts/app-adapter.md A3-2a…d (mapper) and A3-3a…d (answerQuestion).
// Inline steps copy the shape of ASK_QUESTION steps seen on App 2.29.0 (2026-11-08 investigation);
// recorded fixtures from spike S1 (T022) are checked too when present.

const TRAJ = '76f2ef1e-f785-4c90-b4b1-22ffaa590698';
const meta = { sourceTrajectoryStepInfo: { trajectoryId: TRAJ } };
const questions = [
  { question: 'Which test label should we use?', options: [{ id: '1', text: 'Alpha' }, { id: '2', text: 'Beta' }] },
  { question: 'Which days are free?', options: [{ id: '1', text: 'Mon' }, { id: '2', text: 'Tue' }, { id: '3', text: 'Wed' }], isMultiSelect: true },
];
const waitingStep = { type: 'CORTEX_STEP_TYPE_ASK_QUESTION', status: 'CORTEX_STEP_STATUS_WAITING', metadata: meta, askQuestion: { questions }, requestedInteraction: { askQuestion: {} } };
const doneStep = {
  type: 'CORTEX_STEP_TYPE_ASK_QUESTION',
  status: 'CORTEX_STEP_STATUS_DONE',
  metadata: meta,
  completedInteractions: [
    {
      request: { askQuestion: { questions } },
      response: {
        trajectoryId: TRAJ,
        stepIndex: 2,
        askQuestion: {
          responses: [
            { question: questions[0]!.question, selectedOptionIds: ['1'] },
            { question: questions[1]!.question, selectedOptionIds: ['1', '3'], writeInResponse: 'Weekends too' },
          ],
        },
      },
    },
  ],
  askQuestion: { questions },
};
const at2 = (step: object) => mapSteps({ steps: [{}, {}, step] })[2]!;

describe('A3-2 — ASK_QUESTION mapping', () => {
  it('A3-2a — a waiting question is a question, never a permission request', () => {
    const s = at2(waitingStep);
    expect(s.kind).toBe('question');
    expect(s.permission).toBeNull();
    expect(s.question).toMatchObject({ requestId: `${TRAJ}:2:askQuestion`, state: 'waiting' });
    expect(s.question!.entries).toEqual([
      { question: 'Which test label should we use?', options: questions[0]!.options, multiSelect: false, selectedOptionIds: [], writeIn: null },
      { question: 'Which days are free?', options: questions[1]!.options, multiSelect: true, selectedOptionIds: [], writeIn: null },
    ]);
  });

  it('A3-2b — an answered question carries the chosen ids and the write-in', () => {
    const s = at2(doneStep);
    expect(s.question!.state).toBe('answered');
    expect(s.question!.entries.map((e) => [e.selectedOptionIds, e.writeIn])).toEqual([
      [['1'], null],
      [['1', '3'], 'Weekends too'],
    ]);
  });

  it('A3-2c — a canceled question', () => {
    expect(at2({ ...waitingStep, status: 'CORTEX_STEP_STATUS_CANCELED', requestedInteraction: undefined }).question!.state).toBe('canceled');
  });

  it('A3-2c — a skipped question (skipped, no answer)', () => {
    const skipped = { ...waitingStep, status: 'CORTEX_STEP_STATUS_DONE', requestedInteraction: undefined, askQuestion: { questions: questions.map((q) => ({ ...q, skipped: true })) } };
    expect(at2(skipped).question!.state).toBe('skipped');
  });

  it('A3-2d — missing isMultiSelect means single choice; garbage does not crash', () => {
    expect(at2(waitingStep).question!.entries[0]!.multiSelect).toBe(false);
    const s = at2({ type: 'CORTEX_STEP_TYPE_ASK_QUESTION', status: 'CORTEX_STEP_STATUS_WAITING', askQuestion: { questions: [null, { options: 'x' }] } });
    expect(s.kind).toBe('question');
    expect(s.question!.entries).toEqual([{ question: '', options: [], multiSelect: false, selectedOptionIds: [], writeIn: null }]);
  });

  it.skipIf(!hasFixture('2.29.0', 'GetCascadeTrajectorySteps.waiting-question'))('recorded waiting question (spike S1)', () => {
    const s = mapSteps(fixtureFrom('2.29.0', 'GetCascadeTrajectorySteps.waiting-question')).filter((x) => x.rawType === 'ASK_QUESTION').at(-1)!;
    expect(s.kind).toBe('question');
    expect(s.permission).toBeNull();
    expect(s.question!.state).toBe('waiting');
    expect(s.question!.entries.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasFixture('2.29.0', 'GetCascadeTrajectorySteps.question'))('recorded answered question (spike S1)', () => {
    const qs = mapSteps(fixtureFrom('2.29.0', 'GetCascadeTrajectorySteps.question')).filter((x) => x.rawType === 'ASK_QUESTION');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.question && q.question.state !== 'waiting')).toBe(true);
    expect(qs.some((q) => q.question!.entries.some((e) => e.selectedOptionIds.length > 0 || e.writeIn))).toBe(true);
  });
});

describe('A3-3 — answerQuestion', () => {
  const stops: (() => Promise<void>)[] = [];
  afterEach(async () => {
    while (stops.length) await stops.pop()!();
  });

  async function setup(step: object = waitingStep) {
    const transport = new FakeTransport();
    const sent: unknown[] = [];
    transport.handlers.GetCascadeTrajectorySteps = () => ({ steps: [{}, {}, step] });
    transport.handlers.HandleCascadeUserInteraction = (b) => (sent.push(b), {});
    const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
    await adapter.start();
    stops.push(() => adapter.stop());
    return { adapter, transport, sent };
  }

  it('A3-3a — sends HandleCascadeUserInteraction with the question text, ids and write-in', async () => {
    const { adapter, sent } = await setup();
    await adapter.answerQuestion('conv-1', `${TRAJ}:2:askQuestion`, {
      answers: [{ selectedOptionIds: ['2'] }, { selectedOptionIds: ['1', '3'], writeIn: 'Weekends too' }],
    });
    expect(sent).toEqual([
      {
        cascadeId: 'conv-1',
        interaction: {
          trajectoryId: TRAJ,
          stepIndex: 2,
          askQuestion: {
            responses: [
              { question: 'Which test label should we use?', selectedOptionIds: ['2'] },
              { question: 'Which days are free?', selectedOptionIds: ['1', '3'], writeInResponse: 'Weekends too' },
            ],
          },
        },
      },
    ]);
  });

  it('A3-3b — refuses when the question is no longer waiting', async () => {
    const { adapter, sent } = await setup(doneStep);
    await expect(adapter.answerQuestion('conv-1', `${TRAJ}:2:askQuestion`, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['1'] }] })).rejects.toBeInstanceOf(
      QuestionNotPendingError,
    );
    expect(sent).toEqual([]);
  });

  it('A3-3c — an App rejection becomes AppRejectedError without the App message', async () => {
    const { adapter, transport } = await setup();
    transport.handlers.HandleCascadeUserInteraction = () => {
      throw new RpcError('protocol', 'HandleCascadeUserInteraction: HTTP 400 (invalid_argument) secret-detail', 400);
    };
    const err = await adapter.answerQuestion('conv-1', `${TRAJ}:2:askQuestion`, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['2'] }] }).catch((e) => e);
    expect(err).toBeInstanceOf(AppRejectedError);
    expect(String(err.message)).not.toContain('secret-detail');
  });

  it('A3-3b — race: the App answers 500 because another window answered first → QuestionNotPendingError', async () => {
    const { adapter, transport } = await setup();
    transport.handlers.HandleCascadeUserInteraction = () => {
      transport.handlers.GetCascadeTrajectorySteps = () => ({ steps: [{}, {}, doneStep] });
      throw new RpcError('app', 'HandleCascadeUserInteraction: HTTP 500 (unknown)', 500);
    };
    await expect(adapter.answerQuestion('conv-1', `${TRAJ}:2:askQuestion`, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['2'] }] })).rejects.toBeInstanceOf(
      QuestionNotPendingError,
    );
  });

  it('reads entries from requestedInteraction when the step itself has none (spike S1)', () => {
    const s = at2({ ...waitingStep, askQuestion: undefined, requestedInteraction: { askQuestion: { questions } } });
    expect(s.question!.entries.map((e) => e.multiSelect)).toEqual([false, true]);
  });

  it('A3-3d — bad request ids never reach the App', async () => {
    const { adapter, sent } = await setup();
    const answer = { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['1'] }] };
    for (const id of ['nonsense', `${TRAJ}:x:askQuestion`, `${TRAJ}:2:permission`]) {
      await expect(adapter.answerQuestion('conv-1', id, answer)).rejects.toMatchObject({ kind: 'protocol' });
    }
    expect(sent).toEqual([]);
  });

  it('answerPermission refuses question request ids', async () => {
    const { adapter, sent } = await setup();
    await expect(adapter.answerPermission('conv-1', `${TRAJ}:2:askQuestion`, 'allow')).rejects.toMatchObject({ kind: 'protocol' });
    expect(sent).toEqual([]);
  });
});
