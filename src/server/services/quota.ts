import type { Quota } from '../../shared/domain';
import type { AppAdapter } from '../app-adapter/index';
import type { WsHub } from '../http/ws-hub';
import type { Logger } from '../log';
import type { EmployeesService } from './employees';

// T090 / FR-042: refresh every 5 minutes and right after any run finishes; push `quota` to clients.

export class QuotaService {
  private latest: Quota | null = null;
  private timer: NodeJS.Timeout | null = null;
  private debounce: NodeJS.Timeout | null = null;

  constructor(
    private readonly adapter: AppAdapter,
    private readonly hub: WsHub,
    private readonly log: Logger,
    private readonly employees: EmployeesService,
    private readonly intervalMs = 5 * 60_000,
  ) {}

  start(): void {
    this.hub.onClientConnect((send) => {
      if (this.latest) send({ type: 'quota', payload: this.latest });
    });
    this.employees.on((e) => {
      if (e.type !== 'run-finished') return;
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = setTimeout(() => void this.refresh(), 3_000); // let the App account the usage first
    });
    this.adapter.onConnectionChange((s) => s.kind === 'connected' && void this.refresh());
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
  }

  get(): Quota | null {
    return this.latest;
  }

  async refresh(): Promise<Quota | null> {
    if (this.adapter.getConnection().kind !== 'connected') return this.latest;
    try {
      this.latest = await this.adapter.getQuota(0);
      this.hub.broadcast({ type: 'quota', payload: this.latest });
    } catch (err) {
      this.log.warn({ err }, 'quota refresh failed');
    }
    return this.latest;
  }
}
