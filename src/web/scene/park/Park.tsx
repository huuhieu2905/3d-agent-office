import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from './detail';
import { PATH_WIDTH, onPath, parkFrame, spokes, treeAllowed, treeCandidates, type ParkFrame } from './park-layout';

// T108 / FR-061: the park around the office — lawn, paths, a road ring, many kinds of trees and flowers,
// all drawn with InstancedMesh (one draw call per kind) and sized by the detail level (R4).
// 002 T055: paths, flower beds and the open lawn follow the office size (park-layout.ts).

const TREE_KINDS = [
  { trunk: '#7b5534', crown: '#3f8f4f', shape: 'cone' as const },
  { trunk: '#6d4c33', crown: '#5fae5a', shape: 'ball' as const },
  { trunk: '#80603f', crown: '#2f7a4a', shape: 'cone' as const },
  { trunk: '#7b5534', crown: '#e58fb0', shape: 'ball' as const }, // flowering (cherry / bằng lăng)
];
const FLOWER_COLORS = ['#ff6b6b', '#ffd166', '#f78fb3', '#b388eb', '#ffffff', '#ff9f43'];


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

function Trees({ count, seed, kind, frame }: { count: number; seed: number; kind: number; frame: ParkFrame }) {
  const k = TREE_KINDS[kind]!;
  // One fixed set per kind; the office size only decides which of them are shown (never moves a tree).
  const candidates = useMemo(() => treeCandidates(seed * 31 + kind, count * 2), [count, seed, kind]);
  const spots = useMemo(() => candidates.filter((t) => treeAllowed(frame, t.x, t.z)).slice(0, count), [candidates, frame]);
  count = spots.length;
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
    <group key={count}>
      <instancedMesh ref={trunk} args={[undefined, undefined, count]} castShadow={false}>
        <cylinderGeometry args={[0.12, 0.18, 1.2, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, count]}>
        {k.shape === 'cone' ? <coneGeometry args={[0.9, 2.2, 6]} /> : <icosahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}

function Flowers({ count, seed, frame }: { count: number; seed: number; frame: ParkFrame }) {
  const ref = useInstances(
    count,
    (i, m, c) => {
      const r = rng(seed * 97 + i);
      // Flower beds: clusters near the paths.
      const bed = Math.floor(r() * 12);
      const a = (bed / 12) * Math.PI * 2 + (r() - 0.5) * 0.25;
      // Beds just outside the loop path, so they move out with it.
      const p = onPath(frame, a, PATH_WIDTH / 2 + 0.6 + r() * 2.5);
      const s = 0.12 + r() * 0.1;
      m.compose(new THREE.Vector3(p.x, s, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      c.set(FLOWER_COLORS[bed % FLOWER_COLORS.length]!);
    },
    [count, seed, frame],
  );
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={0.8} flatShading />
    </instancedMesh>
  );
}

export function Park({
  detail,
  seed,
  rainy,
  dark = false,
  floor,
}: {
  detail: DetailLevel;
  seed: number;
  rainy: boolean;
  dark?: boolean;
  /** Office size: the lawn, loop path and flower beds follow it (002 T055). */
  floor: { width: number; depth: number };
}) {
  const d = DETAIL[detail];
  const frame = useMemo(() => parkFrame(floor), [floor.width, floor.depth]);
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
      {/* Loop path round the office (an ellipse through its corners) + four spokes out to the road */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} scale={[frame.rx, frame.rz, 1]}>
        <ringGeometry args={[1 - PATH_WIDTH / 2 / Math.min(frame.rx, frame.rz), 1 + PATH_WIDTH / 2 / Math.min(frame.rx, frame.rz), 128]} />
        <meshStandardMaterial color={path} roughness={1} />
      </mesh>
      {spokes(frame).map((sp) => {
        const mid = (sp.from + sp.to) / 2;
        const len = sp.to - sp.from;
        return (
          <mesh
            key={`${sp.axis}${sp.sign}`}
            rotation-x={-Math.PI / 2}
            rotation-z={sp.axis === 'x' ? Math.PI / 2 : 0}
            position={sp.axis === 'x' ? [sp.sign * mid, -0.011, 0] : [0, -0.011, sp.sign * mid]}
          >
            <planeGeometry args={[PATH_WIDTH, len]} />
            <meshStandardMaterial color={path} roughness={1} />
          </mesh>
        );
      })}
      {/* Road ring for the traffic */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.005, 0]}>
        <ringGeometry args={[ROAD_RADIUS - 2.4, ROAD_RADIUS + 2.4, 96]} />
        <meshStandardMaterial color="#4a4f59" roughness={0.95} />
      </mesh>
      {TREE_KINDS.map((_, k) => (
        <Trees key={k} kind={k} count={perKind} seed={seed} frame={frame} />
      ))}
      <Flowers count={d.flowers} seed={seed} frame={frame} />
    </group>
  );
}
