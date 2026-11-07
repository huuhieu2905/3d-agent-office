import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { City, DetailLevel } from '@shared/domain';
import { Trees } from './Trees';
import { DETAIL, ROAD_RADIUS, rng } from './detail';
import { PATH_WIDTH, onPath, parkFrame, spokes, type ParkFrame } from './park-layout';

// T108 / FR-061: the park around the office — lawn, paths, a road ring, many kinds of trees and flowers,
// all drawn with InstancedMesh (one draw call per kind) and sized by the detail level (R4).
// 002 T055: paths, flower beds and the open lawn follow the office size (park-layout.ts).

/** Lawn with several greens (concept E+ round 2), tinted per weather/theme by the material colour. */
function grassTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9dcb2';
  g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.45;
    g.fillStyle = new THREE.Color('#8fb26a').offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.14).getStyle();
    g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 4 + r() * 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  return t;
}

/** Park lamps along the loop path (FR-040); the globes glow at night. */
function ParkLamps({ frame, night }: { frame: ParkFrame; night: boolean }) {
  const spots = useMemo(() => Array.from({ length: 10 }, (_, i) => onPath(frame, (i / 10) * Math.PI * 2 + 0.3, PATH_WIDTH / 2 + 0.6)), [frame]);
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.04, 0.06, 3, 8]} />
            <meshStandardMaterial color="#2b2d30" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshStandardMaterial color="#fff6dc" emissive={night ? '#ffdc9a' : '#000000'} emissiveIntensity={night ? 4 : 0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

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
  city = 'hcmc',
  noTrees = false,
}: {
  detail: DetailLevel;
  seed: number;
  rainy: boolean;
  dark?: boolean;
  /** Office size: the lawn, loop path and flower beds follow it (002 T055). */
  floor: { width: number; depth: number };
  /** City: which street tree and blossom colour (002 T082). */
  city?: City;
  /** Bench profiling only. */
  noTrees?: boolean;
}) {
  const d = DETAIL[detail];
  const frame = useMemo(() => parkFrame(floor), [floor.width, floor.depth]);
  const grass = dark ? '#3a4f33' : rainy ? '#8fb07a' : '#b9d79a';
  const grassMap = useMemo(() => grassTexture(), []);
  const path = dark ? '#4a463e' : '#d8cdb6';
  return (
    <group>
      {/* Lawn */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[ROAD_RADIUS + 30, 64]} />
        <meshStandardMaterial color={grass} map={grassMap} roughness={1} />
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
      {!noTrees && <Trees city={city} detail={detail} seed={seed} frame={frame} />}
      <ParkLamps frame={frame} night={dark} />
      <Flowers count={d.flowers} seed={seed} frame={frame} />
    </group>
  );
}
