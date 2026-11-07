import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';

// FR-014: orbit / zoom / pan around the office, with limits so the office stays in view.

export function OverviewCamera({ size }: { size: [number, number] }) {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const r = Math.max(size[0], size[1]);
    void c.setLookAt(0, r * 0.75, r * 0.85, 0, 0, 0, false);
  }, [size]);
  const r = Math.max(size[0], size[1]);
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
    />
  );
}
