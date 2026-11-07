import { create } from 'zustand';
import type { Settings } from '@shared/domain';
import { api } from '../api/client';

// Settings (FR-053/060/064/065): loaded from the server once, saved (debounced) on every change.

const prefersDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  city: 'hanoi',
  theme: prefersDark ? 'dark' : 'light',
  detailLevel: 'medium',
  autoLowerDetail: true,
  camera: 'overview',
  defaultModel: null,
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load(): Promise<void>;
  /** Change settings locally and persist them. */
  update(p: Partial<Settings>): void;
  /** Change locally only (benchmark, tests). */
  set(p: Partial<Settings>): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    try {
      const s = await api<Settings & { firstRun?: boolean }>('/api/settings');
      const { firstRun, ...settings } = s;
      // First launch: follow the OS light/dark preference (data-model §9).
      if (firstRun) settings.theme = DEFAULT_SETTINGS.theme;
      set({ settings, loaded: true });
      if (firstRun) get().update({});
    } catch {
      set({ loaded: true });
    }
  },
  update(p) {
    set((s) => ({ settings: { ...s.settings, ...p } }));
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void api('/api/settings', { method: 'PUT', json: get().settings }).catch(() => undefined);
    }, 300);
  },
  set: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
}));
