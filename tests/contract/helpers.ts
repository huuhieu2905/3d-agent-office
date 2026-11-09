import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProcessFinder, LanguageServerProcess } from '../../src/server/app-adapter/discovery/process-finder';
import type { RpcTarget, RpcTransport } from '../../src/server/app-adapter/rpc-client';
import { RpcError } from '../../src/server/app-adapter/types';

const FIXTURE_ROOT = join(import.meta.dirname, 'fixtures');

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Every recorded App fixture set, newest first. Derived from `fixtures/app-*` (no version literals). */
export const FIXTURE_SETS: string[] = readdirSync(FIXTURE_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('app-'))
  .map((d) => d.name.slice('app-'.length))
  .sort(compareVersionsDesc);

/** The oldest set: the one the original 001/002 assertions were written against. */
export const LEGACY_SET = FIXTURE_SETS.at(-1)!;

export function fixturesDir(version: string): string {
  return join(FIXTURE_ROOT, `app-${version}`);
}

export function hasFixture(version: string, name: string): boolean {
  return existsSync(join(fixturesDir(version), `${name}.json`));
}

export function fixtureFrom<T = unknown>(version: string, name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir(version), `${name}.json`), 'utf8')) as T;
}

/** Legacy fixture dir used by tests written before 003. */
export const FIXTURES = fixturesDir(LEGACY_SET);

export function fixture<T = unknown>(name: string): T {
  return fixtureFrom<T>(LEGACY_SET, name);
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
  constructor(readonly fixtureSet: string = LEGACY_SET) {}
  apiPort = 50002;
  token = FAKE_TOKEN;
  calls: { method: string; body: unknown; port: number }[] = [];
  handlers: Record<string, Handler> = {
    GetAllWorkflows: () => ({}),
    GetAllCascadeTrajectories: () => fixtureFrom(this.fixtureSet, 'GetAllCascadeTrajectories'),
    GetCascadeTrajectorySteps: () => fixtureFrom(this.fixtureSet, 'GetCascadeTrajectorySteps'),
    GetUserStatus: () => fixtureFrom(this.fixtureSet, 'GetUserStatus'),
    GetSlashCommands: () => fixtureFrom(this.fixtureSet, 'GetSlashCommands'),
    ListProjects: () => fixtureFrom(this.fixtureSet, 'ListProjects'),
    ReadProjects: () => fixtureFrom(this.fixtureSet, 'ReadProjects'),
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
