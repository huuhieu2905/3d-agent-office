import { create } from 'zustand';
import type { ItemType, OfficeLayout, PlacedItem, Rotation } from '@shared/domain';
import { dropUnsupportedFrames, frameSupported, validateLayout, type ValidationResult } from '@shared/layout-validation';
import { FRAME_HEIGHT_DEFAULT, footprintRect, isMeetingTable, isWallMounted, onEdgeGrid, rectsOverlap, seatPoint, snap } from '@shared/catalog';
import { resizeLayout, type ResizeResult } from '@shared/layout-resize';

// Arrange ("build") mode state: a draft layout plus draft seating, with undo/redo over both
// (002 data-model §4). Seating maps conversationId → deskId (null = lobby) for employees moved in this
// session only; it is saved together with the layout (contracts/local-api.md L2-2).

export type Seating = Record<string, string | null>;

interface Snapshot {
  layout: OfficeLayout;
  seating: Seating;
  /** 007 US3: conversationId → meeting seat `<tableId>#<n>` (null = left the meeting), this session only. */
  meetingSeating: Seating;
}

export interface DragPreview {
  kind: 'item' | 'employee' | 'handle';
  id: string;
  pos: { x: number; z: number };
  /** Item: would the drop be accepted? */
  valid: boolean;
  /** Handle: the floor size the drop would give. */
  size?: { width: number; depth: number };
  /** Employee: desk (or 007 meeting seat) under the cursor and whether someone sits there. */
  deskId?: string | null;
  seatId?: string | null;
  occupied?: boolean;
}

interface BuildStore {
  active: boolean;
  draft: OfficeLayout | null;
  seating: Seating;
  meetingSeating: Seating;
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
  apply(next: OfficeLayout, seating?: Seating, meetingSeating?: Seating): void;
  place(item: Omit<PlacedItem, 'id'>): void;
  move(id: string, pos: { x: number; z: number }): void;
  rotateSelected(): void;
  /** 008: height (m) for the next frame placed; follows the last frame placed or raised. */
  frameHeight: number;
  /** 008: set a frame's height (one undo step); also remembered for the next frame. */
  setFrameHeight(id: string, height: number): void;
  /** 007 US5: show an uploaded picture in a frame (undefined = back to the default picture). One undo step. */
  setPicture(id: string, picture: string | undefined): void;
  removeSelected(): void;
  /** Seat an employee; whoever had the desk takes the employee's old desk (FR-011). */
  assignSeat(conversationId: string, deskId: string, currentDesks: Record<string, string | null>): void;
  /** 007: seat an employee at a meeting-table seat; whoever sat there takes the employee's old meeting seat. */
  assignMeetingSeat(conversationId: string, seatId: string, currentSeats: Record<string, string | null>): void;
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

/** Effective meeting seat of every employee: server value overlaid with this session's draft moves. */
export function effectiveMeetingSeats(current: Record<string, string | null>, meetingSeating: Seating): Record<string, string | null> {
  return { ...current, ...meetingSeating };
}

/** Meeting seats pointing at a table that is no longer in the layout are cleared (007). */
function pruneMeetingSeating(layout: OfficeLayout, m: Seating): Seating {
  const tables = new Set(layout.items.filter((i) => isMeetingTable(i.type)).map((i) => i.id));
  let out = m;
  for (const [id, seat] of Object.entries(m)) {
    if (seat && !tables.has(seat.slice(0, seat.lastIndexOf('#')))) out = { ...out, [id]: null };
  }
  return out;
}

export const useBuild = create<BuildStore>((set, get) => ({
  active: false,
  draft: null,
  seating: {},
  meetingSeating: {},
  past: [],
  future: [],
  palette: null,
  rotation: 0,
  selectedId: null,
  drag: null,
  validation: null,
  resizeBlockers: [],
  frameHeight: FRAME_HEIGHT_DEFAULT,
  begin: (layout) =>
    set({ active: true, draft: structuredClone(layout), seating: {}, meetingSeating: {}, past: [], future: [], selectedId: null, palette: null, drag: null, validation: validateLayout(layout) }),
  end: () => set({ active: false, draft: null, seating: {}, meetingSeating: {}, past: [], future: [], selectedId: null, palette: null, drag: null, validation: null, resizeBlockers: [] }),
  setPalette: (palette) => set({ palette, selectedId: null }),
  rotate: () => set((s) => ({ rotation: nextRot(s.rotation) })),
  select: (selectedId) => set({ selectedId, palette: null }),
  apply: (next, seating, meetingSeating) => {
    const { draft, past } = get();
    if (!draft) return;
    const s = seating ?? get().seating;
    // Seats at a table that was just deleted are dropped, but only for employees moved this session; the
    // server clears the others when it saves (employees.assignDesks).
    const m = pruneMeetingSeating(next, meetingSeating ?? get().meetingSeating);
    set({
      draft: next,
      seating: s,
      meetingSeating: m,
      past: [...past.slice(-49), { layout: draft, seating: get().seating, meetingSeating: get().meetingSeating }],
      future: [],
      validation: validateLayout(next),
    });
  },
  place: (item) => {
    const { draft } = get();
    if (!draft) return;
    const placed: PlacedItem = { ...item, id: newId(item.type) };
    if (isWallMounted(item.type)) set({ frameHeight: item.height ?? FRAME_HEIGHT_DEFAULT });
    const extra: PlacedItem[] = [];
    // A new desk comes with its chair on the seat (if that spot is free).
    if (item.type === 'desk') {
      const seat = seatPoint(placed);
      const chair: PlacedItem = { id: newId('chair'), type: 'chair', pos: { x: snap(seat.x - 0.25, 0.05), z: snap(seat.z - 0.25, 0.05) }, rotation: item.rotation };
      const cr = footprintRect(chair);
      const taken = draft.items.some((i) => !onEdgeGrid(i.type) && rectsOverlap(footprintRect(i), cr));
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
    get().apply(
      dropUnsupportedFrames({
        ...draft,
        items: draft.items.map((i) =>
          i.id === id ? { ...i, pos } : followers.has(i.id) ? { ...i, pos: { x: snap(i.pos.x + dx, 0.05), z: snap(i.pos.z + dz, 0.05) } } : i,
        ),
      }),
    );
  },
  rotateSelected: () => {
    const { draft, selectedId } = get();
    const it = draft?.items.find((i) => i.id === selectedId);
    if (!draft || !it) return;
    // 007: a frame flips to the other side of the same wall; on the outer wall (no other side) it stays.
    const rotation = isWallMounted(it.type) ? (((it.rotation + 180) % 360) as Rotation) : nextRot(it.rotation);
    if (isWallMounted(it.type) && !frameSupported(draft, { ...it, rotation })) return;
    get().apply(dropUnsupportedFrames({ ...draft, items: draft.items.map((i) => (i.id === it.id ? { ...i, rotation } : i)) }));
  },
  setFrameHeight: (id, height) => {
    const { draft } = get();
    if (!draft) return;
    get().apply({ ...draft, items: draft.items.map((i) => (i.id === id ? { ...i, height } : i)) });
    set({ frameHeight: height });
  },
  setPicture: (id, picture) => {
    const { draft } = get();
    if (!draft) return;
    get().apply({
      ...draft,
      items: draft.items.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, picture };
        if (!picture) delete next.picture; // absent, not undefined: the saved JSON stays as before
        return next;
      }),
    });
  },
  removeSelected: () => {
    const { draft, selectedId } = get();
    if (!draft || !selectedId) return;
    get().apply(dropUnsupportedFrames({ ...draft, items: draft.items.filter((i) => i.id !== selectedId) }));
    set({ selectedId: null });
  },
  assignSeat: (conversationId, deskId, currentDesks) => {
    const { draft, seating } = get();
    if (!draft) return;
    const desks = effectiveDesks(currentDesks, seating);
    const mine = desks[conversationId] ?? null;
    if (mine === deskId) {
      // 007: back onto their own (reserved) desk — leave the meeting if they were in one.
      if (get().meetingSeating[conversationId] !== null) get().apply(draft, seating, { ...get().meetingSeating, [conversationId]: null });
      return;
    }
    const occupant = Object.entries(desks).find(([id, d]) => d === deskId && id !== conversationId)?.[0];
    const next: Seating = { ...seating, [conversationId]: deskId };
    if (occupant) next[occupant] = mine;
    // 007: dropping onto any desk ends the meeting for that employee.
    get().apply(draft, next, { ...get().meetingSeating, [conversationId]: null });
  },
  assignMeetingSeat: (conversationId, seatId, currentSeats) => {
    const { draft, meetingSeating } = get();
    if (!draft) return;
    const seats = effectiveMeetingSeats(currentSeats, meetingSeating);
    const mine = seats[conversationId] ?? null;
    if (mine === seatId) return;
    const occupant = Object.entries(seats).find(([id, s]) => s === seatId && id !== conversationId)?.[0];
    const next: Seating = { ...meetingSeating, [conversationId]: seatId };
    if (occupant) next[occupant] = mine;
    get().apply(draft, undefined, next);
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
    const { draft, seating, meetingSeating, past, future } = get();
    const prev = past.at(-1);
    if (!draft || !prev) return;
    set({
      draft: prev.layout,
      seating: prev.seating,
      meetingSeating: prev.meetingSeating,
      past: past.slice(0, -1),
      future: [{ layout: draft, seating, meetingSeating }, ...future],
      validation: validateLayout(prev.layout),
    });
  },
  redo: () => {
    const { draft, seating, meetingSeating, past, future } = get();
    const next = future[0];
    if (!draft || !next) return;
    set({
      draft: next.layout,
      seating: next.seating,
      meetingSeating: next.meetingSeating,
      past: [...past, { layout: draft, seating, meetingSeating }],
      future: future.slice(1),
      validation: validateLayout(next.layout),
    });
  },
}));
