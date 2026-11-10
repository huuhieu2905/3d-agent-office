import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { CityBuilding } from './city-layout';

// 002 US7 / T077 / FR-037: cafés and restaurants on the street and the park kiosk café — striped
// awning, a sign in the concept's display font, plastic stools and umbrellas (Sài Gòn style), lit
// windows and sign at night. Fictional names only (city-layout.ts).

const STYLE = {
  cafe: { facade: '#1f6f6a', awning: ['#1f6f6a', '#efe4cc'], sign: '#c2603a', ink: '#fff4e0', umbrella: '#1f6f6a' },
  resto: { facade: '#c2603a', awning: ['#d93a2b', '#f6e6c8'], sign: '#f2c14e', ink: '#7a1e14', umbrella: '#c2603a' },
  kiosk: { facade: '#efe4cc', awning: ['#1f6f6a', '#fffaf0'], sign: '#1f6f6a', ink: '#fffaf0', umbrella: '#c2603a' },
  // 004 US3: park grocery and drink / bánh mì carts, same palette (concept "Soft Studio · Sài Gòn").
  grocery: { facade: '#f2c94c', awning: ['#2f80a5', '#fffaf0'], sign: '#2f80a5', ink: '#fffaf0', umbrella: '#2f80a5' },
  cart: { facade: '#9ccfb4', awning: ['#3fae7a', '#fffaf0'], sign: '#c2603a', ink: '#fffaf0', umbrella: '#3fae7a' },
} as const;
type Kind = keyof typeof STYLE;

function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || document.fonts?.status === 'loaded');
  useEffect(() => {
    let alive = true;
    void document.fonts?.load(`700 64px "Baloo 2 Variable"`, 'Coffee').then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

function signTexture(text: string, bg: string, ink: string): { tex: THREE.CanvasTexture; aspect: number } {
  const size = 64;
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = `700 ${size}px "Baloo 2 Variable", sans-serif`;
  const w = Math.ceil(m.measureText(text).width + size);
  const h = Math.round(size * 1.6);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(0, 0, w, h, 28);
  g.fill();
  g.fillStyle = ink;
  g.font = `700 ${size}px "Baloo 2 Variable", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: w / h };
}

function stripes(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect((i * 256) / 8, 0, 256 / 8 + 1, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One shop front. Local frame: +z faces the park, origin at the middle of the front at ground level. */
export function Shop({ kind, name, width, night, umbrellas = true }: { kind: Kind; name: string; width: number; night: boolean; umbrellas?: boolean }) {
  const s = STYLE[kind];
  const fontsReady = useFontsReady();
  // Redrawn once the bundled font is ready (canvas text does not swap fonts by itself).
  const sign = useMemo(() => signTexture(name, s.sign, s.ink), [name, s.sign, s.ink, fontsReady]);
  const awning = useMemo(() => stripes(s.awning[0], s.awning[1]), [s.awning]);
  useEffect(() => () => void (sign.tex.dispose(), awning.dispose()), [sign, awning]);
  const w = Math.min(width - 0.3, 6);
  const signW = Math.min(w * 0.9, 0.62 * sign.aspect);
  const stool = ['#d93a2b', '#2f80c5'];
  return (
    <group>
      <mesh position={[0, 1.65, 0.15]}>
        <boxGeometry args={[w, 3.3, 0.3]} />
        <meshStandardMaterial color={s.facade} roughness={0.6} />
      </mesh>
      <mesh position={[-w * 0.12, 1.25, 0.32]}>
        <boxGeometry args={[w * 0.62, 2, 0.05]} />
        <meshStandardMaterial color={night ? '#3a2a18' : '#a9c4cf'} roughness={0.1} metalness={0.2} emissive={night ? '#ffcf8f' : '#000000'} emissiveIntensity={night ? 1.4 : 0} />
      </mesh>
      <mesh position={[w * 0.32, 1.1, 0.32]}>
        <boxGeometry args={[0.9, 2.2, 0.05]} />
        <meshStandardMaterial color="#5a3b22" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.55, 0.85]} rotation-x={0.32}>
        <boxGeometry args={[w * 0.92, 0.06, 1.3]} />
        <meshStandardMaterial map={awning} roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.05, 0.32]}>
        <planeGeometry args={[signW, signW / sign.aspect]} />
        <meshStandardMaterial map={sign.tex} emissiveMap={sign.tex} emissive={night ? '#ffffff' : '#000000'} emissiveIntensity={night ? 0.9 : 0} transparent />
      </mesh>
      {/* Pavement seating: a low table, plastic stools, an umbrella. */}
      {[-w * 0.28, w * 0.18].map((tx, i) => (
        <group key={i} position={[tx, 0, 1.7]}>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.5, 0.05, 0.5]} />
            <meshStandardMaterial color="#3a7bd5" roughness={0.5} />
          </mesh>
          {[
            [-0.5, 0],
            [0.5, 0],
            [0, 0.5],
          ].map(([dx, dz], j) => (
            <mesh key={j} position={[dx!, 0.13, dz!]}>
              <cylinderGeometry args={[0.15, 0.12, 0.26, 14]} />
              <meshStandardMaterial color={stool[(i + j) % 2]} roughness={0.5} />
            </mesh>
          ))}
          {umbrellas && (
            <>
              <mesh position={[0, 1.1, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 2.2, 6]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 2.25, 0]}>
                <coneGeometry args={[1.1, 0.35, 16]} />
                <meshStandardMaterial color={i ? s.umbrella : '#efe4cc'} roughness={0.8} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

/** Street shops placed on the front of their buildings. */
export function StreetShops({ buildings, night }: { buildings: CityBuilding[]; night: boolean }) {
  return (
    <group>
      {buildings
        .filter((b) => b.shop && b.name)
        .map((b) => {
          // Front face of the building, towards the park.
          const fx = b.x + Math.sin(b.facing) * (b.d / 2);
          const fz = b.z + Math.cos(b.facing) * (b.d / 2);
          return (
            <group key={`${b.x},${b.z}`} position={[fx, 0, fz]} rotation-y={b.facing}>
              <Shop kind={b.shop!} name={b.name!} width={b.w} night={night} />
            </group>
          );
        })}
    </group>
  );
}

/**
 * A park pavilion with the shop front: the kiosk café, and (004 US3) the grocery and the drink / bánh mì
 * carts. A cart stands on two wheels. Same footprint for all (park-layout.ts `parkShops`).
 */
export function Kiosk({
  x,
  z,
  facing,
  name,
  night,
  kind = 'kiosk',
  umbrellas = true,
}: {
  x: number;
  z: number;
  facing: number;
  name: string;
  night: boolean;
  kind?: 'kiosk' | 'grocery' | 'cart';
  umbrellas?: boolean;
}) {
  return (
    <group position={[x, 0, z]} rotation-y={facing}>
      <mesh position={[0, 1.65, -1.3]}>
        <boxGeometry args={[4.2, 3.3, 2.6]} />
        <meshStandardMaterial color={STYLE[kind].facade} roughness={0.8} />
      </mesh>
      {kind === 'cart' &&
        [-1.5, 1.5].map((wx) => (
          <mesh key={wx} position={[wx, 0.32, 0.45]} rotation-y={Math.PI / 2} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.32, 0.32, 0.1, 18]} />
            <meshStandardMaterial color="#3b3b3b" roughness={0.6} />
          </mesh>
        ))}
      <Shop kind={kind} name={name} width={4.3} night={night} umbrellas={umbrellas} />
    </group>
  );
}
