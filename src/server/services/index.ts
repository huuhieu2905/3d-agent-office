import type { AppAdapter } from '../app-adapter/index';
import type { WsHub } from '../http/ws-hub';
import type { Logger } from '../log';

// Registry of long-running server services. Each user story adds its service here.

export interface ServiceDeps {
  adapter: AppAdapter;
  hub: WsHub;
  log: Logger;
  dataDir?: string;
}

export interface Services {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createServices(_deps: ServiceDeps): Services {
  return {
    async start() {},
    async stop() {},
  };
}
