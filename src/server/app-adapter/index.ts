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
import { sanitizeRaw } from './redact';
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
    watchConversation(): Unsubscribe {
      return () => undefined;
    },
    getSlashCommands: notYet('getSlashCommands') as (m: string) => Promise<Command[]>,
    suggestMentions: notYet('suggestMentions') as (c: string, q: string) => Promise<Mention[]>,
    getModels: notYet('getModels') as () => Promise<ModelOption[]>,
    getQuota: notYet('getQuota') as () => Promise<Quota>,
    async listProjects(): Promise<Project[]> {
      const ids = mapProjectIds(await call('ListProjects', {}));
      if (ids.length === 0) return [];
      return mapProjects(await call('ReadProjects', { ids }));
    },
    sendMessage: notYet('sendMessage') as (c: string, i: UserInput) => Promise<void>,
    startConversation: notYet('startConversation') as AppAdapter['startConversation'],
    cancel: notYet('cancel') as (c: string) => Promise<void>,
    answerPermission: notYet('answerPermission') as AppAdapter['answerPermission'],
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
