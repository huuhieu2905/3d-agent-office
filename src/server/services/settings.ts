import type { Settings } from '../../shared/domain';
import { settingsSchema } from '../../shared/schemas';
import { JsonStore } from '../storage/json-store';

// settings.json (data-model §9). Theme default is decided by the browser on first run (prefers-color-scheme),
// so the server stores `null`-free defaults and the client overwrites them once.

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  city: 'hanoi',
  theme: 'light',
  detailLevel: 'medium',
  autoLowerDetail: true,
  camera: 'overview',
  defaultModel: null,
  legendCollapsed: false,
  screensOff: [],
};

export class SettingsStore {
  private store: JsonStore<Settings>;
  private cache: Settings | null = null;
  /** True until the first save, so the client can apply OS theme preference on first launch. */
  firstRun = true;

  constructor(dataDir: string) {
    this.store = new JsonStore<Settings>(dataDir, { file: 'settings.json', schema: settingsSchema as never, defaults: () => ({ ...DEFAULT_SETTINGS }) });
  }

  async get(): Promise<Settings & { firstRun: boolean }> {
    if (!this.cache) {
      this.cache = await this.store.read();
      try {
        const { access } = await import('node:fs/promises');
        await access(this.store.path);
        this.firstRun = false;
      } catch {
        this.firstRun = true;
      }
    }
    return { ...this.cache, firstRun: this.firstRun };
  }

  async save(s: Settings): Promise<void> {
    await this.store.write(s);
    this.cache = s;
    this.firstRun = false;
  }
}
