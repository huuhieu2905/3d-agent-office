import type { AppAdapter } from '../app-adapter/index';
import type { WsHub } from '../http/ws-hub';
import type { Logger } from '../log';
import { defaultDataDir } from '../storage/json-store';
import { EmployeeProfiles } from './employee-profiles';
import { EmployeesService } from './employees';
import { LayoutStore } from './layout-store';

// Registry of long-running server services. Each user story adds its service here.

export interface ServiceDeps {
  adapter: AppAdapter;
  hub: WsHub;
  log: Logger;
  dataDir?: string;
  pollIntervalMs?: number;
}

export interface Services {
  dataDir: string;
  profiles: EmployeeProfiles;
  layout: LayoutStore;
  employees: EmployeesService;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createServices(deps: ServiceDeps): Services {
  const dataDir = deps.dataDir ?? defaultDataDir();
  const profiles = new EmployeeProfiles(dataDir);
  const layout = new LayoutStore(dataDir);
  const employees = new EmployeesService({
    adapter: deps.adapter,
    hub: deps.hub,
    log: deps.log,
    profiles,
    layout,
    intervalMs: deps.pollIntervalMs,
  });
  return {
    dataDir,
    profiles,
    layout,
    employees,
    async start() {
      employees.start();
    },
    async stop() {
      employees.stop();
      await profiles.flush();
    },
  };
}
