import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingStyle, CityBuilding } from './city-layout';

// 002 US7 / T076 / T086: buildings that look like buildings — windows on every floor, a façade tint per
// building, balconies and shutters on Vietnamese tube houses, glass bands on towers — drawn as ONE merged
// mesh per style (a handful of draw calls for the whole city). Windows light up at night (FR-038).

const TILE = { cols: 4, floors: 4, cellW: 1.6, cellH: 3.2 };

/** A 4 × 4 window tile: white wall (tinted by vertex colour), windows, and a matching night map. */
function facadeTiles(style: BuildingStyle): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const W = 256;
  const H = 256;
  const cw = W / TILE.cols;
  const ch = H / TILE.floors;
  const day = document.createElement('canvas');
  const night = document.createElement('canvas');
  day.width = night.width = W;
  day.height = night.height = H;
  const g = day.getContext('2d')!;
  const n = night.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  n.fillStyle = '#000000';
  n.fillRect(0, 0, W, H);
  let seed = style.length * 97;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let f = 0; f < TILE.floors; f++)
    for (let c = 0; c < TILE.cols; c++) {
      const x = c * cw;
      const y = f * ch;
      let r: [number, number, number, number];
      if (style === 'glass') r = [x + 1, y + 4, cw - 2, ch - 14];
      else if (style === 'tube') r = [x + 14, y + 14, cw - 28, ch - 30];
      else if (style === 'brick') r = [x + 14, y + 12, cw - 28, ch - 24];
      else r = [x + 10, y + 12, cw - 20, ch - 24];
      if (style === 'glass') {
        g.fillStyle = '#d8dde2';
        g.fillRect(x, y + ch - 10, cw, 10);
      }
      if (style === 'brick') {
        g.fillStyle = 'rgba(0,0,0,0.08)';
        for (let yy = y; yy < y + ch; yy += 8) g.fillRect(x, yy, cw, 1);
      }
      const grad = g.createLinearGradient(0, r[1], 0, r[1] + r[3]);
      grad.addColorStop(0, '#5c7685');
      grad.addColorStop(1, '#3c4f5a');
      g.fillStyle = grad;
      if (style === 'pastel') {
        g.beginPath();
        g.roundRect(r[0], r[1], r[2], r[3], 10);
        g.fill();
      } else g.fillRect(...r);
      if (style === 'tube') {
        // Green shutters each side and a balcony rail below the window.
        g.fillStyle = '#2f7a5a';
        g.fillRect(r[0] - 10, r[1], 8, r[3]);
        g.fillRect(r[0] + r[2] + 2, r[1], 8, r[3]);
        g.fillStyle = '#e9e4da';
        g.fillRect(x + 4, y + ch - 8, cw - 8, 4);
      }
      if (style === 'brick' || style === 'shophouse') {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(r[0] - 3, r[1] + r[3], r[2] + 6, 4);
      }
      if (rnd() < 0.45) {
        n.fillStyle = rnd() < 0.7 ? '#ffc777' : '#fff0d4';
        n.fillRect(...r);
      }
    }
  const make = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  return { map: make(day, true), emissive: make(night, true) };
}

/** A box whose side UVs repeat the tile once per 4 × 4 windows, top/bottom mapped to a wall pixel. */
function buildingGeometry(b: CityBuilding): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // Face order: +x, −x, +y, −y, +z, −z (4 vertices each).
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      if (face === 2 || face === 3) {
        uv.setXY(i, 0.01, 0.01); // roof/floor: plain wall colour
        continue;
      }
      const width = face < 2 ? b.d : b.w;
      uv.setXY(i, uv.getX(i) * (width / (TILE.cols * TILE.cellW)), uv.getY(i) * (b.h / (TILE.floors * TILE.cellH)));
    }
  }
  const color = new THREE.Color(b.color);
  const colors = new Float32Array(geo.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.rotateY(b.facing);
  geo.translate(b.x, b.h / 2, b.z);
  return geo;
}

/** Balcony slabs on tube houses (front face only), merged with the same mesh colour. */
function balconyGeometries(b: CityBuilding): THREE.BufferGeometry[] {
  if (b.style !== 'tube') return [];
  const out: THREE.BufferGeometry[] = [];
  const floors = Math.floor(b.h / TILE.cellH);
  for (let f = 1; f < floors; f++) {
    if (b.shop && f === 1) continue;
    const slab = new THREE.BoxGeometry(b.w * 0.8, 0.12, 0.8);
    slab.translate(0, f * TILE.cellH, b.d / 2 + 0.4);
    const rail = new THREE.BoxGeometry(b.w * 0.8, 0.5, 0.04);
    rail.translate(0, f * TILE.cellH + 0.3, b.d / 2 + 0.78);
    for (const g of [slab, rail]) {
      const c = new THREE.Color(g === slab ? '#e9e4da' : '#2f2f2f');
      const colors = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.01, 0.01);
      g.rotateY(b.facing);
      g.translate(b.x, 0, b.z);
      out.push(g);
    }
  }
  return out;
}

export function BuildingKit({ buildings, night }: { buildings: CityBuilding[]; night: boolean }) {
  const groups = useMemo(() => {
    const byStyle = new Map<BuildingStyle, CityBuilding[]>();
    for (const b of buildings) byStyle.set(b.style, [...(byStyle.get(b.style) ?? []), b]);
    return [...byStyle].map(([style, list]) => {
      const parts = list.flatMap((b) => [buildingGeometry(b), ...balconyGeometries(b)]);
      const geometry = mergeGeometries(parts, false)!;
      parts.forEach((p) => p.dispose());
      const { map, emissive } = facadeTiles(style);
      const material = new THREE.MeshStandardMaterial({
        map,
        emissiveMap: emissive,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0,
        vertexColors: true,
        roughness: style === 'glass' ? 0.25 : 0.85,
        metalness: style === 'glass' ? 0.4 : 0,
      });
      return { style, geometry, material };
    });
  }, [buildings]);

  useEffect(() => {
    for (const g of groups) g.material.emissiveIntensity = night ? 1.1 : 0;
  }, [groups, night]);
  useEffect(
    () => () => {
      for (const g of groups) {
        g.geometry.dispose();
        g.material.map?.dispose();
        g.material.emissiveMap?.dispose();
        g.material.dispose();
      }
    },
    [groups],
  );

  return (
    <group>
      {groups.map((g) => (
        <mesh key={g.style} geometry={g.geometry} material={g.material} receiveShadow />
      ))}
    </group>
  );
}
