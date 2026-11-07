import type { FastifyInstance } from 'fastify';
import type { AppAdapter } from '../../app-adapter/index';
import type { Logger } from '../../log';
import type { WsHub } from '../ws-hub';
import type { Services } from '../../services/index';
import { healthRoutes } from './health';
import { employeeRoutes } from './employees';
import { conversationRoutes } from './conversations';
import { commandRoutes } from './commands';
import { projectRoutes } from './projects';
import { layoutRoutes } from './layout';
import { settingsRoutes } from './settings';

// Every route plugin MUST be registered here (tasks.md conventions).

export interface RouteDeps {
  adapter: AppAdapter;
  hub: WsHub;
  log: Logger;
  services: Services;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  await app.register(healthRoutes, deps);
  await app.register(employeeRoutes, deps);
  await app.register(conversationRoutes, deps);
  await app.register(commandRoutes, deps);
  await app.register(projectRoutes, deps);
  await app.register(layoutRoutes, deps);
  await app.register(settingsRoutes, deps);
}
