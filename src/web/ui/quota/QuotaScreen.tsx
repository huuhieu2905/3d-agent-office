import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { OfficeLayout, Quota } from '@shared/domain';
import { itemTransform } from '../../scene/furniture/Furniture';
import { useQuota } from '../../state/quota';

// T091 / FR-040 / FR-043: the wall screen shows quota bars (canvas texture); one click opens QuotaPanel.

const W = 512;
const H = 288;

function shortLabel(q: Quota['groups'][number]): string {
  const first = q.models[0]?.label ?? '';
  const base = first.replace(/\s*\((Low|Medium|High)\)\s*$/i, '');
  return q.models.length > 1 ? `${base} (+${q.models.length - 1})` : base;
}

export function drawQuota(ctx: CanvasRenderingContext2D, quota: Quota | null): void {
  ctx.fillStyle = '#16211f';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f1e8d8';
  ctx.font = "700 28px 'Baloo 2 Variable', sans-serif";
  ctx.fillText('Quota', 20, 40);
  if (!quota) {
    ctx.font = "20px 'Nunito Variable', sans-serif";
    ctx.fillStyle = '#a49a8b';
    ctx.fillText('Đang tải…', 20, 90);
    return;
  }
  ctx.font = "18px 'Nunito Variable', sans-serif";
  ctx.fillStyle = '#a49a8b';
  ctx.fillText(quota.planName, 120, 40);
  const groups = quota.groups.slice(0, 5);
  groups.forEach((g, i) => {
    const y = 70 + i * 42;
    ctx.fillStyle = '#e4d9c4';
    ctx.font = "600 16px 'Nunito Variable', sans-serif";
    ctx.fillText(shortLabel(g).slice(0, 26), 20, y + 14);
    const x = 270;
    const bw = 170;
    ctx.fillStyle = '#2c3534';
    ctx.fillRect(x, y, bw, 18);
    ctx.fillStyle = g.low ? '#d1453b' : g.remainingPercent < 30 ? '#e0a21b' : '#5fb3a9';
    ctx.fillRect(x, y, (bw * Math.max(0, Math.min(100, g.remainingPercent))) / 100, 18);
    ctx.fillStyle = '#f1e8d8';
    ctx.fillText(`${Math.round(g.remainingPercent)}%`, x + bw + 10, y + 15);
  });
  if (quota.groups.some((g) => g.low)) {
    ctx.fillStyle = '#d1453b';
    ctx.font = "700 18px 'Nunito Variable', sans-serif";
    ctx.fillText('⚠ Có nhóm model sắp hết quota', 20, H - 16);
  }
}

// 002 US6: the wall screen uses the concept E+ palette and fonts (dark teal panel).
export function QuotaScreen({ layout }: { layout: OfficeLayout }) {
  const quota = useQuota((s) => s.quota);
  const setOpen = useQuota((s) => s.setPanelOpen);
  const screen = layout.items.find((i) => i.type === 'wall_screen');
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture };
  }, []);
  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      drawQuota(ctx, quota);
      texture.needsUpdate = true;
    };
    draw();
    // Redraw once the bundled concept fonts are ready (canvas text does not swap fonts by itself).
    let alive = true;
    void document.fonts?.ready.then(() => alive && draw());
    return () => {
      alive = false;
    };
  }, [quota, canvas, texture]);
  useEffect(() => () => texture.dispose(), [texture]);

  if (!screen) return null;
  const t = itemTransform(screen, layout.floor);
  return (
    <group position={t.position} rotation-y={t.rotationY}>
      <mesh
        position={[0, 1.6, 0.03]}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[1.32, 0.74]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
