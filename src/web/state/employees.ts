import { create } from 'zustand';
import type { Employee } from '@shared/domain';

interface EmployeesStore {
  byId: Record<string, Employee>;
  overflow: number;
  snapshot(list: Employee[], overflow: number): void;
  patch(upserted: Employee[], removed: string[], overflow: number): void;
}

export const useEmployees = create<EmployeesStore>((set) => ({
  byId: {},
  overflow: 0,
  snapshot: (list, overflow) => set({ byId: Object.fromEntries(list.map((e) => [e.conversationId, e])), overflow }),
  patch: (upserted, removed, overflow) =>
    set((s) => {
      const byId = { ...s.byId };
      for (const e of upserted) byId[e.conversationId] = e;
      for (const id of removed) delete byId[id];
      return { byId, overflow };
    }),
}));

export const selectVisible = (s: EmployeesStore) => Object.values(s.byId).filter((e) => e.visible);
export const selectHidden = (s: EmployeesStore) => Object.values(s.byId).filter((e) => !e.visible);
