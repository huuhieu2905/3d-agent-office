import { describe, expect, it, vi } from 'vitest';
import { DragController, THRESHOLD_PX } from '../../src/web/scene/interaction/DragController';

// 002 T030 — contracts/ui-interactions.md U-2.

const at = (x: number, y = 0) => ({ x, y });

describe('DragController', () => {
  it('treats movement up to 4 px as a click and never previews or commits', () => {
    const cb = { onStart: vi.fn(), onPreview: vi.fn(), onCommit: vi.fn() };
    const d = new DragController(cb);
    d.begin('item', 'a', 1, at(100), { x: 1, z: 1 }, { x: 0.5, z: 0.5 });
    expect(d.move(at(100 + THRESHOLD_PX), { x: 1.2, z: 1 })).toBe(false);
    expect(d.end()).toBe('click');
    expect(cb.onStart).not.toHaveBeenCalled();
    expect(cb.onPreview).not.toHaveBeenCalled();
    expect(cb.onCommit).not.toHaveBeenCalled();
  });

  it('keeps the grab offset and snaps furniture to 0.05 m, or 0.5 m with Shift', () => {
    const d = new DragController();
    d.begin('item', 'a', 1, at(0), { x: 2.1, z: 3.1 }, { x: 2, z: 3 });
    d.move(at(10), { x: 2.437, z: 3.362 });
    expect(d.state!.current).toEqual({ x: 2.35, z: 3.25 });
    d.move(at(20), { x: 2.437, z: 3.362 }, true);
    expect(d.state!.current).toEqual({ x: 2.5, z: 3.5 });
  });

  it('follows the cursor exactly for employees', () => {
    const d = new DragController();
    d.begin('employee', 'e', 1, at(0), { x: 5, z: 5 }, { x: 5, z: 5 });
    d.move(at(30), { x: 6.123, z: 4.9 });
    expect(d.state!.current).toEqual({ x: 6.123, z: 4.9 });
  });

  it('commits exactly once per drop (one undo step)', () => {
    const onCommit = vi.fn();
    const d = new DragController({ onCommit });
    d.begin('item', 'a', 1, at(0), { x: 0, z: 0 }, { x: 0, z: 0 });
    d.move(at(10), { x: 1, z: 0 });
    d.move(at(20), { x: 2, z: 0 });
    expect(d.end()).toBe('drop');
    expect(d.end()).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0].current).toEqual({ x: 2, z: 0 });
  });

  it('cancel (Esc, pointercancel, blur) commits nothing and reports a cancel only after a real drag', () => {
    const cb = { onCommit: vi.fn(), onCancel: vi.fn() };
    const d = new DragController(cb);
    d.begin('item', 'a', 1, at(0), { x: 0, z: 0 }, { x: 0, z: 0 });
    d.cancel();
    expect(cb.onCancel).not.toHaveBeenCalled();
    d.begin('item', 'a', 1, at(0), { x: 0, z: 0 }, { x: 0, z: 0 });
    d.move(at(50), { x: 3, z: 0 });
    d.cancel();
    expect(cb.onCancel).toHaveBeenCalledTimes(1);
    expect(d.end()).toBeNull();
    expect(cb.onCommit).not.toHaveBeenCalled();
  });
});
