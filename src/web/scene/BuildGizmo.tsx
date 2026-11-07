import { useMemo, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { beginDrag } from './interaction/DragLayer';
import type { OfficeLayout, PlacedItem } from '@shared/domain';
import { POS_STEP } from '@shared/domain';
import { footprintRect, isEdge, sizeM, snap } from '@shared/catalog';
import { insideFloor, validateLayout } from '@shared/layout-validation';
import { useBuild } from '../state/build';
import { floorToWorld } from './furniture/Furniture';

// Arrange mode overlay (001 T102, reworked for 002 US2): the palette ghost follows the pointer in
// 0.05 m steps (Shift: 0.5 m; walls always 0.5 m) and a click places it; the selected item gets an
// outline; while dragging, a ghost shows the drop (green = valid, red = not) and the desk under a dragged
// employee lights up (green = free, amber = occupied → swap). Dragging itself lives in DragLayer.

function ghostValid(layout: OfficeLayout, ghost: PlacedItem): boolean {
  if (!insideFloor(layout, ghost)) return false;
  const v = validateLayout({ ...layout, items: [...layout.items, ghost] });
  return !v.invalidItems.includes(ghost.id) && !v.reasons['__door__'];
}

export function BuildGizmo({ layout }: { layout: OfficeLayout }) {
  const { palette, rotation, place, selectedId, drag, select, resizeBlockers } = useBuild();
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const { width: w, depth: d } = layout.floor;

  const posAt = (e: ThreeEvent<PointerEvent | MouseEvent>, type: PlacedItem['type'], rot: PlacedItem['rotation']) => {
    const p = { x: e.point.x + w / 2, z: e.point.z + d / 2 };
    if (isEdge(type)) return { x: snap(p.x - 0.25, 0.5), z: snap(p.z, 0.5) };
    const step = e.nativeEvent.shiftKey ? 0.5 : POS_STEP;
    const s = sizeM(type, rot);
    return { x: snap(p.x - s.w / 2, step), z: snap(p.z - s.d / 2, step) };
  };

  const ghost: PlacedItem | null = useMemo(() => (hover && palette ? { id: '__ghost__', type: palette, pos: hover, rotation } : null), [hover, palette, rotation]);
  const valid = ghost ? ghostValid(layout, ghost) : false;
  const selected = selectedId ? layout.items.find((i) => i.id === selectedId) : undefined;
  const dragged = drag?.kind === 'item' ? layout.items.find((i) => i.id === drag.id) : undefined;
  const targetDesk = drag?.kind === 'employee' && drag.deskId ? layout.items.find((i) => i.id === drag.deskId) : undefined;

  return (
    <group>
      {/* Pointer-catching floor (slightly above the real floor): palette ghost + click to place / deselect. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.01, 0]}
        onPointerMove={(e) => {
          if (palette) setHover(posAt(e, palette, rotation));
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          // Place from the click position itself, not from the hover ghost: on a slow frame the click can
          // arrive before the ghost has been drawn.
          if (palette) {
            const pos = posAt(e, palette, rotation);
            const g: PlacedItem = { id: '__ghost__', type: palette, pos, rotation };
            if (ghostValid(layout, g)) place({ type: g.type, pos, rotation: g.rotation });
          } else if (!drag) select(null); // click on empty floor deselects (U-3)
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.max(w, d) * 2, '#7c8db5', '#b8c2d6']} position={[0, 0.005, 0]} />
      {ghost && <GhostBox item={ghost} layout={layout} color={valid ? 'ok' : 'bad'} />}
      {selected && !dragged && <GhostBox item={selected} layout={layout} color="ok" outline />}
      {dragged && drag && <GhostBox item={{ ...dragged, pos: drag.pos }} layout={layout} color={drag.valid ? 'ok' : 'bad'} />}
      {targetDesk && <GhostBox item={targetDesk} layout={layout} color={drag?.occupied ? 'swap' : 'ok'} />}
      {/* US4 / U-4: edge handles (east, south) resize the office in 0.5 m steps. */}
      {(['east', 'south'] as const).map((side) => {
        const at = side === 'east' ? { x: w, z: d / 2 } : { x: w / 2, z: d };
        return (
          <mesh
            key={side}
            name={`resize-handle-${side}`}
            position={floorToWorld(layout.floor, at.x, at.z).map((v, i) => (i === 1 ? 0.15 : v)) as [number, number, number]}
            rotation-y={side === 'east' ? Math.PI / 2 : 0}
            onPointerDown={(e) => {
              e.stopPropagation();
              beginDrag('handle', side, at, e.nativeEvent);
            }}
            onPointerOver={() => (document.body.style.cursor = side === 'east' ? 'ew-resize' : 'ns-resize')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <boxGeometry args={[1.2, 0.3, 0.3]} />
            <meshBasicMaterial color={drag?.kind === 'handle' && drag.id === side ? '#2f6fed' : '#5b7db1'} />
          </mesh>
        );
      })}
      {drag?.kind === 'handle' && drag.size && (
        <group>
          <mesh position={floorToWorld(layout.floor, drag.size.width / 2, drag.size.depth / 2).map((v, i) => (i === 1 ? 0.02 : v)) as [number, number, number]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[drag.size.width, drag.size.depth]} />
            <meshBasicMaterial color={drag.valid ? COLORS.ok : COLORS.bad} transparent opacity={0.18} depthWrite={false} />
          </mesh>
          <Html position={floorToWorld(layout.floor, drag.size.width / 2, drag.size.depth / 2).map((v, i) => (i === 1 ? 1.5 : v)) as [number, number, number]} center>
            <div className="size-label">
              {String(drag.size.width).replace('.', ',')} × {String(drag.size.depth).replace('.', ',')} m
            </div>
          </Html>
        </group>
      )}
      {resizeBlockers.map((id) => {
        const it = layout.items.find((i) => i.id === id);
        return it ? <GhostBox key={id} item={it} layout={layout} color="bad" /> : null;
      })}
      {drag?.kind === 'employee' && (
        <mesh position={floorToWorld(layout.floor, drag.pos.x, drag.pos.z).map((v, i) => (i === 1 ? 0.75 : v)) as [number, number, number]}>
          <capsuleGeometry args={[0.22, 1.0, 6, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

const COLORS = { ok: '#2ec4b6', bad: '#d64545', swap: '#e0a21b' } as const;

function GhostBox({ item, layout, color, outline = false }: { item: PlacedItem; layout: OfficeLayout; color: keyof typeof COLORS; outline?: boolean }) {
  const r = footprintRect(item);
  const edge = isEdge(item.type);
  const w = Math.max(r.x1 - r.x0, edge ? 0.1 : 0);
  const d = Math.max(r.z1 - r.z0, edge ? 0.1 : 0);
  const [x, , z] = floorToWorld(layout.floor, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
  return (
    <mesh position={[x, 0.6, z]}>
      <boxGeometry args={[w * 0.98 + (outline ? 0.06 : 0), 1.2, d * 0.98 + (outline ? 0.06 : 0)]} />
      <meshBasicMaterial color={COLORS[color]} transparent opacity={outline ? 0.18 : 0.35} depthWrite={false} wireframe={outline} />
    </mesh>
  );
}
