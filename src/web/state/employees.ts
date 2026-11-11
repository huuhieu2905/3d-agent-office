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
/** 009 FR-018: subagents hidden by the 20-shown cap whose member (top-level ancestor) is in the office. */
export const selectHidden = (s: EmployeesStore) =>
  Object.values(s.byId).filter((e) => {
    if (!e.isSubagent || e.visible) return false;
    const seen = new Set<string>();
    let root = e;
    while (root.parentId && s.byId[root.parentId] && !seen.has(root.parentId)) {
      seen.add(root.parentId);
      root = s.byId[root.parentId]!;
    }
    return root.visible && !root.isSubagent;
  });
