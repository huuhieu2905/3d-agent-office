import { Agent, request } from 'node:https';
import { RpcError } from './types';

// HTTPS + JSON client for the App's local language server (research.md R6).
// TLS verification is disabled ONLY for this dedicated agent, which only ever talks to 127.0.0.1.

const SERVICE = 'exa.language_server_pb.LanguageServerService';
const HOST = '127.0.0.1';

export interface RpcTarget {
  port: number;
  csrfToken: string;
}

export interface RpcTransport {
  call<T = unknown>(target: RpcTarget, method: string, body: unknown, timeoutMs?: number): Promise<T>;
}

const localAgent = new Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 8 });

export class HttpsRpcTransport implements RpcTransport {
  call<T>(target: RpcTarget, method: string, body: unknown, timeoutMs = 10_000): Promise<T> {
    const payload = Buffer.from(JSON.stringify(body ?? {}));
    return new Promise<T>((resolve, reject) => {
      const req = request(
        {
          host: HOST,
          port: target.port,
          method: 'POST',
          path: `/${SERVICE}/${method}`,
          agent: localAgent,
          headers: {
            'content-type': 'application/json',
            'content-length': payload.length,
            'x-codeium-csrf-token': target.csrfToken,
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            const text = Buffer.concat(chunks).toString('utf8');
            if (status === 401 || status === 403) return reject(new RpcError('auth', `${method}: ${status}`, status));
            if (status !== 200) {
              let msg = `${method}: HTTP ${status}`;
              try {
                const j = JSON.parse(text) as { code?: string };
                if (j.code) msg += ` (${j.code})`;
              } catch {
                /* ignore */
              }
              return reject(new RpcError(status >= 500 ? 'app' : 'protocol', msg, status));
            }
            try {
              resolve((text ? JSON.parse(text) : {}) as T);
            } catch {
              reject(new RpcError('protocol', `${method}: invalid JSON`));
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', (e) => reject(e instanceof RpcError ? e : new RpcError('unreachable', `${method}: ${e.message}`)));
      req.end(payload);
    });
  }
}

/** Binds a transport to the currently discovered target. */
export class RpcClient {
  constructor(
    private readonly transport: RpcTransport,
    private readonly getTarget: () => RpcTarget | null,
  ) {}

  async call<T = unknown>(method: string, body: unknown = {}, timeoutMs?: number): Promise<T> {
    const target = this.getTarget();
    if (!target) throw new RpcError('unreachable', 'not connected');
    return this.transport.call<T>(target, method, body, timeoutMs);
  }
}
