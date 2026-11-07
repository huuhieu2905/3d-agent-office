import { pathToFileURL } from 'node:url';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppUnavailableError } from '../../app-adapter/index';
import { FolderAccessError } from '../../services/folders';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T081 / FR-031: browse folders inside home and create a project bound to one.

const createSchema = z.object({ name: z.string().trim().min(1).max(120), folderPath: z.string().min(1).max(4096) });

export const projectRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { services, adapter } = deps;

  app.get<{ Querystring: { path?: string } }>('/api/fs/dirs', async (req, reply) => {
    try {
      return await services.folders.list(req.query.path);
    } catch (err) {
      if (err instanceof FolderAccessError) return sendError(reply, 400, 'BAD_REQUEST', err.message);
      throw err;
    }
  });

  app.post('/api/projects', async (req, reply) => {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'Cần tên project và thư mục');
    try {
      const folder = await services.folders.resolveInsideHome(body.data.folderPath);
      const project = await adapter.createProject({ name: body.data.name, folderUri: pathToFileURL(folder).href });
      return reply.code(201).send(project);
    } catch (err) {
      if (err instanceof FolderAccessError) return sendError(reply, 400, 'BAD_REQUEST', err.message);
      if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
      throw err;
    }
  });
};
