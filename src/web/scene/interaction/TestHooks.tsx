import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OfficeLayout } from '@shared/domain';
import { useBuild } from '../../state/build';

// e2e support (002 T029): project a floor-space point (metres from the office's north-west corner) to
// page coordinates, so tests can press and drag on real objects in the 3D canvas. Read-only.

declare global {
  interface Window {
    __agentOffice?: {
      project(x: number, z: number, y?: number): { x: number; y: number };
      /** Arrange-mode state, for assertions and debugging. */
      arrange(): { active: boolean; selectedId: string | null; drag: unknown; seating: Record<string, string | null>; past: number };
    };
  }
}

export function TestHooks({ layout }: { layout: OfficeLayout }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__agentOffice = {
      project(x, z, y = 0) {
        const v = new THREE.Vector3(x - layout.floor.width / 2, y, z - layout.floor.depth / 2).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      arrange() {
        const b = useBuild.getState();
        return { active: b.active, selectedId: b.selectedId, drag: b.drag, seating: b.seating, past: b.past.length };
      },
    };
    return () => {
      delete window.__agentOffice;
    };
  }, [camera, gl, layout]);
  return null;
}
