import type { FastifyPluginAsync } from 'fastify';
import type { RouteDeps } from './index';

export const SERVER_VERSION = '0.1.0';

export const healthRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  app.get('/api/health', async () => ({ connection: deps.adapter.getConnection(), serverVersion: SERVER_VERSION }));
  // Unauthenticated liveness for tooling (Playwright webServer). Exposes nothing else.
  app.get('/api/health-public', async () => ({ ok: true }));
};
