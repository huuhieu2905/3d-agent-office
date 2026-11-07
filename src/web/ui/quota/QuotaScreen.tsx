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
  ctx.fillStyle = '#0f1724';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e6edf7';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('Quota', 20, 40);
  if (!quota) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#9aa5b1';
    ctx.fillText('Đang tải…', 20, 90);
    return;
  }
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#9aa5b1';
  ctx.fillText(quota.planName, 120, 40);
  const groups = quota.groups.slice(0, 5);
  groups.forEach((g, i) => {
    const y = 70 + i * 42;
    ctx.fillStyle = '#c9d4e3';
    ctx.font = '16px sans-serif';
    ctx.fillText(shortLabel(g).slice(0, 26), 20, y + 14);
    const x = 270;
    const bw = 170;
    ctx.fillStyle = '#26324a';
    ctx.fillRect(x, y, bw, 18);
    ctx.fillStyle = g.low ? '#d64545' : g.remainingPercent < 30 ? '#f3a712' : '#2ec4b6';
    ctx.fillRect(x, y, (bw * Math.max(0, Math.min(100, g.remainingPercent))) / 100, 18);
    ctx.fillStyle = '#e6edf7';
    ctx.fillText(`${Math.round(g.remainingPercent)}%`, x + bw + 10, y + 15);
  });
  if (quota.groups.some((g) => g.low)) {
    ctx.fillStyle = '#d64545';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚠ Có nhóm model sắp hết quota', 20, H - 16);
  }
}

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
    drawQuota(ctx, quota);
    texture.needsUpdate = true;
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
