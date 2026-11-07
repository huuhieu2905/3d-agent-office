import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONCEPT } from '../theme/concept';

// T054: lights dim smoothly while the App is disconnected and recover when it reconnects.
// 002 US6 / T068: concept E+ light (tropical sun, warm interior at night) and a procedural studio
// environment (three.js RoomEnvironment, generated in code) for PBR reflections — no HDRI download.

let envCache: { gl: THREE.WebGLRenderer; tex: THREE.Texture } | null = null;
function ConceptEnvironment({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!envCache || envCache.gl !== gl) {
      const pmrem = new THREE.PMREMGenerator(gl);
      envCache = { gl, tex: pmrem.fromScene(new RoomEnvironment(), 0.04).texture };
      pmrem.dispose();
    }
    scene.environment = envCache.tex;
    return () => {
      if (scene.environment === envCache?.tex) scene.environment = null;
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);
  return null;
}

export function OfficeMood({
  disconnected,
  theme,
  weatherFactor = 1,
  floor = { width: 16, depth: 12 },
}: {
  disconnected: boolean;
  theme: 'light' | 'dark';
  weatherFactor?: number;
  /** Office size: the shadow frustum covers the whole floor (002 US4). */
  floor?: { width: number; depth: number };
}) {
  const sx = Math.max(11, floor.width / 2 + 3);
  const sz = Math.max(9, floor.depth / 2 + 3);
  const ambient = useRef<THREE.AmbientLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const L = theme === 'dark' ? CONCEPT.light.night : CONCEPT.light.day;
  const base = { amb: L.ambI, sun: L.sunI, hemi: L.hemiI };

  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3);
    const f = (disconnected ? 0.3 : 1) * weatherFactor;
    if (ambient.current) ambient.current.intensity += (base.amb * f - ambient.current.intensity) * k;
    if (sun.current) sun.current.intensity += (base.sun * f - sun.current.intensity) * k;
    if (hemi.current) hemi.current.intensity += (base.hemi * f - hemi.current.intensity) * k;
  });

  return (
    <>
      <ConceptEnvironment intensity={(disconnected ? 0.3 : 1) * L.env} />
      <ambientLight ref={ambient} intensity={base.amb} />
      <hemisphereLight key={theme} ref={hemi} args={[L.sky, L.ground, base.hemi]} />
      <directionalLight
        ref={sun}
        color={L.sun}
        position={[6, 12, 8]}
        intensity={base.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        key={`${sx}x${sz}`}
        shadow-camera-left={-sx}
        shadow-camera-right={sx}
        shadow-camera-top={sz}
        shadow-camera-bottom={-sz}
        shadow-camera-far={Math.max(50, sx * 3)}
        shadow-bias={-0.0005}
      />
      {theme === 'dark' && <pointLight position={[0, 2.4, 0]} intensity={disconnected ? 4 : 14} distance={Math.max(14, Math.max(floor.width, floor.depth))} color={CONCEPT.light.night.interior} />}
    </>
  );
}
