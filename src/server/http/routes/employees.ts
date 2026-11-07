import type { FastifyPluginAsync } from 'fastify';
import { AppUnavailableError } from '../../app-adapter/index';
import { sendError } from '../security';
import type { RouteDeps } from './index';

export const employeeRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  app.get('/api/employees', async () => deps.services.employees.snapshot());

  app.get('/api/layout', async () => deps.services.layout.get());

  app.get('/api/projects', async (_req, reply) => {
    try {
      return await deps.adapter.listProjects();
    } catch (err) {
      if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
      throw err;
    }
  });
};
