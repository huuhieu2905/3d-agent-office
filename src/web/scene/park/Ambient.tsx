import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { DetailLevel } from '@shared/domain';
import { instantiate, play, setSeated, type CharacterInstance } from '../character';
import { DETAIL, rng } from './detail';
import { PATH_WIDTH, exerciseSpots, onPath, parkFrame, type ParkFrame } from './park-layout';

// T109 / FR-061 (001) → 002 US7 / T084 / FR-041: people in the park, drawn with the same cartoon
// figures as the employees (no name tag, not clickable). Walkers and joggers go both ways round the
// loop path; each direction of walking and of jogging has its own lane and one speed with people spread
// evenly, so nobody ever walks through anybody. A group exercises on the lawn and one person reads on a
// bench. Fewer people when it rains. The ring-road traffic moved to city/TrafficView.tsx.

type Kind = 'walk' | 'jog';
const LOOKS = ['worker-a', 'worker-b', 'worker-c', 'worker-d', 'worker-e', 'worker-f', 'worker-g', 'worker-h'];
const LANES: { kind: Kind; lane: number; dir: 1 | -1; speed: number }[] = [
  { kind: 'walk', lane: -0.2, dir: -1, speed: 1.1 },
  { kind: 'walk', lane: 0.2, dir: 1, speed: 1.0 },
  { kind: 'jog', lane: -0.6, dir: 1, speed: 2.5 },
  { kind: 'jog', lane: 0.6, dir: -1, speed: 2.3 },
];

interface Walker {
  c: CharacterInstance;
  kind: Kind;
  lane: number;
  dir: 1 | -1;
  speed: number;
  angle: number;
}

function useCharacters(n: number, offset: number): CharacterInstance[] {
  const list = useMemo(() => Array.from({ length: n }, (_, i) => instantiate(LOOKS[(i + offset) % LOOKS.length]!, { shadows: false })), [n, offset]);
  useEffect(() => () => list.forEach((c) => c.dispose()), [list]);
  return list;
}

export function Ambient({ detail, seed, rainy, floor }: { detail: DetailLevel; seed: number; rainy: boolean; floor: { width: number; depth: number } }) {
  const frame: ParkFrame = useMemo(() => parkFrame(floor), [floor.width, floor.depth]);
  const d = DETAIL[detail];
  const people = Math.max(4, Math.round(d.walkers * (rainy ? 0.4 : 1)));
  const perLane = Math.max(1, Math.floor(people / LANES.length));
  const exercisers = rainy ? 0 : 3;

  const walkerChars = useCharacters(perLane * LANES.length, seed);
  const groupChars = useCharacters(exercisers + 1, seed + 3);

  const walkers = useMemo<Walker[]>(() => {
    const r = rng(seed * 13 + 7);
    return LANES.flatMap((L, li) =>
      Array.from({ length: perLane }, (_, i) => {
        const c = walkerChars[li * perLane + i]!;
        play(c, 'Walking');
        return { c, kind: L.kind, lane: L.lane, dir: L.dir, speed: L.speed, angle: (i / perLane) * Math.PI * 2 + r() * 0.5 };
      }),
    );
  }, [walkerChars, perLane, seed]);

  const spots = useMemo(() => exerciseSpots(frame, exercisers), [frame, exercisers]);
  // Reader on a bench: just outside the path, east side, facing the office.
  const reader = useMemo(() => {
    const p = onPath(frame, 0.1, PATH_WIDTH / 2 + 1.6);
    return { x: p.x, z: p.z, facing: Math.atan2(-p.x, -p.z) };
  }, [frame]);
  useEffect(() => {
    groupChars.forEach((c, i) => {
      if (i < exercisers) play(c, i === 2 ? 'Idle' : 'ThumbsUp');
      else {
        setSeated(c, true);
        play(c, 'Sitting');
      }
    });
  }, [groupChars, exercisers]);

  const walkerRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const avg = (frame.rx + frame.rz) / 2;
    walkers.forEach((w, i) => {
      w.angle += (w.dir * w.speed * step) / avg;
      const p = onPath(frame, w.angle, w.lane);
      const g = walkerRefs.current[i];
      if (g) {
        g.position.set(p.x, 0, p.z);
        // Tangent of the ellipse in the direction of travel; characters face +z.
        const tx = -Math.sin(w.angle) * frame.rx * w.dir;
        const tz = Math.cos(w.angle) * frame.rz * w.dir;
        g.rotation.y = Math.atan2(tx, tz);
      }
      w.c.mixer.update(step * (w.kind === 'jog' ? 1.9 : 1));
    });
    groupChars.forEach((c) => c.mixer.update(step));
  });

  return (
    <group>
      {walkers.map((w, i) => (
        <group key={i} ref={(g) => void (walkerRefs.current[i] = g)}>
          <primitive object={w.c.root} />
        </group>
      ))}
      {spots.map((s, i) => (
        <group key={`ex${i}`} position={[s.x, 0, s.z]} rotation-y={0.9 + i * 0.4}>
          <primitive object={groupChars[i]!.root} />
        </group>
      ))}
      <group position={[reader.x, 0, reader.z]} rotation-y={reader.facing}>
        <Bench />
        <primitive object={groupChars[exercisers]!.root} position={[0, 0, 0.05]} />
      </group>
    </group>
  );
}

/** A park bench (wooden slats on iron legs); the sitter faces +z. */
export function Bench() {
  return (
    <group>
      {[-0.15, 0, 0.15].map((z) => (
        <mesh key={z} position={[0, 0.45, z]} castShadow>
          <boxGeometry args={[1.7, 0.04, 0.12]} />
          <meshStandardMaterial color="#9a6a3e" roughness={0.7} />
        </mesh>
      ))}
      {[0.66, 0.82].map((y) => (
        <mesh key={y} position={[0, y, -0.27]} castShadow>
          <boxGeometry args={[1.7, 0.1, 0.04]} />
          <meshStandardMaterial color="#9a6a3e" roughness={0.7} />
        </mesh>
      ))}
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.22, -0.05]}>
          <boxGeometry args={[0.05, 0.45, 0.45]} />
          <meshStandardMaterial color="#2b2d30" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
