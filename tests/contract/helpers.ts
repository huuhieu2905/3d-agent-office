import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProcessFinder, LanguageServerProcess } from '../../src/server/app-adapter/discovery/process-finder';
import type { RpcTarget, RpcTransport } from '../../src/server/app-adapter/rpc-client';
import { RpcError } from '../../src/server/app-adapter/types';

export const FIXTURES = join(import.meta.dirname, 'fixtures', 'app-2.24.0');

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as T;
}

export const FAKE_TOKEN = 'fake-csrf-token-0123456789abcdef';

export function serverArgs(opts: { token?: string; version?: string } = {}): string[] {
  return [
    '/Applications/Antigravity.app/Contents/Resources/bin/language_server',
    '--standalone',
    '--subclient_type',
    'hub',
    '--override_ide_version',
    opts.version ?? '2.24.0',
    '--csrf_token',
    opts.token ?? FAKE_TOKEN,
    '--app_data_dir',
    'antigravity',
  ];
}

export class FakeFinder implements ProcessFinder {
  proc: LanguageServerProcess | null = { pid: 1000, args: serverArgs() };
  ports: number[] = [50001, 50002];
  async findLanguageServer() {
    return this.proc;
  }
  async listListeningPorts() {
    return this.ports;
  }
}

export type Handler = (body: unknown, target: RpcTarget) => unknown;

/** Serves fixtures; only `apiPort` answers (like the real App, where one port is gRPC-only). */
export class FakeTransport implements RpcTransport {
  apiPort = 50002;
  token = FAKE_TOKEN;
  calls: { method: string; body: unknown; port: number }[] = [];
  handlers: Record<string, Handler> = {
    GetAllWorkflows: () => ({}),
    GetAllCascadeTrajectories: () => fixture('GetAllCascadeTrajectories'),
    GetCascadeTrajectorySteps: () => fixture('GetCascadeTrajectorySteps'),
    GetUserStatus: () => fixture('GetUserStatus'),
    GetSlashCommands: () => fixture('GetSlashCommands'),
    ListProjects: () => fixture('ListProjects'),
    ReadProjects: () => fixture('ReadProjects'),
  };

  async call<T>(target: RpcTarget, method: string, body: unknown): Promise<T> {
    this.calls.push({ method, body, port: target.port });
    if (target.port !== this.apiPort) throw new RpcError('unreachable', 'gRPC-only port');
    if (target.csrfToken !== this.token) throw new RpcError('auth', 'bad token', 403);
    const h = this.handlers[method];
    if (!h) throw new RpcError('protocol', `no handler for ${method}`, 404);
    return h(body, target) as T;
  }
}
