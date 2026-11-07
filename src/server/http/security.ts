import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorBody, ErrorCode } from '../../shared/protocol';

// research.md R11: Host + Origin checks (anti DNS-rebinding / cross-site) and a per-launch session token.

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sendError(reply: FastifyReply, status: number, code: ErrorCode, message: string) {
  const body: ErrorBody = { error: { code, message } };
  return reply.code(status).send(body);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export interface SecurityOptions {
  port: () => number;
  sessionToken: string;
  /** Paths reachable without the session token (static files, public liveness). */
  publicPrefixes?: string[];
}

export function registerSecurity(app: FastifyInstance, opts: SecurityOptions): void {
  const publicPrefixes = opts.publicPrefixes ?? ['/api/health-public'];

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const port = opts.port();
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const host = req.headers.host ?? '';
    if (!allowedHosts.has(host)) return sendError(reply, 421, 'MISDIRECTED_HOST', 'Unexpected Host header');

    const origin = req.headers.origin;
    if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) {
      return sendError(reply, 403, 'FORBIDDEN_ORIGIN', 'Cross-origin request rejected');
    }

    const url = req.url;
    const isApi = url.startsWith('/api/');
    const isWs = url.startsWith('/ws');
    if (!isApi && !isWs) return; // static web assets
    if (publicPrefixes.some((p) => url.startsWith(p))) return;

    let presented: string;
    if (isWs) {
      presented = new URL(url, 'http://local').searchParams.get('k') ?? '';
    } else {
      const auth = req.headers.authorization ?? '';
      presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    }
    if (!presented || !safeEqual(presented, opts.sessionToken)) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Missing or invalid session token');
    }
  });
}
