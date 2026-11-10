import { RpcError } from '../../src/server/app-adapter/index';
import { FakeFinder, FakeTransport, fixture, serverArgs } from '../contract/helpers';

// In-process mock of the Antigravity App for e2e: fixtures served through the adapter's injectable
// ProcessFinder + RpcTransport. Control methods simulate the App quitting / restarting.

export class MockApp {
  readonly finder = new FakeFinder();
  readonly transport = new FakeTransport();
  sent: { method: string; body: unknown }[] = [];
  private generation = 1;
  runningAll = false;
  waiting = false;
  created: { id: string; name: string; projectResources: unknown }[] = [];
  /** 002 US1: model ids the "App" no longer offers (to test a remembered model going away). */
  hiddenModels = new Set<string>();
  /** 003 US3: extra steps appended to every conversation (long error, web search). */
  extraSteps: Record<string, unknown>[] = [];
  /** 003 US2: an ASK_QUESTION step at the end of every conversation. */
  question: 'waiting' | 'done' | 'canceled' | null = null;
  /** Last answer the mock "App" accepted (responses[] of askQuestion). */
  answeredWith: Record<string, unknown>[] | null = null;
  /** 003 US2 U3-2: make the App reject question answers with HTTP 400. */
  rejectQuestion = false;
  /** 004 US2 (L4-3): conversations the "App" deleted, ids running individually, child → parent links. */
  deleted = new Set<string>();
  runningIds = new Set<string>();
  parents: Record<string, string> = {};
  /** 004 US2: make DeleteCascadeTrajectory fail with HTTP 500. */
  failDelete = false;
  /** 004 US1: give every conversation its own project, so the legend lists one project per employee. */
  projectPerConversation = false;
  private manyProjectIds(): string[] {
    const ids = Object.keys(fixture<{ trajectorySummaries: Record<string, unknown> }>('GetAllCascadeTrajectories').trajectorySummaries);
    return ids.map((_, i) => `00000000-0000-4000-8000-00000000f${String(i).padStart(3, '0')}`);
  }

  constructor() {
    const t = this.transport;
    const record = (method: string) => (body: unknown) => {
      this.sent.push({ method, body });
      return {};
    };
    t.handlers.SendUserCascadeMessage = record('SendUserCascadeMessage');
    t.handlers.CancelCascadeInvocation = record('CancelCascadeInvocation');
    t.handlers.StartCascade = (body) => {
      this.sent.push({ method: 'StartCascade', body });
      return { cascadeId: '00000000-0000-4000-8000-0000000000e2' };
    };
    t.handlers.CreateProject = (body) => {
      const p = (body as { project: MockApp['created'][number] }).project;
      this.sent.push({ method: 'CreateProject', body });
      this.created.push(p);
      return {};
    };
    t.handlers.ReadProjects = (body) => {
      const ids = (body as { ids: string[] }).ids;
      const base = fixture<{ projects: { id: string }[] }>('ReadProjects').projects;
      const many = this.projectPerConversation
        ? this.manyProjectIds().map((id, i) => ({ id, name: `Dự án thử ${i + 1}`, projectResources: { resources: [] } }))
        : [];
      return { projects: [...base, ...this.created, ...many].filter((p) => ids.includes(p.id)) };
    };
    t.handlers.ListProjects = () => ({
      projectIds: [
        ...fixture<{ projectIds: string[] }>('ListProjects').projectIds,
        ...this.created.map((p) => p.id),
        ...(this.projectPerConversation ? this.manyProjectIds() : []),
      ],
    });
    t.handlers.GetUserStatus = () => {
      const data = fixture<{ userStatus: { cascadeModelConfigData: { clientModelConfigs: { modelOrAlias?: { model?: string } }[] } } }>('GetUserStatus');
      const cfg = data.userStatus.cascadeModelConfigData;
      cfg.clientModelConfigs = cfg.clientModelConfigs.filter((m) => !this.hiddenModels.has(m.modelOrAlias?.model ?? ''));
      return data;
    };
    t.handlers.GetCascadeTrajectorySteps = () => {
      const data = fixture<{ steps: Record<string, unknown>[] }>(this.waiting ? 'waiting-steps' : 'GetCascadeTrajectorySteps');
      data.steps.push(...this.extraSteps);
      if (this.question) data.steps.push(this.questionStep(data.steps.length));
      return data;
    };
    t.handlers.HandleCascadeUserInteraction = (body) => {
      this.sent.push({ method: 'HandleCascadeUserInteraction', body });
      const ask = (body as { interaction?: { askQuestion?: { responses?: Record<string, unknown>[] } } }).interaction?.askQuestion;
      if (ask) {
        if (this.rejectQuestion) throw new RpcError('protocol', 'HandleCascadeUserInteraction: HTTP 400', 400);
        this.answeredWith = ask.responses ?? [];
        this.question = 'done';
        return {};
      }
      this.waiting = false;
      return {};
    };
    t.handlers.DeleteCascadeTrajectory = (body) => {
      this.sent.push({ method: 'DeleteCascadeTrajectory', body });
      if (this.failDelete) throw new RpcError('app', 'DeleteCascadeTrajectory: HTTP 500', 500);
      const root = (body as { cascadeId: string }).cascadeId;
      // Like the real App: deleting a conversation deletes all its subagents (any depth).
      const gone = new Set([root]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const [child, parent] of Object.entries(this.parents)) {
          if (gone.has(parent) && !gone.has(child)) {
            gone.add(child);
            grew = true;
          }
        }
      }
      for (const id of gone) this.deleted.add(id);
      return {};
    };
    t.handlers.GetAllCascadeTrajectories = () => {
      const data = fixture<{ trajectorySummaries: Record<string, Record<string, unknown>> }>('GetAllCascadeTrajectories');
      for (const id of this.deleted) delete data.trajectorySummaries[id];
      const many = this.projectPerConversation ? this.manyProjectIds() : [];
      for (const [i, [id, v]] of Object.entries(data.trajectorySummaries).entries()) {
        if (many[i]) v.trajectoryMetadata = { ...((v.trajectoryMetadata as object) ?? {}), projectId: many[i] };
        if (this.runningAll || this.runningIds.has(id)) v.status = 'CASCADE_RUN_STATUS_RUNNING';
        const parent = this.parents[id];
        if (parent) v.trajectoryMetadata = { ...((v.trajectoryMetadata as object) ?? {}), parentConversationId: parent };
        // Keep summaries consistent with the steps fixture being served (the real App always is).
        v.stepCount = (this.waiting ? 7 : 20) + this.extraSteps.length + (this.question ? 1 : 0);
      }
      return data;
    };
  }

  /** Two sub-questions: single choice (2 options) and multi-select (3 options). Shape as recorded on App 2.29.0. */
  private questionStep(index: number): Record<string, unknown> {
    const entries = [
      { question: 'Chọn **một** màu cho biển hiệu?', options: [{ id: '1', text: 'Đỏ' }, { id: '2', text: 'Xanh' }] },
      { question: 'Những ngày nào bạn rảnh?', options: [{ id: '1', text: 'Thứ 2' }, { id: '2', text: 'Thứ 3' }, { id: '3', text: 'Thứ 4' }], isMultiSelect: true },
    ];
    const status = { waiting: 'CORTEX_STEP_STATUS_WAITING', done: 'CORTEX_STEP_STATUS_DONE', canceled: 'CORTEX_STEP_STATUS_CANCELED' }[this.question!];
    const step: Record<string, unknown> = {
      type: 'CORTEX_STEP_TYPE_ASK_QUESTION',
      status,
      metadata: { sourceTrajectoryStepInfo: { trajectoryId: '00000000-0000-4000-8000-00000000a5c0' } },
      askQuestion: { questions: entries },
    };
    if (this.question === 'waiting') step.requestedInteraction = { askQuestion: {} };
    if (this.question === 'done' && this.answeredWith) {
      step.completedInteractions = [{ response: { stepIndex: index, askQuestion: { responses: this.answeredWith } } }];
    }
    return step;
  }

  /** 003 US3: a long error and a web search, shaped like the recorded App 2.29.0 steps. */
  addErrorAndSearchSteps(): void {
    this.extraSteps = [
      {
        type: 'CORTEX_STEP_TYPE_ERROR_MESSAGE',
        status: 'CORTEX_STEP_STATUS_DONE',
        errorMessage: { error: { shortError: `API error (attempt 1): ${'request failed: connection reset by peer; '.repeat(10)}END-OF-ERROR`, errorId: 'e2e-error-1' } },
      },
      {
        type: 'CORTEX_STEP_TYPE_SEARCH_WEB',
        status: 'CORTEX_STEP_STATUS_DONE',
        searchWeb: { query: 'Open-Meteo API', summary: 'x', searchType: 'SEARCH_WEB_TYPE_WEB' },
      },
    ];
  }

  quit(): void {
    this.finder.proc = null;
  }

  open(): void {
    this.finder.proc = { pid: 1000 + this.generation, args: serverArgs({ token: this.transport.token }) };
  }

  /** Restart with a new PID, port and CSRF token (like reopening the real App). */
  restart(): void {
    this.generation++;
    const token = `restarted-token-${this.generation}-abcdefghijklmnop`;
    this.transport.token = token;
    this.transport.apiPort = 50100 + this.generation;
    this.finder.ports = [50000, this.transport.apiPort];
    this.finder.proc = { pid: 1000 + this.generation, args: serverArgs({ token }) };
  }
}
