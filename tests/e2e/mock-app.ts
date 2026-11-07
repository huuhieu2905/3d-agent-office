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
      return { projects: [...base, ...this.created].filter((p) => ids.includes(p.id)) };
    };
    t.handlers.ListProjects = () => ({
      projectIds: [...fixture<{ projectIds: string[] }>('ListProjects').projectIds, ...this.created.map((p) => p.id)],
    });
    t.handlers.GetUserStatus = () => {
      const data = fixture<{ userStatus: { cascadeModelConfigData: { clientModelConfigs: { modelOrAlias?: { model?: string } }[] } } }>('GetUserStatus');
      const cfg = data.userStatus.cascadeModelConfigData;
      cfg.clientModelConfigs = cfg.clientModelConfigs.filter((m) => !this.hiddenModels.has(m.modelOrAlias?.model ?? ''));
      return data;
    };
    t.handlers.GetCascadeTrajectorySteps = () => fixture(this.waiting ? 'waiting-steps' : 'GetCascadeTrajectorySteps');
    t.handlers.HandleCascadeUserInteraction = (body) => {
      this.sent.push({ method: 'HandleCascadeUserInteraction', body });
      this.waiting = false;
      return {};
    };
    t.handlers.GetAllCascadeTrajectories = () => {
      const data = fixture<{ trajectorySummaries: Record<string, Record<string, unknown>> }>('GetAllCascadeTrajectories');
      for (const v of Object.values(data.trajectorySummaries)) {
        if (this.runningAll) v.status = 'CASCADE_RUN_STATUS_RUNNING';
        // Keep summaries consistent with the steps fixture being served (the real App always is).
        v.stepCount = this.waiting ? 7 : 20;
      }
      return data;
    };
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
