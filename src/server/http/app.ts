import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { DEFAULT_PORT } from '../../shared/protocol';
import type { AppAdapter } from '../app-adapter/index';
import type { Logger } from '../log';
import { registerSecurity } from './security';
import { registerRoutes, type RouteDeps } from './routes/index';
import { WsHub } from './ws-hub';

export interface HttpServerOptions {
  adapter: AppAdapter;
  log: Logger;
  sessionToken: string;
  port?: number;
  webRoot?: string;
  hub?: WsHub;
  services?: RouteDeps['services'];
}

export interface HttpServer {
  app: FastifyInstance;
  hub: WsHub;
  listen(): Promise<number>;
  close(): Promise<void>;
}

export async function createHttpServer(opts: HttpServerOptions): Promise<HttpServer> {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });
  const hub = opts.hub ?? new WsHub(opts.log);
  let boundPort = opts.port ?? Number(process.env.AGENT_OFFICE_PORT ?? DEFAULT_PORT);

  registerSecurity(app, { port: () => boundPort, sessionToken: opts.sessionToken });

  await app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });
  app.get('/ws', { websocket: true }, (socket) => hub.add(socket));

  const deps: RouteDeps = { adapter: opts.adapter, hub, log: opts.log, services: opts.services ?? ({} as RouteDeps['services']) };
  await registerRoutes(app, deps);

  const webRoot = opts.webRoot ?? join(import.meta.dirname, '..', '..', '..', 'dist', 'web');
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot, index: ['index.html'] });
  } else {
    app.get('/', async (_req, reply) =>
      reply.type('text/plain').send('Web UI not built yet. Run `npm run build`, or use `npm run dev`.'),
    );
  }

  app.setErrorHandler((err, _req, reply) => {
    opts.log.error({ err }, 'request failed');
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    void reply.code(status).send({ error: { code: status === 400 ? 'BAD_REQUEST' : 'INTERNAL', message: 'Request failed' } });
  });

  return {
    app,
    hub,
    async listen() {
      await app.listen({ host: '127.0.0.1', port: boundPort });
      const addr = app.server.address();
      if (addr && typeof addr === 'object') boundPort = addr.port;
      return boundPort;
    },
    async close() {
      hub.closeAll();
      await app.close();
    },
  };
}
