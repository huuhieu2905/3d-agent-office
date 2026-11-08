import type { Step } from './domain';

// A2-1: the model a conversation used last = the requested model of its latest user turn that has one.
export function latestRequestedModel(steps: readonly Step[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.kind === 'user' && s.model) return s.model;
  }
  return null;
}

/** Model ids are opaque App identifiers such as MODEL_PLACEHOLDER_M318 (contracts/local-api.md L2-3). */
export const MODEL_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
