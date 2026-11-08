import type { ModelOption } from '@shared/domain';

// 002 US1 / FR-003, FR-004 (data-model §2): which model the chat shows for a conversation.
// Order: the model picked for this conversation → the model the App used last → the settings default →
// the first model. A remembered model that is gone or out of quota is kept and flagged, never swapped.

export interface ResolvedModel {
  modelId: string | null;
  unavailable: boolean;
  source: 'preferred' | 'current' | 'default' | 'first' | 'none';
}

export function resolveModel(o: {
  preferredModel: string | null | undefined;
  currentModel: string | null | undefined;
  defaultModel: string | null | undefined;
  models: readonly ModelOption[];
}): ResolvedModel {
  const pick: [ResolvedModel['source'], string | null | undefined][] = [
    ['preferred', o.preferredModel],
    ['current', o.currentModel],
    ['default', o.defaultModel],
    ['first', o.models[0]?.modelId],
  ];
  const hit = pick.find(([, id]) => !!id);
  if (!hit) return { modelId: null, unavailable: false, source: 'none' };
  const [source, modelId] = hit as [ResolvedModel['source'], string];
  // While the list is loading nothing can be judged unavailable.
  if (o.models.length === 0) return { modelId, unavailable: false, source };
  const m = o.models.find((x) => x.modelId === modelId);
  const unavailable = !m || (m.remainingPercent != null && m.remainingPercent <= 0);
  return { modelId, unavailable, source };
}
