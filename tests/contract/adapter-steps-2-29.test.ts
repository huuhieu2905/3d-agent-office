import { afterAll, describe, expect, it } from 'vitest';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';
import { forgetSecret, registerSecret } from '../../src/server/log';
import { fixtureFrom, hasFixture } from './helpers';

// Spec 003 US3 — contracts/app-adapter.md A3-2e…g: error text (redacted, never empty) and web search.
// Recorded App data is the primary source; error-message-variants.json only adds edge cases (T038).

const SET = '2.29.0';
const SECRET = '__REGISTERED_SECRET__';
afterAll(() => forgetSecret(SECRET));

describe('ERROR_MESSAGE steps', () => {
  const variants = () => mapSteps(fixtureFrom(SET, 'error-message-variants'));

  it('A3-2e — uses shortError as the text', () => {
    const s = variants()[0]!;
    expect(s.kind).toBe('error');
    expect(s.text).toBe('API error (attempt 1): request failed: read: connection reset by peer');
  });

  it('A3-2e — redacts registered secrets inside the error text', () => {
    registerSecret(SECRET);
    const s = variants()[3]!;
    expect(s.kind).toBe('error');
    expect(s.text).not.toContain(SECRET);
    expect(s.text).toContain('[REDACTED]');
  });

  it('A3-2f — never leaves the text empty', () => {
    expect(variants()[1]!.text).toBe('Unknown error');
    expect(variants()[2]!.text).toBe('Unknown error (code 00000000-0000-4000-8000-000000000003-1)');
  });

  it.skipIf(!hasFixture(SET, 'GetCascadeTrajectorySteps.error-message'))('A3-2e — recorded error step has text', () => {
    const errs = mapSteps(fixtureFrom(SET, 'GetCascadeTrajectorySteps.error-message')).filter((s) => s.rawType === 'ERROR_MESSAGE');
    expect(errs.length).toBeGreaterThan(0);
    for (const e of errs) expect(e.text).toBeTruthy();
  });
});

describe('SEARCH_WEB steps (recorded on App 2.29.0)', () => {
  it('A3-2g — maps to web_search with the query as text', () => {
    const steps = mapSteps(fixtureFrom(SET, 'GetCascadeTrajectorySteps.search-web'));
    const s = steps.find((x) => x.rawType === 'SEARCH_WEB');
    expect(s).toBeDefined();
    expect(s!.kind).toBe('web_search');
    expect(s!.text).toMatch(/^<query:\d+>$/); // fixture content is redacted; the shape is what we check
  });

  it('A3-2g — a missing query does not crash and yields null text', () => {
    const [s] = mapSteps({ steps: [{ type: 'CORTEX_STEP_TYPE_SEARCH_WEB', status: 'CORTEX_STEP_STATUS_DONE', searchWeb: {} }] });
    expect(s).toMatchObject({ kind: 'web_search', text: null });
  });
});
