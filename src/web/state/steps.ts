import { create } from 'zustand';
import type { Step } from '@shared/domain';

// T068: steps per conversation, merged and de-duplicated by `index`, whether they come from the
// history load (GET steps) or the live stream (steps.append) — messages typed in the App or here
// therefore appear exactly once.

interface StepsStore {
  byConversation: Record<string, Step[]>;
  merge(conversationId: string, steps: Step[]): void;
  clear(conversationId: string): void;
}

export function mergeSteps(existing: Step[], incoming: Step[]): Step[] {
  const map = new Map<number, Step>();
  for (const s of existing) map.set(s.index, s);
  for (const s of incoming) map.set(s.index, s);
  return [...map.values()].sort((a, b) => a.index - b.index);
}

export const useSteps = create<StepsStore>((set) => ({
  byConversation: {},
  merge: (id, steps) =>
    set((s) => ({ byConversation: { ...s.byConversation, [id]: mergeSteps(s.byConversation[id] ?? [], steps) } })),
  clear: (id) =>
    set((s) => {
      const next = { ...s.byConversation };
      delete next[id];
      return { byConversation: next };
    }),
}));
