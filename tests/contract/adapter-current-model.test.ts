import { describe, expect, it } from 'vitest';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';
import { latestRequestedModel } from '../../src/shared/model';
import { fixture } from './helpers';

// A2-1 (specs/002-realistic-ui-refresh/contracts/app-adapter.md): the model a conversation used last
// comes from the App's steps — the user's requested model on the latest user turn.

describe('A2-1 — current model of a conversation', () => {
  it('reads the requested model of the last user turn from the 2.24.0 fixture', () => {
    const steps = mapSteps(fixture('GetCascadeTrajectorySteps'));
    const userSteps = steps.filter((s) => s.kind === 'user');
    expect(userSteps.length).toBeGreaterThan(0);
    expect(userSteps.at(-1)!.model).toBe('MODEL_PLACEHOLDER_M318');
    expect(latestRequestedModel(steps)).toBe('MODEL_PLACEHOLDER_M318');
  });

  it('is null when no step carries a model', () => {
    const steps = mapSteps({ steps: [{ type: 'CORTEX_STEP_TYPE_USER_INPUT', status: 'CORTEX_STEP_STATUS_DONE', userInput: { items: [{ text: 'hi' }] } }] });
    expect(steps[0]!.model).toBeNull();
    expect(latestRequestedModel(steps)).toBeNull();
  });

  it('is null (and does not throw) when the model field has the wrong type', () => {
    const steps = mapSteps({
      steps: [{ type: 'CORTEX_STEP_TYPE_USER_INPUT', userInput: { items: [{ text: 'x' }], userConfig: { plannerConfig: { planModel: 42 } } } }],
    });
    expect(steps[0]!.model).toBeNull();
    expect(latestRequestedModel(steps)).toBeNull();
  });

  it('never reports an agent-side model as the requested one', () => {
    const steps = mapSteps({ steps: [{ type: 'CORTEX_STEP_TYPE_PLANNER_RESPONSE', metadata: { generatorModel: 'MODEL_X' }, plannerResponse: { response: 'ok' } }] });
    expect(latestRequestedModel(steps)).toBeNull();
  });
});
