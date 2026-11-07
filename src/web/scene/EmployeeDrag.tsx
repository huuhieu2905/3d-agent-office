import type { ThreeEvent } from '@react-three/fiber';
import { useBuild } from '../state/build';

// T103 / FR-052: in build mode, press on an employee and release over a desk (BuildGizmo) to seat them there.

export function useEmployeeDrag(conversationId: string) {
  const active = useBuild((s) => s.active);
  const setDragging = useBuild((s) => s.setDraggingEmployee);
  return {
    buildActive: active,
    onPointerDown(e: ThreeEvent<PointerEvent>) {
      if (!active) return;
      e.stopPropagation();
      setDragging(conversationId);
    },
  };
}
