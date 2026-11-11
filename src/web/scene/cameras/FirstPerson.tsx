import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OfficeLayout } from '@shared/domain';
import type { SiteGrid } from '@shared/site-nav';
import { useUi } from '../../state/ui';
import { NO_IDS, useSettings } from '../../state/settings';
import type { Crowd } from '../crowd/crowd';
import { PLAYER, sofaOf, sofaSpots, type SpotBook } from '../break-spots';
import { aimTarget, buildInteractables, doorAction, toggledScreens, type Interactable } from '../interaction/interactables';
import type { DoorBook } from '../doors';
import { EYE_HEIGHT, nearestFree, slide } from './fp-motion';

// T116 / T117 / FR-070, FR-071: walk the office at eye height (WASD/arrows, Shift to hurry), no walking
// through walls or furniture, click the employee under the crosshair (≤ 4 m) to open the chat.
// 004 US4 (R4-07, R4-08): out of the door and around the park (SiteGrid); employees block the way and walk
// around the user (the user is an agent of the Crowd); E (or a click not on an employee) uses the thing
// under the crosshair: wall screen on/off, sit / lie (Shift+E) on the sofa, drink water, water a plant.

const SPEED = 2.2;
const REACH = 4;
const AIM_COS = Math.cos(THREE.MathUtils.degToRad(9));
const EYE_SIT = 1.05;
const EYE_LIE = 0.6;
const EFFECT_MS = 1500;
const FRESH_MS = 60_000;

/** For window.__agentOffice (dev / webdriver only, U4-4). */
export const fpControl: {
  state?: () => { x: number; z: number; pose: 'standing' | 'sit' | 'lie'; aim: { itemId: string; action: string } | null };
  teleport?: (x: number, z: number, yaw: number, pitch?: number) => void;
} = {};

export function FirstPersonCamera({
  site,
  positions,
  layout,
  crowd,
  spots,
  doors,
}: {
  site: SiteGrid;
  positions: Map<string, THREE.Vector3>;
  layout: OfficeLayout;
  crowd?: Crowd;
  spots?: SpotBook;
  /** 008: office doors — `E` toggles them, a closed one blocks the way. */
  doors?: DoorBook;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const controls = useRef<React.ElementRef<typeof PointerLockControls>>(null);
  const sensitivity = useSettings((s) => s.settings.mouseSensitivity ?? 1); // 006 US5
  const keys = useRef(new Set<string>());
  const openConversation = useUi((s) => s.openConversation);
  const chatOpen = useUi((s) => !!s.openConversationId);
  const screensOff = useSettings((s) => s.settings.screensOff) ?? NO_IDS;
  const items = useMemo(() => buildInteractables(layout, screensOff), [layout, screensOff]);
  const aim = useRef<Interactable | null>(null);
  /** Where the user sits / lies (camera fixed there), or null when standing. */
  const resting = useRef<{ ids: string[]; x: number; z: number; pose: 'sit' | 'lie' } | null>(null);

  // Start just inside the door, looking into the office.
  useEffect(() => {
    const { lobby } = site.entrance();
    const [x, , z] = site.toWorld(lobby);
    camera.position.set(x, EYE_HEIGHT, z);
    camera.lookAt(x, EYE_HEIGHT, z - 5);
  }, [camera, site]);

  // Leave the crowd, the sofa and the hint behind when first person ends.
  useEffect(
    () => () => {
      crowd?.remove(PLAYER);
      spots?.release(PLAYER);
      useUi.getState().setFpAim(null);
      useUi.getState().setPlayerPose('standing');
    },
    [crowd, spots],
  );

  function standUp() {
    const r = resting.current;
    if (!r) return;
    spots?.release(PLAYER);
    resting.current = null;
    // A spot the body fits in, else slide() rejects every step and the user is stuck by the sofa.
    const p = nearestFree(site, r.x, r.z, 1.5, (x, z) => site.isIndoorAt(x, z)) ?? site.nearestWalkable(r.x, r.z) ?? { x: camera.position.x, z: camera.position.z };
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    useUi.getState().setPlayerPose('standing');
  }

  function useSofa(itemId: string, lie: boolean) {
    const seats = sofaSpots(layout).filter((s) => sofaOf(s.id) === itemId);
    if (!seats.length) return;
    let ids: string[];
    let at: { x: number; z: number; facing: number };
    if (lie) {
      if (seats.length < 2) return;
      ids = seats.map((s) => s.id);
      at = { x: (seats[0]!.x + seats[1]!.x) / 2, z: (seats[0]!.z + seats[1]!.z) / 2, facing: seats[0]!.facing };
    } else {
      // The free seat nearest to the user.
      const free = seats.filter((s) => spots?.isFree(s.id) ?? true).sort((a, b) => Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z));
      if (!free[0]) return;
      ids = [free[0].id];
      at = free[0];
    }
    if (spots && !spots.reserve(PLAYER, ...ids)) return; // an employee is there (FR-032)
    resting.current = { ids, x: at.x, z: at.z, pose: lie ? 'lie' : 'sit' };
    const y = lie ? EYE_LIE : EYE_SIT;
    camera.position.set(at.x, y, at.z);
    camera.lookAt(at.x + Math.sin(at.facing) * 3, lie ? y + 0.6 : y, at.z + Math.cos(at.facing) * 3);
    useUi.getState().setPlayerPose({ spotId: ids[0]!, pose: lie ? 'lie' : 'sit' });
  }

  function interact(it: Interactable, lie: boolean) {
    const ui = useUi.getState();
    const now = Date.now();
    if (it.type === 'wall_screen') {
      const cur = useSettings.getState().settings.screensOff ?? [];
      useSettings.getState().update({ screensOff: toggledScreens(cur, it.itemId, layout) });
    } else if (it.type === 'sofa') useSofa(it.itemId, lie);
    else if (it.type === 'water_cooler') ui.setFpEffect({ kind: 'water', until: now + EFFECT_MS });
    else if (it.type === 'office_door') doors?.toggleUser(it.itemId);
    else if (it.type === 'plant') {
      ui.waterPlant(it.itemId, now + FRESH_MS);
      ui.setFpEffect({ kind: 'plant', until: now + EFFECT_MS });
    }
  }

  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      keys.current.add(e.code);
      if (e.code !== 'KeyE' || e.repeat || useUi.getState().openConversationId) return;
      if (resting.current) return standUp();
      if (aim.current) interact(aim.current, e.shiftKey);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  // Typing in the chat must not move the camera; leave pointer lock when the chat opens.
  useEffect(() => {
    if (chatOpen) controls.current?.unlock();
  }, [chatOpen]);

  // Test hooks (U4-4).
  useEffect(() => {
    fpControl.state = () => ({
      x: camera.position.x,
      z: camera.position.z,
      pose: resting.current?.pose ?? 'standing',
      aim: aim.current ? { itemId: aim.current.itemId, action: aim.current.action } : null,
    });
    fpControl.teleport = (x, z, yaw, pitch = 0) => {
      resting.current = null;
      spots?.release(PLAYER);
      useUi.getState().setPlayerPose('standing');
      camera.position.set(x, EYE_HEIGHT, z);
      const c = Math.cos(pitch);
      camera.lookAt(x + Math.sin(yaw) * c * 5, EYE_HEIGHT + Math.sin(pitch) * 5, z + Math.cos(yaw) * c * 5);
    };
    return () => {
      fpControl.state = undefined;
      fpControl.teleport = undefined;
    };
  }, [camera, spots]);

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    if (chatOpen) return;
    const k = keys.current;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (resting.current && (f || s)) standUp();
    if (!resting.current && (f || s)) {
      camera.getWorldDirection(fwd.current);
      fwd.current.y = 0;
      fwd.current.normalize();
      right.current.crossVectors(fwd.current, camera.up).normalize();
      const speed = SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 1.8 : 1) * Math.min(dt, 0.1);
      const dx = (fwd.current.x * f + right.current.x * s) * speed;
      const dz = (fwd.current.z * f + right.current.z * s) * speed;
      const next = slide(site, camera.position.x, camera.position.z, dx, dz, positions.values(), doors ? (x0, z0, x1, z1) => doors.blocksMove(x0, z0, x1, z1) : undefined);
      camera.position.set(next.x, EYE_HEIGHT, next.z);
    }
    // The user is a person in the crowd: employees give way and walk around (R4-07).
    if (crowd && !resting.current) crowd.place(PLAYER, camera.position.x, camera.position.z, { seated: false, priority: 9 });
    // What the crosshair is on (FR-030); the store only changes when the target does.
    camera.getWorldDirection(look.current);
    const target = resting.current ? null : aimTarget(camera.position, look.current, items);
    // 008: a door's hint follows its live state.
    const hit = target?.type === 'office_door' && doors ? { ...target, action: doorAction(doors.isOpen(target.itemId) || doors.isUserOpen(target.itemId)) } : target;
    aim.current = hit;
    const cur = useUi.getState().fpAim;
    if ((hit?.itemId ?? null) !== (cur?.itemId ?? null) || (hit && hit.action !== cur?.action)) useUi.getState().setFpAim(hit ? { itemId: hit.itemId, action: hit.action } : null);
  });

  // Click: the employee closest to the crosshair direction within reach (T117) wins; else use the item.
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
      else if (resting.current) standUp();
      else if (aim.current) interact(aim.current, false);
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  });

  return <PointerLockControls ref={controls} makeDefault pointerSpeed={sensitivity} />;
}

export function Crosshair() {
  return <div className="crosshair" aria-hidden />;
}

/** 004 U4-3: "E — <action>" under the crosshair, and the short water / plant effect. */
export function FirstPersonHint() {
  const aim = useUi((s) => s.fpAim);
  const pose = useUi((s) => s.playerPose);
  const effect = useUi((s) => s.fpEffect);
  const setEffect = useUi((s) => s.setFpEffect);
  useEffect(() => {
    if (!effect) return;
    const id = setTimeout(() => setEffect(null), Math.max(0, effect.until - Date.now()));
    return () => clearTimeout(id);
  }, [effect, setEffect]);
  const text = pose !== 'standing' ? 'E / W — Stand up' : aim ? `E — ${aim.action}` : null;
  return (
    <>
      {text && (
        <div className="fp-hint" data-testid="fp-hint">
          {text}
        </div>
      )}
      {effect && (
        <div className={`fp-effect fp-effect-${effect.kind}`} aria-hidden>
          {effect.kind === 'water' ? '🥤' : '💧'}
        </div>
      )}
    </>
  );
}
