import type { Quota, QuotaGroup } from '../../../shared/domain';
import { groupKey } from './model';

// T088 / R9: GetUserStatus → Quota. Identity (name, email) is dropped before anything else (FR-081).

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !isNaN(Number(v)) ? Number(v) : null);

export function mapQuota(userStatusResponse: unknown, now = new Date()): Quota {
  const us = { ...(((userStatusResponse as Raw | null)?.userStatus as Raw | undefined) ?? {}) };
  delete us.name;
  delete us.email;
  const plan = (us.planStatus ?? {}) as Raw;
  const planInfo = (plan.planInfo ?? {}) as Raw;
  const tier = (us.userTier ?? {}) as Raw;
  const configs = ((us.cascadeModelConfigData as Raw | undefined)?.clientModelConfigs ?? []) as Raw[];

  const groups = new Map<string, QuotaGroup>();
  for (const c of Array.isArray(configs) ? configs : []) {
    const q = c.quotaInfo as Raw | undefined;
    if (!q) continue;
    const key = groupKey(q);
    const frac = num(q.remainingFraction) ?? 1;
    const g =
      groups.get(key) ??
      ({
        key,
        models: [],
        remainingPercent: Math.round(frac * 1000) / 10,
        resetAt: typeof q.resetTime === 'string' ? q.resetTime : null,
        low: frac * 100 < 10,
      } satisfies QuotaGroup);
    const modelId = ((c.modelOrAlias as Raw | undefined)?.model as string | undefined) ?? '';
    g.models.push({ label: typeof c.label === 'string' ? c.label : modelId, modelId });
    groups.set(key, g);
  }

  return {
    planName: (typeof tier.name === 'string' && tier.name) || (typeof planInfo.planName === 'string' && planInfo.planName) || 'Không rõ',
    groups: [...groups.values()].sort((a, b) => a.remainingPercent - b.remainingPercent),
    credits: {
      prompt: { available: num(plan.availablePromptCredits), monthly: num(planInfo.monthlyPromptCredits) },
      flow: { available: num(plan.availableFlowCredits), monthly: num(planInfo.monthlyFlowCredits) },
    },
    fetchedAt: now.toISOString(),
  };
}
