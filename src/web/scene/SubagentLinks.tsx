import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Employee } from '@shared/domain';

// T057: a thin line from each visible subagent to its parent employee (positions are updated every frame).

export function SubagentLinks({ employees, positions }: { employees: Employee[]; positions: Map<string, THREE.Vector3> }) {
  const pairs = employees.filter((e) => e.isSubagent && e.parentId && employees.some((p) => p.conversationId === e.parentId));
  const geom = useRef(new THREE.BufferGeometry());
  const buf = useRef(new Float32Array(0));

  useFrame(() => {
    if (buf.current.length !== pairs.length * 6) {
      buf.current = new Float32Array(pairs.length * 6);
      geom.current.setAttribute('position', new THREE.BufferAttribute(buf.current, 3));
    }
    pairs.forEach((e, i) => {
      const a = positions.get(e.conversationId);
      const b = positions.get(e.parentId!);
      const o = i * 6;
      if (!a || !b) return;
      buf.current.set([a.x, 1.0, a.z, b.x, 1.0, b.z], o);
    });
    const attr = geom.current.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (attr) attr.needsUpdate = true;
  });

  if (pairs.length === 0) return null;
  return (
    <lineSegments geometry={geom.current}>
      <lineBasicMaterial color="#7c8db5" transparent opacity={0.6} />
    </lineSegments>
  );
}

/** Subagents without a desk are folded into a counter badge on their parent. */
export function subagentOverflow(employees: Employee[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of employees) if (e.isSubagent && e.parentId && !e.deskId) m.set(e.parentId, (m.get(e.parentId) ?? 0) + 1);
  return m;
}
