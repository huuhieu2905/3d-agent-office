import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

// T054: lights dim smoothly while the App is disconnected and recover when it reconnects.

export function OfficeMood({ disconnected, theme }: { disconnected: boolean; theme: 'light' | 'dark' }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const base = theme === 'dark' ? { amb: 0.25, sun: 0.35, hemi: 0.35 } : { amb: 0.55, sun: 1.25, hemi: 0.5 };

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    const f = disconnected ? 0.3 : 1;
    if (ambient.current) ambient.current.intensity += (base.amb * f - ambient.current.intensity) * k;
    if (sun.current) sun.current.intensity += (base.sun * f - sun.current.intensity) * k;
    if (hemi.current) hemi.current.intensity += (base.hemi * f - hemi.current.intensity) * k;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={base.amb} />
      <hemisphereLight ref={hemi} args={['#dfefff', '#8a7a62', base.hemi]} />
      <directionalLight
        ref={sun}
        position={[6, 12, 8]}
        intensity={base.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
      />
      {theme === 'dark' && <pointLight position={[0, 2.4, 0]} intensity={disconnected ? 4 : 14} distance={14} color="#ffe2b0" />}
    </>
  );
}
