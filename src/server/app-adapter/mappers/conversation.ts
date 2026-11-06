import { RUN_STATUSES, type Conversation, type RunStatus } from '../../../shared/domain';

// GetAllCascadeTrajectories → Conversation[] (App 2.24.0 JSON). Tolerant to missing fields (A5).

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) || 0 : 0);

export function mapRunStatus(v: unknown): RunStatus {
  const s = typeof v === 'string' ? v.replace(/^CASCADE_RUN_STATUS_/, '') : '';
  return (RUN_STATUSES as readonly string[]).includes(s) ? (s as RunStatus) : 'UNKNOWN';
}

function pick(obj: Raw | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined) return obj[k];
  return undefined;
}

export function mapConversation(id: string, raw: Raw): Conversation {
  const meta = (raw.trajectoryMetadata ?? {}) as Raw;
  const workspaces = pick(meta, 'workspaceUris', 'workspaces') ?? pick(raw, 'workspaceUris');
  const workspaceUris = Array.isArray(workspaces)
    ? workspaces.map((w) => (typeof w === 'string' ? w : str((w as Raw)?.workspaceFolderAbsoluteUri) ?? str((w as Raw)?.uri) ?? '')).filter(Boolean)
    : [];
  const title = str(raw.summary) ?? str(raw.title) ?? 'Nhân viên mới';
  return {
    id,
    title,
    projectId: str(pick(meta, 'projectId')) ?? str(raw.projectId),
    parentId: str(pick(meta, 'parentConversationId', 'parentCascadeId')) ?? str(raw.parentConversationId),
    runStatus: mapRunStatus(raw.status),
    stepCount: num(raw.stepCount),
    lastActivityAt: str(raw.lastModifiedTime) ?? str(raw.createdTime) ?? new Date(0).toISOString(),
    lastUserInputAt: str(raw.lastUserInputTime),
    workspaceUris,
    currentModel: null,
  };
}

export function mapConversations(response: unknown): Conversation[] {
  const summaries = (response as Raw | null)?.trajectorySummaries;
  if (!summaries || typeof summaries !== 'object') return [];
  const entries: [string, Raw][] = Array.isArray(summaries)
    ? (summaries as Raw[]).map((s) => [String(s.trajectoryId ?? s.cascadeId ?? ''), s])
    : Object.entries(summaries as Record<string, Raw>);
  return entries.filter(([id]) => id).map(([id, raw]) => mapConversation(id, raw ?? {}));
}
