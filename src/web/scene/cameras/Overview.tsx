import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../../state/settings';

// Remembered pose so switching back from first person returns to the same view (T118).
let saved: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

// FR-014: orbit / zoom / pan around the office, with limits so the office stays in view.

export function OverviewCamera({ size }: { size: [number, number] }) {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (saved) {
      void c.setLookAt(saved.pos.x, saved.pos.y, saved.pos.z, saved.target.x, saved.target.y, saved.target.z, false);
    } else {
      const r = Math.max(size[0], size[1]);
      void c.setLookAt(0, r * 0.75, r * 0.85, 0, 0, 0, false);
    }
    return () => {
      saved = { pos: c.getPosition(new THREE.Vector3()), target: c.getTarget(new THREE.Vector3()) };
    };
  }, [size]);
  const r = Math.max(size[0], size[1]);
  const sensitivity = useSettings((s) => s.settings.mouseSensitivity ?? 1); // 006 US5: rotate only, not zoom/pan
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={4}
      maxDistance={r * 4}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2.25}
      dollySpeed={0.6}
      truckSpeed={1.2}
      azimuthRotateSpeed={sensitivity}
      polarRotateSpeed={sensitivity}
    />
  );
}
