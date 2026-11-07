import type { ModelOption, UserInput } from '../../../shared/domain';

// GetUserStatus.cascadeModelConfigData.clientModelConfigs[] → ModelOption[]; UserInput → App `items`.

type Raw = Record<string, unknown>;

export function groupKey(q: Raw | undefined): string {
  return `${q?.remainingFraction ?? 'na'}|${q?.resetTime ?? 'na'}`;
}

export function mapModels(userStatusResponse: unknown): ModelOption[] {
  const us = (userStatusResponse as Raw | null)?.userStatus as Raw | undefined;
  const data = us?.cascadeModelConfigData as Raw | undefined;
  const configs = Array.isArray(data?.clientModelConfigs) ? (data!.clientModelConfigs as Raw[]) : [];
  return configs
    .map((c) => {
      const model = ((c.modelOrAlias as Raw | undefined)?.model as string | undefined) ?? '';
      const q = c.quotaInfo as Raw | undefined;
      const frac = typeof q?.remainingFraction === 'number' ? q.remainingFraction : null;
      return {
        label: typeof c.label === 'string' ? c.label : model,
        modelId: model,
        quotaGroupKey: groupKey(q),
        remainingPercent: frac == null ? null : Math.round(frac * 1000) / 10,
      };
    })
    .filter((m) => m.modelId);
}

/** Build the App's `items` array: text parts and file mentions (spike 2026-11-06). */
export function toItems(input: UserInput): Raw[] {
  return input.parts.map((p) =>
    'text' in p ? { text: p.text } : { item: { [p.mention.kind === 'directory' ? 'directory' : 'file']: { absoluteUri: p.mention.uri } } },
  );
}
