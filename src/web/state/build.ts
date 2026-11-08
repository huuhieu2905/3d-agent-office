import { create } from 'zustand';
import type { ItemType, OfficeLayout, PlacedItem, Rotation } from '@shared/domain';
import { validateLayout, type ValidationResult } from '@shared/layout-validation';
import { footprintRect, rectsOverlap, seatPoint, snap } from '@shared/catalog';
import { resizeLayout, type ResizeResult } from '@shared/layout-resize';

// Arrange ("build") mode state: a draft layout plus draft seating, with undo/redo over both
// (002 data-model §4). Seating maps conversationId → deskId (null = lobby) for employees moved in this
// session only; it is saved together with the layout (contracts/local-api.md L2-2).

export type Seating = Record<string, string | null>;

interface Snapshot {
  layout: OfficeLayout;
  seating: Seating;
}

export interface DragPreview {
  kind: 'item' | 'employee' | 'handle';
  id: string;
  pos: { x: number; z: number };
  /** Item: would the drop be accepted? */
  valid: boolean;
  /** Handle: the floor size the drop would give. */
  size?: { width: number; depth: number };
  /** Employee: desk under the cursor and whether someone sits there. */
  deskId?: string | null;
  occupied?: boolean;
}

interface BuildStore {
  active: boolean;
  draft: OfficeLayout | null;
  seating: Seating;
  past: Snapshot[];
  future: Snapshot[];
  palette: ItemType | null;
  rotation: Rotation;
  selectedId: string | null;
  drag: DragPreview | null;
  validation: ValidationResult | null;
  /** Items that stopped the last shrink (FR-024); cleared by the next successful resize. */
  resizeBlockers: string[];
  begin(layout: OfficeLayout): void;
  end(): void;
  setPalette(t: ItemType | null): void;
  rotate(): void;
  select(id: string | null): void;
  apply(next: OfficeLayout, seating?: Seating): void;
  place(item: Omit<PlacedItem, 'id'>): void;
  move(id: string, pos: { x: number; z: number }): void;
  rotateSelected(): void;
  removeSelected(): void;
  /** Seat an employee; whoever had the desk takes the employee's old desk (FR-011). */
  assignSeat(conversationId: string, deskId: string, currentDesks: Record<string, string | null>): void;
  setDrag(d: DragPreview | null): void;
  /** Change the floor size (US4). Returns why it was refused, if it was. */
  resizeFloor(width: number, depth: number): ResizeResult;
  undo(): void;
  redo(): void;
}

let seq = 0;
const newId = (t: ItemType) => `${t}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const nextRot = (r: Rotation): Rotation => (((r + 90) % 360) as Rotation);

/** Chairs standing on a desk's seat belong to it and move with it (FR-015). */
export function chairsOf(layout: OfficeLayout, desk: PlacedItem): PlacedItem[] {
  const s = seatPoint(desk);
  return layout.items.filter((i) => {
    if (i.type !== 'chair') return false;
    const r = footprintRect(i);
    return Math.abs((r.x0 + r.x1) / 2 - s.x) < 0.3 && Math.abs((r.z0 + r.z1) / 2 - s.z) < 0.3;
  });
}

/** Effective desk of every employee: server assignment overlaid with this session's draft moves. */
export function effectiveDesks(current: Record<string, string | null>, seating: Seating): Record<string, string | null> {
  return { ...current, ...seating };
}

export const useBuild = create<BuildStore>((set, get) => ({
  active: false,
  draft: null,
  seating: {},
  past: [],
  future: [],
  palette: null,
  rotation: 0,
  selectedId: null,
  drag: null,
  validation: null,
  resizeBlockers: [],
  begin: (layout) =>
    set({ active: true, draft: structuredClone(layout), seating: {}, past: [], future: [], selectedId: null, palette: null, drag: null, validation: validateLayout(layout) }),
  end: () => set({ active: false, draft: null, seating: {}, past: [], future: [], selectedId: null, palette: null, drag: null, validation: null, resizeBlockers: [] }),
  setPalette: (palette) => set({ palette, selectedId: null }),
  rotate: () => set((s) => ({ rotation: nextRot(s.rotation) })),
  select: (selectedId) => set({ selectedId, palette: null }),
  apply: (next, seating) => {
    const { draft, past } = get();
    if (!draft) return;
    const s = seating ?? get().seating;
    set({ draft: next, seating: s, past: [...past.slice(-49), { layout: draft, seating: get().seating }], future: [], validation: validateLayout(next) });
  },
  place: (item) => {
    const { draft } = get();
    if (!draft) return;
    const placed: PlacedItem = { ...item, id: newId(item.type) };
    const extra: PlacedItem[] = [];
    // A new desk comes with its chair on the seat (if that spot is free).
    if (item.type === 'desk') {
      const seat = seatPoint(placed);
      const chair: PlacedItem = { id: newId('chair'), type: 'chair', pos: { x: snap(seat.x - 0.25, 0.05), z: snap(seat.z - 0.25, 0.05) }, rotation: item.rotation };
      const cr = footprintRect(chair);
      const taken = draft.items.some((i) => i.type !== 'wall' && i.type !== 'glass_wall' && rectsOverlap(footprintRect(i), cr));
      if (!taken) extra.push(chair);
    }
    get().apply({ ...draft, items: [...draft.items, placed, ...extra] });
  },
  move: (id, pos) => {
    const { draft } = get();
    if (!draft) return;
    const it = draft.items.find((i) => i.id === id);
    if (!it) return;
    const dx = pos.x - it.pos.x;
    const dz = pos.z - it.pos.z;
    const followers = new Set(it.type === 'desk' ? chairsOf(draft, it).map((c) => c.id) : []);
    get().apply({
      ...draft,
      items: draft.items.map((i) =>
        i.id === id ? { ...i, pos } : followers.has(i.id) ? { ...i, pos: { x: snap(i.pos.x + dx, 0.05), z: snap(i.pos.z + dz, 0.05) } } : i,
      ),
    });
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
  assignSeat: (conversationId, deskId, currentDesks) => {
    const { draft, seating } = get();
    if (!draft) return;
    const desks = effectiveDesks(currentDesks, seating);
    const mine = desks[conversationId] ?? null;
    if (mine === deskId) return;
    const occupant = Object.entries(desks).find(([id, d]) => d === deskId && id !== conversationId)?.[0];
    const next: Seating = { ...seating, [conversationId]: deskId };
    if (occupant) next[occupant] = mine;
    get().apply(draft, next);
  },
  setDrag: (drag) => set({ drag }),
  resizeFloor: (width, depth) => {
    const { draft } = get();
    if (!draft) return { ok: false, reason: 'limits' };
    if (draft.floor.width === width && draft.floor.depth === depth) return { ok: true, layout: draft };
    const r = resizeLayout(draft, width, depth);
    if (r.ok) {
      get().apply(r.layout);
      set({ resizeBlockers: [] });
    } else set({ resizeBlockers: r.reason === 'blocked' ? r.blockers : [] });
    return r;
  },
  undo: () => {
    const { draft, seating, past, future } = get();
    const prev = past.at(-1);
    if (!draft || !prev) return;
    set({ draft: prev.layout, seating: prev.seating, past: past.slice(0, -1), future: [{ layout: draft, seating }, ...future], validation: validateLayout(prev.layout) });
  },
  redo: () => {
    const { draft, seating, past, future } = get();
    const next = future[0];
    if (!draft || !next) return;
    set({ draft: next.layout, seating: next.seating, past: [...past, { layout: draft, seating }], future: future.slice(1), validation: validateLayout(next.layout) });
  },
}));
