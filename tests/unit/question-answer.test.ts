import { describe, expect, it } from 'vitest';
import type { AgentQuestion } from '../../src/shared/domain';
import { questionAnswerSchema, validateAnswer } from '../../src/shared/schemas';

// Spec 003 data-model §5 — server-side validation of a question answer (T025).

const q: AgentQuestion = {
  requestId: 't:2:askQuestion',
  state: 'waiting',
  entries: [
    { question: 'one', options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }], multiSelect: false, selectedOptionIds: [], writeIn: null },
    { question: 'many', options: [{ id: '1', text: 'X' }, { id: '2', text: 'Y' }, { id: '3', text: 'Z' }], multiSelect: true, selectedOptionIds: [], writeIn: null },
  ],
};

describe('validateAnswer', () => {
  it('accepts one id for a single-choice entry and several for a multi-select entry', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['1', '3'] }] })).toBeNull();
  });
  it('accepts a write-in instead of a choice', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: [], writeIn: 'Tím' }, { selectedOptionIds: ['2'] }] })).toBeNull();
  });
  it('requires an answer for every sub-question', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['1'] }] })).toMatch(/câu/);
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: [], writeIn: '   ' }] })).toMatch(/câu 2/i);
  });
  it('rejects several ids on a single-choice entry', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['1', '2'] }, { selectedOptionIds: ['1'] }] })).toMatch(/một/);
  });
  it('rejects unknown option ids and duplicates', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['9'] }, { selectedOptionIds: ['1'] }] })).toMatch(/không tồn tại/);
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['2', '2'] }] })).toMatch(/trùng/);
  });
  it('rejects a write-in longer than 2 000 characters', () => {
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: [], writeIn: 'x'.repeat(2001) }, { selectedOptionIds: ['1'] }] })).toMatch(/2 000/);
    expect(validateAnswer(q, { answers: [{ selectedOptionIds: [], writeIn: 'x'.repeat(2000) }, { selectedOptionIds: ['1'] }] })).toBeNull();
  });
  it('rejects answers to a question that is not waiting', () => {
    expect(validateAnswer({ ...q, state: 'answered' }, { answers: [{ selectedOptionIds: ['1'] }, { selectedOptionIds: ['1'] }] })).toMatch(/không còn/);
  });
});

describe('questionAnswerSchema', () => {
  it('parses a well-formed body and rejects junk', () => {
    expect(questionAnswerSchema.safeParse({ answers: [{ selectedOptionIds: ['1'], writeIn: 'x' }] }).success).toBe(true);
    expect(questionAnswerSchema.safeParse({ answers: [] }).success).toBe(false);
    expect(questionAnswerSchema.safeParse({ answers: [{ selectedOptionIds: 'x' }] }).success).toBe(false);
    expect(questionAnswerSchema.safeParse({ answers: [{ selectedOptionIds: [], writeIn: 'x'.repeat(2001) }] }).success).toBe(false);
  });
});
