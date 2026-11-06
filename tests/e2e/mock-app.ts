import { FakeFinder, FakeTransport, fixture, serverArgs } from '../contract/helpers';

// In-process mock of the Antigravity App for e2e: fixtures served through the adapter's injectable
// ProcessFinder + RpcTransport. Control methods simulate the App quitting / restarting.

export class MockApp {
  readonly finder = new FakeFinder();
  readonly transport = new FakeTransport();
  sent: { method: string; body: unknown }[] = [];
  private generation = 1;
  runningAll = false;

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
    t.handlers.GetCascadeTrajectorySteps = () => fixture('GetCascadeTrajectorySteps');
    t.handlers.GetAllCascadeTrajectories = () => {
      const data = fixture<{ trajectorySummaries: Record<string, Record<string, unknown>> }>('GetAllCascadeTrajectories');
      if (this.runningAll) for (const v of Object.values(data.trajectorySummaries)) v.status = 'CASCADE_RUN_STATUS_RUNNING';
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
