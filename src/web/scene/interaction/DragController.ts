import { POS_STEP } from '@shared/domain';
import { snap } from '@shared/catalog';

// 002 US2 / R2-02 / contracts/ui-interactions.md U-2: one drag model for furniture and employees.
// Pure (no React, no three.js): the caller turns pointer events into screen + floor points.
// - nothing happens until the pointer has moved more than THRESHOLD_PX (below that it is a click)
// - furniture keeps the offset between the grab point and its origin, snapped to 0.05 m (Shift: 0.5 m)
// - cancel() (Esc, pointercancel, window blur) restores everything: the caller simply never commits

export const THRESHOLD_PX = 4;
export const SHIFT_STEP = 0.5;

/** `handle` = an office edge being dragged to resize (US4): always 0.5 m steps. */
export type DragKind = 'item' | 'employee' | 'handle';
export interface Pt {
  x: number;
  z: number;
}

export interface DragState {
  kind: DragKind;
  id: string;
  pointerId: number;
  startPx: { x: number; y: number };
  /** Item position (floor metres) when the drag began. */
  origin: Pt;
  /** origin − grab point, so the item does not jump under the cursor. */
  grab: Pt;
  started: boolean;
  /** Item: snapped new position. Employee: the floor point under the cursor. */
  current: Pt;
}

export interface DragCallbacks {
  onStart?(s: DragState): void;
  onPreview?(s: DragState): void;
  onCommit?(s: DragState): void;
  onCancel?(s: DragState): void;
}

export class DragController {
  state: DragState | null = null;
  constructor(private readonly cb: DragCallbacks = {}) {}

  begin(kind: DragKind, id: string, pointerId: number, screen: { x: number; y: number }, floor: Pt, origin: Pt): void {
    this.state = {
      kind,
      id,
      pointerId,
      startPx: screen,
      origin,
      grab: kind === 'employee' ? { x: 0, z: 0 } : { x: origin.x - floor.x, z: origin.z - floor.z },
      started: false,
      current: kind === 'employee' ? floor : origin,
    };
  }

  /** Returns true while a drag is in progress (after the threshold). */
  move(screen: { x: number; y: number }, floor: Pt, shift = false): boolean {
    const s = this.state;
    if (!s) return false;
    if (!s.started) {
      if (Math.hypot(screen.x - s.startPx.x, screen.y - s.startPx.y) <= THRESHOLD_PX) return false;
      s.started = true;
      this.cb.onStart?.(s);
    }
    if (s.kind === 'item' || s.kind === 'handle') {
      const step = shift || s.kind === 'handle' ? SHIFT_STEP : POS_STEP;
      s.current = { x: snap(floor.x + s.grab.x, step), z: snap(floor.z + s.grab.z, step) };
    } else {
      s.current = { x: floor.x, z: floor.z };
    }
    this.cb.onPreview?.(s);
    return true;
  }

  /** 'click' when the pointer never passed the threshold, 'drop' after a drag, null when idle. */
  end(): 'click' | 'drop' | null {
    const s = this.state;
    this.state = null;
    if (!s) return null;
    if (!s.started) return 'click';
    this.cb.onCommit?.(s);
    return 'drop';
  }

  cancel(): void {
    const s = this.state;
    this.state = null;
    if (s?.started) this.cb.onCancel?.(s);
  }

  get active(): boolean {
    return !!this.state?.started;
  }
}
