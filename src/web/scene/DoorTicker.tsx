import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { useUi } from '../state/ui';
import type { DoorBook } from './doors';

// 008: advance the office doors once per frame with everyone who could stand in a doorway — the employees
// (`positions`, world metres) and, in first person, the user.
export function DoorTicker({ doors, positions }: { doors: DoorBook; positions: Map<string, THREE.Vector3> }) {
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    if (doors.ids.length === 0) return;
    const people: { x: number; z: number }[] = [...positions.values()];
    if (useUi.getState().camera === 'first_person') people.push(camera.position);
    doors.tick(Math.min(dt, 0.1), Date.now(), people);
  });
  return null;
}
