import { describe, expect, it } from 'vitest';
import type { ModelOption } from '@shared/domain';
import { resolveModel } from '../../src/web/ui/chat/resolve-model';

// US1 / FR-003, FR-004 (specs/002-realistic-ui-refresh/data-model.md §2).

const models: ModelOption[] = [
  { label: '4 Argon', modelId: 'ARGON', quotaGroupKey: 'a', remainingPercent: 60 },
  { label: '3.8 Flash', modelId: 'FLASH', quotaGroupKey: 'b', remainingPercent: 40 },
  { label: 'Empty', modelId: 'EMPTY', quotaGroupKey: 'c', remainingPercent: 0 },
];

describe('resolveModel', () => {
  it('prefers the model chosen for this conversation', () => {
    expect(resolveModel({ preferredModel: 'FLASH', currentModel: 'ARGON', defaultModel: 'ARGON', models })).toEqual({ modelId: 'FLASH', unavailable: false, source: 'preferred' });
  });
  it('falls back to the model the App used last, then the default, then the first model', () => {
    expect(resolveModel({ preferredModel: null, currentModel: 'FLASH', defaultModel: 'ARGON', models }).modelId).toBe('FLASH');
    expect(resolveModel({ preferredModel: null, currentModel: null, defaultModel: 'FLASH', models }).modelId).toBe('FLASH');
    expect(resolveModel({ preferredModel: null, currentModel: null, defaultModel: null, models }).modelId).toBe('ARGON');
  });
  it('flags a remembered model that is gone or out of quota, without switching silently', () => {
    expect(resolveModel({ preferredModel: 'GONE', currentModel: null, defaultModel: 'ARGON', models })).toEqual({ modelId: 'GONE', unavailable: true, source: 'preferred' });
    expect(resolveModel({ preferredModel: 'EMPTY', currentModel: null, defaultModel: null, models })).toMatchObject({ modelId: 'EMPTY', unavailable: true });
  });
  it('does not flag anything while the model list is still loading', () => {
    expect(resolveModel({ preferredModel: 'FLASH', currentModel: null, defaultModel: null, models: [] })).toEqual({ modelId: 'FLASH', unavailable: false, source: 'preferred' });
    expect(resolveModel({ preferredModel: null, currentModel: null, defaultModel: null, models: [] })).toEqual({ modelId: null, unavailable: false, source: 'none' });
  });
});
