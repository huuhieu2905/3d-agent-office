import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OfficeGrid } from '../grid/grid';
import { useUi } from '../../state/ui';
import { EYE_HEIGHT, slide } from './fp-motion';

// T116 / T117 / FR-070, FR-071: walk the office at eye height (WASD/arrows, Shift to hurry), no walking
// through walls or furniture, click the employee under the crosshair (≤ 4 m) to open the chat.

const SPEED = 2.2;
const REACH = 4;
const AIM_COS = Math.cos(THREE.MathUtils.degToRad(9));

export function FirstPersonCamera({ grid, positions }: { grid: OfficeGrid; positions: Map<string, THREE.Vector3> }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useRef<React.ElementRef<typeof PointerLockControls>>(null);
  const keys = useRef(new Set<string>());
  const openConversation = useUi((s) => s.openConversation);
  const chatOpen = useUi((s) => !!s.openConversationId);

  // Start just inside the door, looking into the office.
  useEffect(() => {
    const { lobby } = grid.entrance();
    const [x, , z] = grid.toWorld(lobby);
    camera.position.set(x, EYE_HEIGHT, z);
    camera.lookAt(x, EYE_HEIGHT, z - 5);
  }, [camera, grid]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Typing in the chat must not move the camera; leave pointer lock when the chat opens.
  useEffect(() => {
    if (chatOpen) controls.current?.unlock();
  }, [chatOpen]);

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    if (chatOpen) return;
    const k = keys.current;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (!f && !s) return;
    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    fwd.current.normalize();
    right.current.crossVectors(fwd.current, camera.up).normalize();
    const speed = SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 1.8 : 1) * Math.min(dt, 0.1);
    const dx = (fwd.current.x * f + right.current.x * s) * speed;
    const dz = (fwd.current.z * f + right.current.z * s) * speed;
    const next = slide(grid, camera.position.x, camera.position.z, dx, dz);
    camera.position.set(next.x, EYE_HEIGHT, next.z);
  });

  // Click: pick the employee closest to the crosshair direction within reach (T117).
  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      if (!controls.current?.isLocked) return;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      let best: { id: string; cos: number } | null = null;
      for (const [id, p] of positions) {
        const to = new THREE.Vector3(p.x - camera.position.x, p.y + 0.7 - camera.position.y, p.z - camera.position.z);
        const dist = to.length();
        if (dist > REACH) continue;
        const cos = to.normalize().dot(dir);
        if (cos > AIM_COS && (!best || cos > best.cos)) best = { id, cos };
      }
      if (best) openConversation(best.id);
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [gl, camera, positions, openConversation]);

  return <PointerLockControls ref={controls} makeDefault />;
}

export function Crosshair() {
  return <div className="crosshair" aria-hidden />;
}
