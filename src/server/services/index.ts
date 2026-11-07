import type { AppAdapter } from '../app-adapter/index';
import type { WsHub } from '../http/ws-hub';
import type { Logger } from '../log';
import { defaultDataDir } from '../storage/json-store';
import { EmployeeProfiles } from './employee-profiles';
import { EmployeesService } from './employees';
import { LayoutStore } from './layout-store';
import { UsageService } from './usage';
import { MentionService } from './mentions';
import { QuotaService } from './quota';
import { FolderService } from './folders';
import { WeatherService } from './weather';
import { SettingsStore } from './settings';

// Registry of long-running server services. Each user story adds its service here.

export interface ServiceDeps {
  adapter: AppAdapter;
  hub: WsHub;
  log: Logger;
  dataDir?: string;
  pollIntervalMs?: number;
  /** Root for the project folder browser (defaults to the user's home). */
  homeDir?: string;
}

export interface Services {
  dataDir: string;
  profiles: EmployeeProfiles;
  layout: LayoutStore;
  employees: EmployeesService;
  usage: UsageService;
  mentions: MentionService;
  quota: QuotaService;
  folders: FolderService;
  weather: WeatherService;
  settings: SettingsStore;
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
  const usage = new UsageService(dataDir);
  const mentions = new MentionService(deps.adapter);
  const quota = new QuotaService(deps.adapter, deps.hub, deps.log, employees);
  employees.on((e) => {
    if (e.type === 'user-inputs') void usage.userInputs(e.count);
  });
  // T065: per-client live steps for the open chat.
  deps.hub.setWatchHandler((conversationId, push) =>
    deps.adapter.watchConversation(conversationId, (steps) => push({ type: 'steps.append', payload: { conversationId, steps } })),
  );
  return {
    dataDir,
    usage,
    mentions,
    quota,
    folders: new FolderService(deps.homeDir),
    weather: new WeatherService(dataDir, deps.log),
    settings: new SettingsStore(dataDir),
    profiles,
    layout,
    employees,
    async start() {
      employees.start();
      quota.start();
    },
    async stop() {
      employees.stop();
      quota.stop();
      await profiles.flush();
    },
  };
}
