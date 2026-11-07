import { create } from 'zustand';
import type { ConnectionState } from '@shared/domain';

interface ConnectionStore {
  /** State of the Antigravity App as reported by the server. */
  app: ConnectionState;
  /** Whether the browser is connected to the local server. */
  serverOnline: boolean;
  warnings: { code: string; message: string }[];
  setApp(s: ConnectionState): void;
  setServerOnline(v: boolean): void;
  addWarning(w: { code: string; message: string }): void;
  dismissWarning(code: string): void;
}

export const useConnection = create<ConnectionStore>((set) => ({
  app: { kind: 'searching' },
  serverOnline: false,
  warnings: [],
  setApp: (app) => set({ app }),
  setServerOnline: (serverOnline) => set({ serverOnline }),
  addWarning: (w) => set((s) => ({ warnings: [...s.warnings.filter((x) => x.code !== w.code), w] })),
  dismissWarning: (code) => set((s) => ({ warnings: s.warnings.filter((x) => x.code !== code) })),
}));

/** True when the office should show the "disconnected" mood. */
export const isDisconnected = (s: ConnectionStore) => !s.serverOnline || s.app.kind !== 'connected';
