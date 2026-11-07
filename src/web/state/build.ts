import { create } from 'zustand';
import type { ItemType, OfficeLayout, PlacedItem, Rotation } from '@shared/domain';
import { validateLayout, type ValidationResult } from '@shared/layout-validation';
import { footprintRect, rectsOverlap, seatPoint } from '@shared/catalog';

// Build mode state (T102): draft layout with undo/redo, palette, selection, ghost rotation.

interface BuildStore {
  active: boolean;
  draft: OfficeLayout | null;
  past: OfficeLayout[];
  future: OfficeLayout[];
  palette: ItemType | null;
  rotation: Rotation;
  selectedId: string | null;
  draggingEmployee: string | null;
  validation: ValidationResult | null;
  begin(layout: OfficeLayout): void;
  end(): void;
  setPalette(t: ItemType | null): void;
  rotate(): void;
  select(id: string | null): void;
  apply(next: OfficeLayout): void;
  place(item: Omit<PlacedItem, 'id'>): void;
  move(id: string, pos: { x: number; z: number }): void;
  rotateSelected(): void;
  removeSelected(): void;
  undo(): void;
  redo(): void;
  setDraggingEmployee(id: string | null): void;
}

let seq = 0;
const newId = (t: ItemType) => `${t}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const nextRot = (r: Rotation): Rotation => (((r + 90) % 360) as Rotation);

export const useBuild = create<BuildStore>((set, get) => ({
  active: false,
  draft: null,
  past: [],
  future: [],
  palette: null,
  rotation: 0,
  selectedId: null,
  draggingEmployee: null,
  validation: null,
  begin: (layout) => set({ active: true, draft: structuredClone(layout), past: [], future: [], selectedId: null, palette: null, validation: validateLayout(layout) }),
  end: () => set({ active: false, draft: null, past: [], future: [], selectedId: null, palette: null, validation: null }),
  setPalette: (palette) => set({ palette, selectedId: null }),
  rotate: () => set((s) => ({ rotation: nextRot(s.rotation) })),
  select: (selectedId) => set({ selectedId, palette: null }),
  apply: (next) => {
    const { draft, past } = get();
    if (!draft) return;
    set({ draft: next, past: [...past.slice(-49), draft], future: [], validation: validateLayout(next) });
  },
  place: (item) => {
    const { draft } = get();
    if (!draft) return;
    const placed: PlacedItem = { ...item, id: newId(item.type) };
    const extra: PlacedItem[] = [];
    // A new desk comes with its chair at the seat (if that cell is free).
    if (item.type === 'desk') {
      const seat = seatPoint(placed);
      const chair: PlacedItem = { id: newId('chair'), type: 'chair', pos: { x: seat.x - 0.25, z: seat.z - 0.25 }, rotation: item.rotation };
      const cr = footprintRect(chair);
      const taken = draft.items.some((i) => i.type !== 'wall' && i.type !== 'glass_wall' && rectsOverlap(footprintRect(i), cr));
      if (!taken) extra.push(chair);
    }
    get().apply({ ...draft, items: [...draft.items, placed, ...extra] });
  },
  move: (id, pos) => {
    const { draft } = get();
    if (!draft) return;
    get().apply({ ...draft, items: draft.items.map((i) => (i.id === id ? { ...i, pos } : i)) });
  },
  rotateSelected: () => {
    const { draft, selectedId } = get();
    if (!draft || !selectedId) return;
    get().apply({ ...draft, items: draft.items.map((i) => (i.id === selectedId ? { ...i, rotation: nextRot(i.rotation) } : i)) });
  },
  removeSelected: () => {
    const { draft, selectedId } = get();
    if (!draft || !selectedId) return;
    get().apply({ ...draft, items: draft.items.filter((i) => i.id !== selectedId) });
    set({ selectedId: null });
  },
  undo: () => {
    const { draft, past, future } = get();
    const prev = past.at(-1);
    if (!draft || !prev) return;
    set({ draft: prev, past: past.slice(0, -1), future: [draft, ...future], validation: validateLayout(prev) });
  },
  redo: () => {
    const { draft, past, future } = get();
    const next = future[0];
    if (!draft || !next) return;
    set({ draft: next, past: [...past, draft], future: future.slice(1), validation: validateLayout(next) });
  },
  setDraggingEmployee: (draggingEmployee) => set({ draggingEmployee }),
}));
