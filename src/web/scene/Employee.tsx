import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Employee as EmployeeT, OfficeLayout, VisualState } from '@shared/domain';
import type { Crowd } from './crowd/crowd';
import { kickNearest } from './furniture/PropJiggle';
import { instantiate, play, ROBOT_URL, setFace, type Clip } from './character';
import { EmployeeBrain } from './employee-behaviors';
import type { OfficeGrid } from './grid/grid';
import { useUi } from '../state/ui';
import { beginDrag } from './interaction/DragLayer';
import { useBuild } from '../state/build';

// One employee (FR-010/011/020): animated robot at its desk, name tag with project colour, status badge,
// one click opens the conversation.

const BADGE: Partial<Record<VisualState, { icon: string; cls: string; label: string }>> = {
  thinking: { icon: '…', cls: 'thinking', label: 'Đang suy nghĩ' },
  working: { icon: '⌨', cls: 'working', label: 'Đang làm việc' },
  waiting_for_boss: { icon: '!', cls: 'waiting', label: 'Chờ sếp duyệt' },
  error: { icon: '✕', cls: 'error', label: 'Gặp lỗi' },
  stopped: { icon: '■', cls: 'stopped', label: 'Đã dừng' },
  unknown: { icon: '?', cls: 'unknown', label: 'Không rõ trạng thái' },
};

const SEAT_DROP = 0.32; // lower the robot onto the chair when seated

/** ?debug=crowd (dev only): breaks every ~20 s so crowd behaviour can be watched (T047). */
function debugBreaks(): { breakMeanMs?: number; breakJitterMs?: number } {
  if (typeof location === 'undefined') return {};
  const q = new URLSearchParams(location.search);
  const crowdBench = location.pathname.startsWith('/bench') && q.get('scenario') === 'crowd';
  const debug = !!import.meta.env?.DEV && q.get('debug') === 'crowd';
  return crowdBench || debug ? { breakMeanMs: 20_000, breakJitterMs: 10_000 } : {};
}

export interface EmployeeProps {
  /** Shared crowd of this office (US3): no overlaps, giving way, bump reactions. */
  crowd?: Crowd;
  /** Layout, to find the prop an employee bumped into (US3 T046). */
  layout?: OfficeLayout;
  employee: EmployeeT;
  grid: OfficeGrid;
  enter: boolean;
  leaving: boolean;
  lobbySlot: number;
  dimmed: boolean;
  onLeft(id: string): void;
  positions: Map<string, THREE.Vector3>;
}

export function Employee({ employee, grid, enter, leaving, lobbySlot, dimmed, onLeft, positions, crowd, layout }: EmployeeProps) {
  const gltf = useGLTF(ROBOT_URL, false); // false: never load the DRACO decoder from a CDN (FR-082)
  const character = useMemo(() => instantiate(gltf, employee.appearance), [gltf, employee.appearance]);
  useEffect(() => () => character.dispose(), [character]);

  const seat = employee.deskId ? grid.seatOf(employee.deskId) : null;
  const brain = useMemo(
    () => new EmployeeBrain({ grid, seat, enter, lobbySlot, crowd, id: employee.conversationId, ...debugBreaks() }),
    // The brain survives desk/state changes; it is recreated only if the office grid changes.
    [grid],
  );
  useEffect(() => () => brain.dispose(), [brain]);
  useEffect(() => brain.setSeat(seat), [brain, seat?.x, seat?.z]);
  useEffect(() => brain.setVisual(employee.visualState), [brain, employee.visualState]);
  useEffect(() => {
    if (leaving) brain.leave();
  }, [brain, leaving]);

  const group = useRef<THREE.Group>(null);
  const clipRef = useRef<Clip | null>(null);
  const t = useRef(0);
  const lastBump = useRef(0);
  const [hover, setHover] = useState(false);
  const openConversation = useUi((s) => s.openConversation);
  const arranging = useBuild((s) => s.active);
  const firstPerson = useUi((s) => s.camera === 'first_person');

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    const pose = brain.tick(d);
    if (brain.done) {
      onLeft(employee.conversationId);
      return;
    }
    if (pose.clip !== clipRef.current) {
      play(character, pose.clip, 0.35);
      clipRef.current = pose.clip;
    }
    t.current += d;
    const g = group.current;
    if (g) {
      let y = pose.seated ? -SEAT_DROP : 0;
      // Working: quick typing bounce; thinking: slow sway.
      if (pose.seated && employee.visualState === 'working') y += Math.abs(Math.sin(t.current * 14)) * 0.015;
      // Seated robots sit slightly forward so the chair back stays behind them.
      const fwd = pose.seated ? 0.14 : 0;
      g.position.set(pose.x + Math.sin(pose.heading) * fwd, y, pose.z + Math.cos(pose.heading) * fwd);
      const sway = pose.seated && employee.visualState === 'thinking' ? Math.sin(t.current * 1.5) * 0.12 : 0;
      g.rotation.y = pose.heading + sway;
      // Bump reaction (FR-018): stop, lean back and look towards what was bumped, then carry on. The
      // status badge and face for real states are untouched (FR-020).
      const r = pose.reaction;
      if (r) {
        const k = Math.sin(Math.PI * r.t);
        let turn = r.towards - pose.heading;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        g.rotation.y = pose.heading + turn * 0.6 * k;
        g.rotation.x = -0.14 * k;
        if (r.seq !== lastBump.current) {
          lastBump.current = r.seq;
          if (r.kind === 'bump_object' && layout)
            kickNearest(layout, r.x + layout.floor.width / 2, r.z + layout.floor.depth / 2, pose.x + layout.floor.width / 2, pose.z + layout.floor.depth / 2);
          if (employee.visualState === 'idle' || employee.visualState === 'working' || employee.visualState === 'thinking') setFace(character, 'Surprised');
        }
      } else if (g.rotation.x !== 0) {
        g.rotation.x = 0;
        setFace(character, employee.visualState === 'error' ? 'Sad' : employee.visualState === 'waiting_for_boss' ? 'Surprised' : 'neutral');
      }
      positions.set(employee.conversationId, g.position);
    }
    character.mixer.update(employee.visualState === 'disconnected' ? 0 : d);
  });

  useEffect(() => {
    const face =
      employee.visualState === 'error' ? 'Sad' : employee.visualState === 'waiting_for_boss' ? 'Surprised' : 'neutral';
    setFace(character, face);
  }, [character, employee.visualState]);

  useEffect(() => () => void positions.delete(employee.conversationId), [positions, employee.conversationId]);

  const badge = BADGE[employee.visualState];
  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        // Arrange mode: a press starts a drag, never opens the chat (002 U-1).
        if (!arranging) openConversation(employee.conversationId);
      }}
      onPointerDown={
        arranging
          ? (e) => {
              e.stopPropagation();
              const g = group.current;
              beginDrag('employee', employee.conversationId, { x: g?.position.x ?? 0, z: g?.position.z ?? 0 }, e.nativeEvent);
            }
          : undefined
      }
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <primitive object={character.root} />
      {/* Generous invisible hit box so one click always lands (SC-003). */}
      <mesh position={[0, 0.7, 0]} visible={false}>
        <boxGeometry args={[0.8, 1.5, 0.8]} />
      </mesh>
      <Html
        position={[0, 1.65, 0]}
        center
        // Overview: tags scale with distance. First person: fixed size, otherwise tags fill the screen up close.
        distanceFactor={firstPerson ? undefined : 9}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className={`tag ${dimmed ? 'tag-dim' : ''} ${hover ? 'tag-hover' : ''} ${firstPerson ? 'tag-fp' : ''}`}>
          <span className="tag-dot" style={{ background: employee.projectColor }} />
          <span className="tag-name">{employee.name}</span>
          {badge && (
            <span className={`tag-badge badge-${badge.cls}`} title={badge.label} aria-label={badge.label}>
              {badge.icon}
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

useGLTF.preload(ROBOT_URL, false);
