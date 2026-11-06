import type {
  Command,
  ConnectionState,
  Conversation,
  Mention,
  ModelOption,
  Project,
  Quota,
  Step,
  UserInput,
} from '../../shared/domain';
import { ConnectionManager } from './connection';
import { createProcessFinder, type ProcessFinder } from './discovery/process-finder';
import { mapConversations } from './mappers/conversation';
import { mapSteps } from './mappers/step';
import { mapProjectIds, mapProjects } from './mappers/project';
import { mapModels, toItems } from './mappers/model';
import { openStream, type StreamHandle } from './stream';
import { sanitizeRaw, stripIdentity } from './redact';
import { HttpsRpcTransport, RpcClient, type RpcTransport } from './rpc-client';
import { AppNotSupportedError, AppUnavailableError, RpcError, type AppAdapter, type Unsubscribe } from './types';

export { AppUnavailableError, AppProtocolError, AppNotSupportedError } from './types';
export type { AppAdapter, Unsubscribe } from './types';

export interface AdapterDeps {
  finder?: ProcessFinder;
  transport?: RpcTransport;
  healthIntervalMs?: number;
}

/** Everything the rest of the server knows about the App goes through this object (Constitution II). */
export function createAppAdapter(deps: AdapterDeps = {}): AppAdapter {
  return createInternal(deps).adapter;
}

function createInternal(deps: AdapterDeps): { adapter: AppAdapter; rpc: RpcClient } {
  const transport = deps.transport ?? new HttpsRpcTransport();
  const conn = new ConnectionManager({
    finder: deps.finder ?? createProcessFinder(),
    transport,
    intervalMs: deps.healthIntervalMs,
  });
  const rpc = new RpcClient(transport, () => conn.getTarget());

  async function call<T>(method: string, body: unknown = {}, timeoutMs?: number): Promise<T> {
    if (conn.getState().kind !== 'connected') throw new AppUnavailableError();
    try {
      return await rpc.call<T>(method, body, timeoutMs);
    } catch (err) {
      if (err instanceof RpcError && (err.kind === 'auth' || err.kind === 'unreachable')) {
        conn.invalidate();
        throw new AppUnavailableError();
      }
      throw err;
    }
  }

  // GetUserStatus is large (~25 KB); share one response for models and quota for a few seconds.
  let statusCache: { at: number; value: Promise<unknown> } | null = null;
  function userStatus(maxAgeMs = 5_000): Promise<unknown> {
    if (!statusCache || Date.now() - statusCache.at > maxAgeMs) {
      statusCache = { at: Date.now(), value: call('GetUserStatus', {}).then((r) => stripIdentity(r as Record<string, unknown>)) };
      statusCache.value.catch(() => (statusCache = null));
    }
    return statusCache.value;
  }

  /**
   * Live steps for one conversation: StreamAgentStateUpdates signals changes (and carries growing
   * `thinking`), then steps are re-read. Falls back to polling (500 ms running / 5 s idle).
   */
  function watch(conversationId: string, cb: (steps: Step[]) => void): Unsubscribe {
    let stopped = false;
    let stream: StreamHandle | null = null;
    let timer: NodeJS.Timeout | null = null;
    let pending = false;
    let lastJson = new Map<number, string>();
    let liveThinking: string | null = null;
    let running = false;

    const emitChanged = async () => {
      if (stopped || pending) return;
      pending = true;
      try {
        const steps = await adapter.getSteps(conversationId);
        const last = steps.at(-1);
        if (last && last.status === 'GENERATING' && liveThinking && (last.thinking?.length ?? 0) < liveThinking.length) {
          last.thinking = liveThinking;
        }
        const changed = steps.filter((s) => lastJson.get(s.index) !== JSON.stringify(s));
        lastJson = new Map(steps.map((s) => [s.index, JSON.stringify(s)]));
        if (changed.length) cb(changed);
      } catch {
        /* transient; next signal retries */
      } finally {
        pending = false;
      }
    };

    let throttle: NodeJS.Timeout | null = null;
    const signal = () => {
      if (throttle) return;
      throttle = setTimeout(() => {
        throttle = null;
        void emitChanged();
      }, 300);
    };

    const poll = () => {
      if (stopped) return;
      void emitChanged();
      timer = setTimeout(poll, running ? 500 : 5_000);
    };

    const startStream = () => {
      const target = conn.getTarget();
      if (!target || stopped) return poll();
      stream = openStream(
        target,
        'StreamAgentStateUpdates',
        { conversationId, subscriberId: `agent-office-${process.pid}` },
        (msg) => {
          const update = (msg.update ?? {}) as Record<string, unknown>;
          running = String(update.status ?? '').endsWith('RUNNING');
          const steps = ((update.mainTrajectoryUpdate as Record<string, unknown> | undefined)?.stepsUpdate as
            | { steps?: Record<string, unknown>[] }
            | undefined)?.steps;
          const t = steps?.map((s) => (s.plannerResponse as Record<string, unknown> | undefined)?.thinking).filter(Boolean).at(-1);
          if (typeof t === 'string') liveThinking = t;
          signal();
        },
        (err) => {
          stream = null;
          if (stopped) return;
          // Stream ended or unsupported: poll instead (R7 fallback).
          void err;
          poll();
        },
      );
    };

    void emitChanged();
    startStream();
    return () => {
      stopped = true;
      stream?.close();
      if (timer) clearTimeout(timer);
      if (throttle) clearTimeout(throttle);
    };
  }

  const notYet = (what: string) => () => Promise.reject(new AppNotSupportedError(`${what} is not implemented yet`));

  const adapter: AppAdapter = {
    start: () => conn.start(),
    stop: async () => conn.stop(),
    onConnectionChange: (cb: (s: ConnectionState) => void): Unsubscribe => conn.onChange(cb),
    getConnection: () => conn.getState(),

    async listConversations(): Promise<Conversation[]> {
      return mapConversations(await call('GetAllCascadeTrajectories', {}));
    },
    async getSteps(conversationId: string, fromIndex = 0): Promise<Step[]> {
      return mapSteps(await call('GetCascadeTrajectorySteps', { cascadeId: conversationId }), fromIndex);
    },
    watchConversation(conversationId: string, cb: (steps: Step[]) => void): Unsubscribe {
      return watch(conversationId, cb);
    },
    getSlashCommands: notYet('getSlashCommands') as (m: string) => Promise<Command[]>,
    suggestMentions: notYet('suggestMentions') as (c: string, q: string) => Promise<Mention[]>,
    async getModels(): Promise<ModelOption[]> {
      return mapModels(await userStatus());
    },
    getQuota: notYet('getQuota') as () => Promise<Quota>,
    async listProjects(): Promise<Project[]> {
      const ids = mapProjectIds(await call('ListProjects', {}));
      if (ids.length === 0) return [];
      return mapProjects(await call('ReadProjects', { ids }));
    },
    async sendMessage(conversationId: string, input: UserInput): Promise<void> {
      // Sent as a USER_INPUT step, exactly like typing in the App (A6) — not agentapi's system message.
      await call('SendUserCascadeMessage', {
        cascadeId: conversationId,
        items: toItems(input),
        cascadeConfig: { plannerConfig: { planModel: input.model } },
      });
    },
    async startConversation(input: UserInput & { projectId?: string }): Promise<{ conversationId: string }> {
      // Spike T028(a): source + projectEnvConfig.defaultProjectEnvironment are required.
      const res = await call<{ cascadeId?: string }>('StartCascade', {
        source: 'CORTEX_TRAJECTORY_SOURCE_INTERACTIVE_CASCADE',
        projectEnvConfig: { projectId: input.projectId ?? 'default-cli-project', defaultProjectEnvironment: {} },
      });
      if (!res.cascadeId) throw new RpcError('protocol', 'StartCascade returned no cascadeId');
      await adapter.sendMessage(res.cascadeId, input);
      return { conversationId: res.cascadeId };
    },
    async cancel(conversationId: string): Promise<void> {
      await call('CancelCascadeInvocation', { cascadeId: conversationId });
    },
    async answerPermission(conversationId: string, requestId: string, decision: 'allow' | 'deny'): Promise<void> {
      // Spike T079: HandleCascadeUserInteraction {cascadeId, interaction:{trajectoryId, stepIndex, <kind>:{...}}}
      const [trajectoryId, idx, kind = 'permission'] = requestId.split(':');
      const stepIndex = Number(idx);
      if (!trajectoryId || !Number.isInteger(stepIndex)) throw new RpcError('protocol', 'bad permission request id');
      const allow = decision === 'allow';
      const answer =
        kind === 'runCommand' || kind === 'approvalInteraction' ? { confirm: allow } : { allow };
      await call('HandleCascadeUserInteraction', {
        cascadeId: conversationId,
        interaction: { trajectoryId, stepIndex, [kind]: answer },
      });
    },
  };
  return { adapter, rpc };
}

// ---- Development-only fixture recording (T023) ----------------------------------

const READ_ONLY_RPCS = [
  'GetAllCascadeTrajectories',
  'GetCascadeTrajectorySteps',
  'GetCascadeTrajectory',
  'GetUserStatus',
  'GetSlashCommands',
  'GetAllSkills',
  'GetAllWorkflows',
  'GetAvailableModels',
  'GetMatchingContextScopeItems',
  'ListProjects',
  'ReadProjects',
] as const;
export type ReadOnlyRpc = (typeof READ_ONLY_RPCS)[number];

/** Call a whitelisted read-only RPC and return sanitized raw JSON. Only for scripts/record-fixtures.ts. */
export async function recordRaw(method: ReadOnlyRpc, body: unknown, deps: AdapterDeps = {}): Promise<unknown> {
  if (!READ_ONLY_RPCS.includes(method)) throw new Error(`RPC ${method} is not whitelisted for recording`);
  const { adapter, rpc } = createInternal({ ...deps, healthIntervalMs: 60_000 });
  await adapter.start();
  try {
    if (adapter.getConnection().kind !== 'connected') throw new AppUnavailableError();
    return sanitizeRaw(await rpc.call(method, body, 30_000));
  } finally {
    await adapter.stop();
  }
}

/**
 * Development/test-only cleanup: delete a conversation, but ONLY if its title or first message marks it
 * as a test conversation ("[agent-office-test]"). Used by tests/live and spikes (constitution workflow).
 */
export async function deleteTestConversation(conversationId: string, deps: AdapterDeps = {}): Promise<boolean> {
  const { adapter, rpc } = createInternal({ ...deps, healthIntervalMs: 60_000 });
  await adapter.start();
  try {
    if (adapter.getConnection().kind !== 'connected') throw new AppUnavailableError();
    const conv = (await adapter.listConversations()).find((c) => c.id === conversationId);
    if (!conv) return false;
    const first = (await adapter.getSteps(conversationId)).find((s) => s.kind === 'user');
    const isTest = conv.title.includes('[agent-office-test]') || (first?.text ?? '').startsWith('[agent-office-test]');
    if (!isTest) throw new Error('Refusing to delete a conversation that is not marked [agent-office-test]');
    await rpc.call('DeleteCascadeTrajectory', { cascadeId: conversationId });
    return true;
  } finally {
    await adapter.stop();
  }
}
