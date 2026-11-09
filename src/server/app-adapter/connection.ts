import type { ConnectionState } from '../../shared/domain';
import { forgetSecret, registerSecret } from '../log';
import type { ProcessFinder } from './discovery/process-finder';
import { parseServerArgs } from './discovery/args';
import { probeApiPort } from './discovery/probe';
import { isVerified, verifiedVersionList } from './versions';
import type { RpcTarget, RpcTransport } from './rpc-client';

// Discovery + health loop (research.md R6). Reconnects within ~2s of the App being ready (SC-010).

export interface ConnectionManagerOptions {
  finder: ProcessFinder;
  transport: RpcTransport;
  intervalMs?: number;
}

export class ConnectionManager {
  private state: ConnectionState = { kind: 'searching' };
  private target: (RpcTarget & { pid: number }) | null = null;
  private timer: NodeJS.Timeout | null = null;
  private listeners = new Set<(s: ConnectionState) => void>();
  private ticking = false;
  private readonly intervalMs: number;

  constructor(private readonly opts: ConnectionManagerOptions) {
    this.intervalMs = opts.intervalMs ?? 2_000;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getTarget(): RpcTarget | null {
    return this.state.kind === 'connected' && this.target ? { port: this.target.port, csrfToken: this.target.csrfToken } : null;
  }

  onChange(cb: (s: ConnectionState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async start(): Promise<void> {
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Called by the adapter when an RPC fails with an auth/unreachable error: rediscover now. */
  invalidate(): void {
    if (this.target) forgetSecret(this.target.csrfToken);
    this.target = null;
    this.setState({ kind: 'searching' });
    void this.tick();
  }

  private setState(next: ConnectionState): void {
    const prev = JSON.stringify(this.state);
    this.state = next;
    if (JSON.stringify(next) !== prev) for (const l of this.listeners) l(next);
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const proc = await this.opts.finder.findLanguageServer();
      if (!proc) {
        if (this.target) forgetSecret(this.target.csrfToken);
        this.target = null;
        this.setState({ kind: 'searching' });
        return;
      }
      const parsed = parseServerArgs(proc.args);
      if (!parsed) {
        this.setState({ kind: 'error', reason: 'protocol', detail: 'language server started without a CSRF token' });
        return;
      }
      registerSecret(parsed.csrfToken);

      // Still the same process and token: just check health.
      if (this.target && this.target.pid === proc.pid && this.target.csrfToken === parsed.csrfToken) {
        try {
          await this.opts.transport.call(this.target, 'GetAllWorkflows', {}, 3_000);
          return;
        } catch {
          /* fall through to rediscover the port */
        }
      }

      const ports = await this.opts.finder.listListeningPorts(proc.pid);
      const port = await probeApiPort(this.opts.transport, ports, parsed.csrfToken);
      if (port == null) {
        this.target = null;
        this.setState({ kind: 'error', reason: 'unreachable', detail: 'App API port not answering yet' });
        return;
      }
      if (this.target && this.target.csrfToken !== parsed.csrfToken) forgetSecret(this.target.csrfToken);
      this.target = { pid: proc.pid, port, csrfToken: parsed.csrfToken };
      this.setState({
        kind: 'connected',
        appVersion: parsed.appVersion,
        versionSupported: isVerified(parsed.appVersion),
        verifiedVersions: verifiedVersionList(),
      });
    } catch (err) {
      this.setState({ kind: 'error', reason: 'unreachable', detail: (err as Error).message.slice(0, 200) });
    } finally {
      this.ticking = false;
    }
  }
}
