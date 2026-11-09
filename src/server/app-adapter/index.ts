import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Command,
  ConnectionState,
  Conversation,
  Mention,
  ModelOption,
  Project,
  QuestionAnswer,
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
import { mapCommands } from './mappers/command';
import { mapQuota } from './mappers/quota';
import { openStream, type StreamHandle } from './stream';
import { sanitizeRaw, stripIdentity } from './redact';
import { HttpsRpcTransport, RpcClient, type RpcTransport } from './rpc-client';
import { AppRejectedError, AppUnavailableError, ProjectNameTakenError, QuestionNotPendingError, RpcError, type AppAdapter, type CompatReport, type Unsubscribe } from './types';
import { countUnknownStepTypes, diffPaths, normalizedPaths, scanRpcNames, USED_RPCS } from './compat';
import { isVerified, verifiedVersionList } from './versions';

export { AppUnavailableError, AppProtocolError, AppNotSupportedError, AppRejectedError, ProjectNameTakenError, QuestionNotPendingError, RpcError } from './types';
export { sanitizeRaw } from './redact';
export type { AppAdapter, CompatReport, Unsubscribe } from './types';

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
  const commandCache = new Map<string, { at: number; value: Command[] }>();
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
    async getSlashCommands(model: string): Promise<Command[]> {
      const hit = commandCache.get(model);
      if (hit && Date.now() - hit.at < 60_000) return hit.value;
      const value = mapCommands(await call('GetSlashCommands', { cascadeConfig: { plannerConfig: { planModel: model } } }));
      commandCache.set(model, { at: Date.now(), value });
      return value;
    },
    async suggestMentions(conversationId: string, query: string): Promise<Mention[]> {
      // App-side search (returned nothing without an IDE workspace on the first verified App); the server falls back to its own listing.
      const conv = (await adapter.listConversations()).find((c) => c.id === conversationId);
      const res = await call<Record<string, unknown>>('GetMatchingContextScopeItems', {
        query,
        workspaceUris: conv?.workspaceUris ?? [],
      }).catch(() => ({}) as Record<string, unknown>);
      const items = (res.items ?? res.scopeItems ?? []) as Record<string, unknown>[];
      const out: Mention[] = [];
      for (const it of Array.isArray(items) ? items : []) {
        const file = (it.file ?? (it.item as Record<string, unknown> | undefined)?.file) as Record<string, unknown> | undefined;
        const uri = typeof file?.absoluteUri === 'string' ? file.absoluteUri : null;
        if (uri) out.push({ kind: 'file', uri, label: uri.split('/').pop() ?? uri });
      }
      return out.slice(0, 50);
    },
    async getModels(): Promise<ModelOption[]> {
      return mapModels(await userStatus());
    },
    async getQuota(maxAgeMs = 5_000): Promise<Quota> {
      return mapQuota(await userStatus(maxAgeMs));
    },
    async listProjects(): Promise<Project[]> {
      const ids = mapProjectIds(await call('ListProjects', {}));
      if (ids.length === 0) return [];
      return mapProjects(await call('ReadProjects', { ids }));
    },
    async createProject({ name, folderUri }: { name: string; folderUri: string }): Promise<Project> {
      // Spike 2026-11-07: the App only creates the project when the client supplies the id.
      const id = randomUUID();
      try {
        await call('CreateProject', { project: { id, name, projectResources: { resources: [{ folderUri }] } } });
      } catch (err) {
        if (err instanceof RpcError && err.status === 409) throw new ProjectNameTakenError();
        throw err;
      }
      const created = mapProjects(await call('ReadProjects', { ids: [id] }))[0];
      if (!created) throw new RpcError('protocol', 'CreateProject did not create the project');
      return created;
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
      // Spike T084: HandleCascadeUserInteraction {cascadeId, interaction:{trajectoryId, stepIndex, <kind>:{...}}}
      const [trajectoryId, idx, kind = 'permission'] = requestId.split(':');
      const stepIndex = Number(idx);
      if (!trajectoryId || !Number.isInteger(stepIndex)) throw new RpcError('protocol', 'bad permission request id');
      // Spec 003 R3-07: questions are answered with answerQuestion, never allow/deny.
      if (kind === 'askQuestion') throw new RpcError('protocol', 'question request ids are answered with answerQuestion');
      const allow = decision === 'allow';
      const answer =
        kind === 'runCommand' || kind === 'approvalInteraction' ? { confirm: allow } : { allow };
      await call('HandleCascadeUserInteraction', {
        cascadeId: conversationId,
        interaction: { trajectoryId, stepIndex, [kind]: answer },
      });
    },
    async answerQuestion(conversationId: string, requestId: string, answer: QuestionAnswer): Promise<void> {
      // Spec 003 R3-04: HandleCascadeUserInteraction {cascadeId, interaction:{trajectoryId, stepIndex,
      // askQuestion:{responses:[{question, selectedOptionIds, writeInResponse?}]}}} — the same shape the App
      // records in completedInteractions[].response when the user answers inside the App.
      const [trajectoryId, idx, kind] = requestId.split(':');
      const stepIndex = Number(idx);
      if (!trajectoryId || !Number.isInteger(stepIndex) || stepIndex < 0 || kind !== 'askQuestion') {
        throw new RpcError('protocol', 'bad question request id');
      }
      const step = (await adapter.getSteps(conversationId)).find((s) => s.index === stepIndex);
      if (!step?.question || step.status !== 'WAITING' || step.question.state !== 'waiting') throw new QuestionNotPendingError();
      const responses = step.question.entries.map((e, i) => {
        const a = answer.answers[i] ?? { selectedOptionIds: [] };
        const writeIn = a.writeIn?.trim();
        return { question: e.question, selectedOptionIds: a.selectedOptionIds, ...(writeIn ? { writeInResponse: writeIn } : {}) };
      });
      try {
        await call('HandleCascadeUserInteraction', {
          cascadeId: conversationId,
          interaction: { trajectoryId, stepIndex, askQuestion: { responses } },
        });
      } catch (err) {
        if (err instanceof RpcError && err.kind === 'protocol' && (err.status ?? 0) >= 400 && (err.status ?? 0) < 500) throw new AppRejectedError();
        // Spike S1: answering a question that is no longer waiting makes the App reply HTTP 500. If another
        // window answered between our check and the call, report "not pending" instead of a server error.
        if (err instanceof RpcError && err.kind === 'app') {
          const now = (await adapter.getSteps(conversationId).catch(() => [])).find((s) => s.index === stepIndex);
          if (!now || now.status !== 'WAITING') throw new QuestionNotPendingError();
        }
        throw err;
      }
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

/** Test/spike-only cleanup: delete a project, but ONLY if its name starts with "[agent-office-test]". */
export async function deleteTestProject(projectId: string, deps: AdapterDeps = {}): Promise<boolean> {
  const { adapter, rpc } = createInternal({ ...deps, healthIntervalMs: 60_000 });
  await adapter.start();
  try {
    const p = (await adapter.listProjects()).find((x) => x.id === projectId);
    if (!p) return false;
    if (!p.name.startsWith('[agent-office-test]')) throw new Error('Refusing to delete a project that is not marked [agent-office-test]');
    await rpc.call('DeleteProject', { id: projectId });
    return true;
  } finally {
    await adapter.stop();
  }
}

// ---- Development-only compatibility check (spec 003 US4, research R3-08) --------

const DEFAULT_FIXTURES_ROOT = join(import.meta.dirname, '..', '..', '..', 'tests', 'contract', 'fixtures');
const COMPARED_RPCS = ['GetAllCascadeTrajectories', 'GetUserStatus', 'GetAllSkills', 'ListProjects', 'ReadProjects', 'GetSlashCommands'] as const;
const STEP_FIXTURE = /^(GetCascadeTrajectorySteps(\..+)?|waiting-steps)\.json$/;

export interface InspectCompatOptions extends AdapterDeps {
  /** Fixture set to compare against (a version string). Default: newest verified version that has fixtures. */
  baseline?: string;
  fixturesRoot?: string;
}

/**
 * Read-only compatibility report for the running App (FR-015/016). Only READ_ONLY_RPCS are called,
 * the App's binary is only read, nothing is written, and the report holds names and counts only.
 * Only for scripts/check-compat.ts — Agent Office never runs it by itself (FR-016a).
 */
export async function inspectCompat(opts: InspectCompatOptions = {}): Promise<CompatReport> {
  const t0 = Date.now();
  const finder = opts.finder ?? createProcessFinder();
  const { adapter, rpc } = createInternal({ ...opts, finder, healthIntervalMs: 60_000 });
  await adapter.start();
  try {
    const conn = adapter.getConnection();
    if (conn.kind !== 'connected') throw new AppUnavailableError();
    const read = async (method: ReadOnlyRpc, body: unknown) => sanitizeRaw(await rpc.call(method, body, 30_000));

    // 1. RPC names in the App binary (read only).
    const proc = await finder.findLanguageServer();
    const binaryPath = proc?.args[0];
    const binary = binaryPath ? await readFile(binaryPath) : Buffer.alloc(0);
    const rpcs = scanRpcNames(binary, USED_RPCS);

    // 2. Field diff against the baseline fixture set.
    const root = opts.fixturesRoot ?? DEFAULT_FIXTURES_ROOT;
    const baseline = opts.baseline ?? verifiedVersionList().find((v) => existsSync(join(root, `app-${v}`))) ?? null;
    const baseDir = baseline ? join(root, `app-${baseline}`) : null;
    const basePaths = (file: string): Set<string> | null =>
      baseDir && existsSync(join(baseDir, file)) ? normalizedPaths(JSON.parse(readFileSync(join(baseDir, file), 'utf8'))) : null;

    const status = (await read('GetUserStatus', {})) as Record<string, unknown>;
    const model = mapModels(status)[0]?.modelId ?? '';
    const projectIds = mapProjectIds(await rpc.call('ListProjects', {}));
    const bodies: Record<(typeof COMPARED_RPCS)[number], unknown> = {
      GetAllCascadeTrajectories: {},
      GetUserStatus: {},
      GetAllSkills: {},
      ListProjects: {},
      ReadProjects: { ids: projectIds },
      GetSlashCommands: { cascadeConfig: { plannerConfig: { planModel: model } } },
    };
    const fieldDiff: CompatReport['fieldDiff'] = [];
    for (const m of COMPARED_RPCS) {
      const base = basePaths(`${m}.json`);
      if (!base || !baseline) continue;
      const current = normalizedPaths(m === 'GetUserStatus' ? status : await read(m, bodies[m]));
      fieldDiff.push({ rpc: m, baseline, ...diffPaths(current, base) });
    }

    // 3. Steps of every conversation: field paths + unknown step types.
    const conversations = (await adapter.listConversations()).filter((c) => c.stepCount > 0);
    const stepPaths = new Set<string>();
    const allSteps: Step[] = [];
    for (const c of conversations) {
      const raw = await read('GetCascadeTrajectorySteps', { cascadeId: c.id });
      normalizedPaths(raw, '', stepPaths);
      allSteps.push(...mapSteps(raw));
    }
    if (baseDir && baseline) {
      const base = new Set<string>();
      for (const f of readdirSync(baseDir).filter((n) => STEP_FIXTURE.test(n))) {
        normalizedPaths(JSON.parse(readFileSync(join(baseDir, f), 'utf8')), '', base);
      }
      fieldDiff.push({ rpc: 'GetCascadeTrajectorySteps', baseline, ...diffPaths(stepPaths, base), contentDependent: true });
    }

    return {
      appVersion: conn.appVersion,
      verified: isVerified(conn.appVersion),
      baseline,
      rpcs,
      fieldDiff,
      unknownStepTypes: countUnknownStepTypes(allSteps),
      scannedConversations: conversations.length,
      durationMs: Date.now() - t0,
    };
  } finally {
    await adapter.stop();
  }
}
