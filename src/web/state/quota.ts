import { create } from 'zustand';
import type { Quota } from '@shared/domain';

interface QuotaStore {
  quota: Quota | null;
  panelOpen: boolean;
  set(q: Quota): void;
  setPanelOpen(v: boolean): void;
}

export const useQuota = create<QuotaStore>((set) => ({
  quota: null,
  panelOpen: false,
  set: (quota) => set({ quota }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}));

export const lowestGroup = (q: Quota | null) => (q?.groups.length ? q.groups[0]! : null);
