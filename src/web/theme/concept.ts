import * as THREE from 'three';

// 002 US6 / T067: 3D tokens of the chosen concept E+ "Soft Studio · Sài Gòn"
// (specs/002-realistic-ui-refresh/concept-decision.md): rounded furniture as in E, light and colours of
// D, the light-oak floor of A. Textures are generated in code — no third-party files.

export const CONCEPT = {
  rounded: 0.06,
  floor: { a: '#dcc09a', b: '#cfae82', seam: '#b9966b', dark: { a: '#6e5a44', b: '#625039', seam: '#4c3e2d' } },
  wall: { a: '#eadcbc', b: '#dfcea9', dark: '#4a4234' },
  frame: '#fffaf0',
  plinth: '#efe4cc',
  glass: '#eef6f6',
  deskTop: '#fffaf0',
  deskLeg: '#1f6f6a',
  monitor: '#2a2622',
  screenOn: '#ffe9b8',
  chair: '#c99a5b',
  chairFrame: '#fffaf0',
  fabric: '#1f6f6a',
  sofa: '#c2603a',
  plant: '#2f7a45',
  pot: '#c2603a',
  cooler: '#e7dcc4',
  water: '#7fc8e8',
  doorMat: '#8a5a35',
  light: {
    day: { sky: '#bfe0ec', ground: '#d9c79f', sun: '#fff0c8', sunI: 2.4, hemiI: 0.75, ambI: 0.25, env: 0.4 },
    night: { sky: '#3a4a6a', ground: '#1a1a22', sun: '#9fb3e0', sunI: 0.35, hemiI: 0.3, ambI: 0.12, env: 0.15, interior: '#ffc977' },
  },
  exposure: 1.0,
} as const;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, THREE.CanvasTexture>();

/** Light-oak plank floor (concept A), one texture tile ≈ 2 × 2 m. */
export function woodFloorTexture(dark: boolean): THREE.CanvasTexture {
  const key = `wood-${dark}`;
  if (cache.has(key)) return cache.get(key)!;
  const col = dark ? CONCEPT.floor.dark : CONCEPT.floor;
  const r = seeded(11);
  const t = canvasTexture(
    512,
    512,
    (g, w, h) => {
      const rows = 8;
      const rh = h / rows;
      for (let row = 0; row < rows; row++) {
        let x = -r() * 200;
        while (x < w) {
          const len = 160 + r() * 220;
          g.fillStyle = new THREE.Color(col.a).lerp(new THREE.Color(col.b), r()).getStyle();
          g.fillRect(x, row * rh, len, rh);
          g.strokeStyle = 'rgba(80,50,20,.08)';
          for (let k = 0; k < 6; k++) {
            const y = row * rh + r() * rh;
            g.beginPath();
            g.moveTo(x, y);
            g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.7, y + (r() - 0.5) * 6, x + len, y);
            g.stroke();
          }
          g.fillStyle = col.seam;
          g.fillRect(x + len - 1, row * rh, 2, rh);
          x += len;
        }
        g.fillStyle = col.seam;
        g.fillRect(0, row * rh, w, 2);
      }
    },
    [1, 1],
  );
  cache.set(key, t);
  return t;
}

/** Cream lime-wash wall (concept D). */
export function limewashTexture(): THREE.CanvasTexture {
  if (cache.has('lime')) return cache.get('lime')!;
  const r = seeded(5);
  const t = canvasTexture(
    512,
    256,
    (g, w, h) => {
      g.fillStyle = CONCEPT.wall.a;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        g.globalAlpha = 0.08;
        g.fillStyle = r() < 0.5 ? CONCEPT.wall.b : '#fffaf0';
        g.beginPath();
        g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    },
    [1, 1],
  );
  cache.set('lime', t);
  return t;
}

/**
 * 007 US5: default pictures for frames, drawn in code (no third-party files). `painting`: a soft Sài Gòn-ish
 * landscape (sky, sun, hills, river); `photo`: a pastel abstract with a little palm.
 */
export function defaultPictureTexture(kind: 'painting' | 'photo'): THREE.CanvasTexture {
  const key = `picture-${kind}`;
  if (cache.has(key)) return cache.get(key)!;
  const t = canvasTexture(
    kind === 'painting' ? 384 : 256,
    256,
    (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, kind === 'painting' ? '#f6c98f' : '#cfe7e4');
      sky.addColorStop(1, kind === 'painting' ? '#f3e3c3' : '#f6eee0');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      g.fillStyle = kind === 'painting' ? '#e8774a' : '#f2a65a';
      g.beginPath();
      g.arc(w * 0.7, h * 0.35, h * 0.13, 0, Math.PI * 2);
      g.fill();
      if (kind === 'painting') {
        g.fillStyle = '#5f9a6e';
        g.beginPath();
        g.moveTo(0, h * 0.7);
        g.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.68);
        g.quadraticCurveTo(w * 0.8, h * 0.55, w, h * 0.66);
        g.lineTo(w, h);
        g.lineTo(0, h);
        g.fill();
        g.fillStyle = '#4c8fa3';
        g.fillRect(0, h * 0.82, w, h * 0.18);
      } else {
        g.strokeStyle = '#3f7d5a';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(w * 0.35, h);
        g.quadraticCurveTo(w * 0.38, h * 0.6, w * 0.3, h * 0.4);
        g.stroke();
        g.fillStyle = '#4f9a64';
        for (const a of [-1.1, -0.4, 0.3, 1.0]) {
          g.beginPath();
          g.ellipse(w * 0.3 + Math.cos(a) * 30, h * 0.4 + Math.sin(a) * 12, 34, 9, a, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
    [1, 1],
  );
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
