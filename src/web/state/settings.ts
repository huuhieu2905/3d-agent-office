import { create } from 'zustand';
import type { Settings } from '@shared/domain';

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
  set(s: Partial<Settings>): void;
  replace(s: Settings): void;
}

export const useSettings = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  set: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  replace: (settings) => set({ settings, loaded: true }),
}));
