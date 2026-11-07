import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DetailLevel } from '@shared/domain';
import { DETAIL, OFFICE_HALF, PARK_RADIUS, PATH_RADIUS, ROAD_RADIUS, rng } from './detail';

// T108 / FR-061: the park around the office — lawn, paths, a road ring, many kinds of trees and flowers,
// all drawn with InstancedMesh (one draw call per kind) and sized by the detail level (R4).

const TREE_KINDS = [
  { trunk: '#7b5534', crown: '#3f8f4f', shape: 'cone' as const },
  { trunk: '#6d4c33', crown: '#5fae5a', shape: 'ball' as const },
  { trunk: '#80603f', crown: '#2f7a4a', shape: 'cone' as const },
  { trunk: '#7b5534', crown: '#e58fb0', shape: 'ball' as const }, // flowering (cherry / bằng lăng)
];
const FLOWER_COLORS = ['#ff6b6b', '#ffd166', '#f78fb3', '#b388eb', '#ffffff', '#ff9f43'];

function placeOnPark(r: () => number, minR = PATH_RADIUS + 2, maxR = PARK_RADIUS) {
  for (let i = 0; i < 20; i++) {
    const a = r() * Math.PI * 2;
    const d = minR + r() * (maxR - minR);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.abs(x) < OFFICE_HALF.x + 2 && Math.abs(z) < OFFICE_HALF.z + 2) continue;
    return { x, z };
  }
  return { x: maxR, z: 0 };
}

function useInstances(count: number, setter: (i: number, m: THREE.Matrix4, c: THREE.Color) => void, deps: unknown[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      setter(i, m, c);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

function Trees({ count, seed, kind }: { count: number; seed: number; kind: number }) {
  const k = TREE_KINDS[kind]!;
  const spots = useMemo(() => {
    const r = rng(seed * 31 + kind);
    return Array.from({ length: count }, () => ({ ...placeOnPark(r), s: 0.7 + r() * 0.8, rot: r() * Math.PI }));
  }, [count, seed, kind]);
  const trunk = useInstances(
    count,
    (i, m, c) => {
      const p = spots[i]!;
      m.compose(new THREE.Vector3(p.x, 0.6 * p.s, p.z), new THREE.Quaternion(), new THREE.Vector3(p.s, p.s, p.s));
      c.set(k.trunk);
    },
    [spots],
  );
  const crown = useInstances(
    count,
    (i, m, c) => {
      const p = spots[i]!;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
      m.compose(new THREE.Vector3(p.x, (k.shape === 'cone' ? 2.1 : 1.9) * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      c.set(k.crown).offsetHSL(0, 0, (i % 5) * 0.015 - 0.03);
    },
    [spots],
  );
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, count]} castShadow={false}>
        <cylinderGeometry args={[0.12, 0.18, 1.2, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, count]}>
        {k.shape === 'cone' ? <coneGeometry args={[0.9, 2.2, 6]} /> : <icosahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

function Flowers({ count, seed }: { count: number; seed: number }) {
  const ref = useInstances(
    count,
    (i, m, c) => {
      const r = rng(seed * 97 + i);
      // Flower beds: clusters near the paths.
      const bed = Math.floor(r() * 12);
      const a = (bed / 12) * Math.PI * 2 + (r() - 0.5) * 0.25;
      const d = PATH_RADIUS + 1 + r() * 3.5;
      const s = 0.12 + r() * 0.1;
      m.compose(new THREE.Vector3(Math.cos(a) * d, s, Math.sin(a) * d), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      c.set(FLOWER_COLORS[bed % FLOWER_COLORS.length]!);
    },
    [count, seed],
  );
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.8} flatShading />
    </instancedMesh>
  );
}

export function Park({ detail, seed, rainy, dark = false }: { detail: DetailLevel; seed: number; rainy: boolean; dark?: boolean }) {
  const d = DETAIL[detail];
  const perKind = Math.ceil(d.trees / TREE_KINDS.length);
  const grass = dark ? '#24361f' : rainy ? '#6f9a5a' : '#8cc56f';
  const path = dark ? '#4a463e' : '#d8cdb6';
  return (
    <group>
      {/* Lawn */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[ROAD_RADIUS + 30, 64]} />
        <meshStandardMaterial color={grass} roughness={1} />
      </mesh>
      {/* Walking path ring + spokes */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <ringGeometry args={[PATH_RADIUS - 0.9, PATH_RADIUS + 0.9, 64]} />
        <meshStandardMaterial color={path} roughness={1} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} rotation-z={(i * Math.PI) / 2} position={[0, -0.011, 0]}>
          <planeGeometry args={[1.6, ROAD_RADIUS * 2 - 4]} />
          <meshStandardMaterial color={path} roughness={1} />
        </mesh>
      ))}
      {/* Road ring for the traffic */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
        <ringGeometry args={[ROAD_RADIUS - 2.4, ROAD_RADIUS + 2.4, 96]} />
        <meshStandardMaterial color="#4a4f59" roughness={0.95} />
      </mesh>
      {TREE_KINDS.map((_, k) => (
        <Trees key={k} kind={k} count={perKind} seed={seed} />
      ))}
      <Flowers count={d.flowers} seed={seed} />
    </group>
  );
}
