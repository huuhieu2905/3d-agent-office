import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OfficeLayout } from '@shared/domain';
import { footprintRect, isMeetingTable, onEdgeGrid, rectsOverlap, seatPoints, snap } from '@shared/catalog';
import { floorSizeValid, insideFloor, resizeBlockers, validateLayout } from '@shared/layout-validation';
import { FLOOR_MAX, FLOOR_MIN } from '@shared/domain';
import { chairsOf, effectiveDesks, effectiveMeetingSeats, useBuild } from '../../state/build';
import { DragController, type DragKind, type DragState, type Pt } from './DragController';

// 002 US2 / T032 (R2-02): the arrange-mode drag layer. Draggable objects call beginDrag() from their
// pointerdown; from then on this layer owns the pointer:
// - pointer capture on the canvas, camera controls switched off until the pointer is released
// - the floor point is the ray's intersection with a horizontal plane (no dependence on which mesh is
//   hit): y = 0 for furniture, desk-top height for employees, because that is what the user points at
// - Esc, pointercancel and window blur cancel; nothing is committed until a real drop

type Pending = { kind: DragKind; id: string; origin: Pt; event: PointerEvent };

/** Height of the plane a dragged employee is dropped on: the desk top (FR-010). */
export const DESK_TOP_Y = 0.75;
let starter: ((p: Pending) => void) | null = null;

/** Called by draggable objects (furniture, employees) on pointerdown in arrange mode. */
export function beginDrag(kind: DragKind, id: string, origin: Pt, event: PointerEvent): void {
  if (event.button !== 0) return; // 006: only the left button drags; right-click is delete (OfficeScene)
  starter?.({ kind, id, origin, event });
}

/** Desk whose footprint (plus a 0.25 m margin) contains a floor point. */
export function deskAt(layout: OfficeLayout, p: Pt): string | null {
  const hit = layout.items.find((i) => {
    if (i.type !== 'desk') return false;
    const r = footprintRect(i);
    return p.x >= r.x0 - 0.25 && p.x <= r.x1 + 0.25 && p.z >= r.z0 - 0.25 && p.z <= r.z1 + 0.25;
  });
  return hit?.id ?? null;
}

/** 007: nearest meeting-table seat within 0.4 m of a floor point. */
export function seatAt(layout: OfficeLayout, p: Pt): string | null {
  let best: string | null = null;
  let bestD = 0.4;
  for (const t of layout.items) {
    if (!isMeetingTable(t.type)) continue;
    for (const s of seatPoints(t)) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
  }
  return best;
}

/** Walls, glass, doors and frames stay on the 0.5 m edge grid while dragged (007). */
function itemPos(layout: OfficeLayout, id: string, p: Pt): Pt {
  const it = layout.items.find((i) => i.id === id);
  return it && onEdgeGrid(it.type) ? { x: snap(p.x, 0.5), z: snap(p.z, 0.5) } : p;
}

/** Floor size from a dragged edge handle (`origin` = the edge position when the drag began). */
export function sizeFromHandle(layout: OfficeLayout, id: string, at: Pt): { width: number; depth: number } {
  const clamp = (v: number) => Math.min(FLOOR_MAX, Math.max(FLOOR_MIN, v));
  return id === 'east' ? { width: clamp(at.x), depth: layout.floor.depth } : { width: layout.floor.width, depth: clamp(at.z) };
}

/** Would moving `id` (with its chairs) to `pos` keep the layout valid? (FR-008) */
export function moveIsValid(layout: OfficeLayout, id: string, pos: Pt): boolean {
  const it = layout.items.find((i) => i.id === id);
  if (!it) return false;
  const dx = pos.x - it.pos.x;
  const dz = pos.z - it.pos.z;
  const followers = new Set(it.type === 'desk' ? chairsOf(layout, it).map((c) => c.id) : []);
  const moved = layout.items.map((i) => (i.id === id ? { ...i, pos } : followers.has(i.id) ? { ...i, pos: { x: i.pos.x + dx, z: i.pos.z + dz } } : i));
  const candidate = { ...layout, items: moved };
  const self = moved.find((i) => i.id === id)!;
  if (!insideFloor(candidate, self)) return false;
  // Overlap with anything solid that is not part of the moved group.
  const group = new Set([id, ...followers]);
  const r = footprintRect(self);
  for (const o of moved) {
    if (group.has(o.id) || onEdgeGrid(o.type) || o.type === 'wall_screen') continue;
    if (rectsOverlap(r, footprintRect(o))) return false;
  }
  // Seats still reachable, door still free, nothing else made invalid.
  const before = new Set(validateLayout(layout).invalidItems);
  const after = validateLayout(candidate);
  if (after.reasons['__door__']) return false;
  return after.invalidItems.every((x) => before.has(x) && !group.has(x));
}

export function DragLayer({
  layout,
  currentDesks,
  currentSeats,
}: {
  layout: OfficeLayout;
  currentDesks: Record<string, string | null>;
  /** 007: served meeting seat of every employee. */
  currentSeats: Record<string, string | null>;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  // Read through refs so a WebSocket update or a re-render never tears down a drag in progress.
  const layoutRef = useRef(layout);
  const desksRef = useRef(currentDesks);
  layoutRef.current = layout;
  desksRef.current = currentDesks;
  const seatsRef = useRef(currentSeats);
  seatsRef.current = currentSeats;

  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    let height = 0;
    const floorAt = (clientX: number, clientY: number): Pt | null => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      plane.constant = -height;
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return { x: hit.x + layoutRef.current.floor.width / 2, z: hit.z + layoutRef.current.floor.depth / 2 };
    };
    const build = () => useBuild.getState();
    const preview = (s: DragState) => {
      const draft = build().draft ?? layoutRef.current;
      if (s.kind === 'item') {
        const pos = itemPos(draft, s.id, s.current);
        build().setDrag({ kind: 'item', id: s.id, pos, valid: moveIsValid(draft, s.id, pos) });
      }
      else if (s.kind === 'handle') {
        const size = sizeFromHandle(draft, s.id, s.current);
        const ok = floorSizeValid(size.width) && floorSizeValid(size.depth) && resizeBlockers(draft, size.width, size.depth).length === 0;
        build().setDrag({ kind: 'handle', id: s.id, pos: s.current, valid: ok, size });
      } else {
        // 007: a meeting-table seat under the cursor wins over a desk.
        const seatId = seatAt(draft, s.current);
        const deskId = seatId ? null : deskAt(draft, s.current);
        const taken = seatId ? effectiveMeetingSeats(seatsRef.current, build().meetingSeating) : effectiveDesks(desksRef.current, build().seating);
        const target = seatId ?? deskId;
        const occupied = !!target && Object.entries(taken).some(([id, d]) => d === target && id !== s.id);
        build().setDrag({ kind: 'employee', id: s.id, pos: s.current, valid: !!target, deskId, seatId, occupied });
      }
    };
    const restore = () => {
      if (controls) controls.enabled = true;
      build().setDrag(null);
    };
    const drag = new DragController({
      onPreview: preview,
      onCommit: (s) => {
        const draft = build().draft;
        if (!draft) return;
        if (s.kind === 'item') {
          const pos = itemPos(draft, s.id, s.current);
          if (moveIsValid(draft, s.id, pos)) build().move(s.id, pos);
        } else if (s.kind === 'handle') {
          const size = sizeFromHandle(draft, s.id, s.current);
          build().resizeFloor(size.width, size.depth);
        } else {
          const seatId = seatAt(draft, s.current);
          const deskId = seatId ? null : deskAt(draft, s.current);
          if (seatId) build().assignMeetingSeat(s.id, seatId, seatsRef.current);
          else if (deskId) build().assignSeat(s.id, deskId, desksRef.current);
        }
      },
    });

    starter = ({ kind, id, origin, event }) => {
      if (!build().active) return;
      height = kind === 'employee' ? DESK_TOP_Y : 0;
      const f = floorAt(event.clientX, event.clientY);
      if (!f) return;
      if (controls) controls.enabled = false;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic events may not be capturable */
      }
      drag.begin(kind, id, event.pointerId, { x: event.clientX, y: event.clientY }, f, origin);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.state || e.pointerId !== drag.state.pointerId) return;
      const f = floorAt(e.clientX, e.clientY);
      if (f) drag.move({ x: e.clientX, y: e.clientY }, f, e.shiftKey);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag.state || e.pointerId !== drag.state.pointerId) return;
      drag.end();
      restore();
    };
    const onCancel = () => {
      if (!drag.state) return;
      drag.cancel();
      restore();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.state) {
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      starter = null;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      window.removeEventListener('keydown', onKey, { capture: true });
      if (drag.state) restore();
    };
  }, [camera, gl, controls, plane]);

  return null;
}
