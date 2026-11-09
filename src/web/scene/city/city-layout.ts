import type { City, DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from '../park/detail';
export { kioskSpot } from '../park/park-layout';

// 002 US7 / T078 / R2-09 (round 3: the city only in the distance). Pure layout of the city around the
// park: a ring of street-front buildings right behind the road (tube houses in Hà Nội and Sài Gòn,
// the city's own kind elsewhere) with two cafés and two restaurants facing the default view (north),
// and a ring of towers further out that leaves room for the landmark. Seeded, so it never flickers.

export type BuildingStyle = 'tube' | 'shophouse' | 'brick' | 'glass' | 'pastel';

export interface CityBuilding {
  x: number;
  z: number;
  /** Rotation about Y so the front faces the park (the centre). */
  facing: number;
  w: number;
  d: number;
  h: number;
  style: BuildingStyle;
  color: string;
  shop?: 'cafe' | 'resto';
  name?: string;
}

/** Where CitySkyline puts the landmark (straight north, beyond the street). */
export const LANDMARK_AT = { x: 0, z: -(ROAD_RADIUS + 34) };
/** Front face of the street-front buildings: road edge + a 2.5 m pavement. */
export const FRONT_RADIUS = ROAD_RADIUS + 2.4 + 2.5;

const STYLE: Record<City, BuildingStyle> = { hanoi: 'tube', hcmc: 'tube', singapore: 'shophouse', tokyo: 'pastel', newyork: 'brick' };
const COLORS: Record<BuildingStyle, string[]> = {
  tube: ['#f2c14e', '#9ccfb4', '#f2a7a0', '#e8e1cf', '#7fb3d5', '#f4d58d', '#c9e4ca', '#f0b07a'],
  shophouse: ['#f6d6c8', '#cfe8e0', '#fbe7b5', '#e3d4f2', '#d8ecc8', '#f9c9b6'],
  pastel: ['#e8e1d6', '#d9d4ca', '#c8ccce', '#efe9df', '#d2c8b8', '#bfc6cc'],
  brick: ['#9a4a35', '#a35a40', '#7a4232', '#9a7a5e', '#86604c'],
  glass: ['#3a5f86', '#5d7fa3', '#8fa6b8', '#c9cfd4', '#2c4a6b'],
};

/** Fictional names in each city's language (no real brands). */
export const SHOP_NAMES: Record<City, { cafe: [string, string]; resto: [string, string]; kiosk: string; grocery: string; sugarcane: string; banhmi: string }> = {
  hanoi: { cafe: ['Cà Phê Gió', 'Cà Phê Phố Cổ'], resto: ['Quán Phở Sớm', 'Bún Chả Hàng Mây'], kiosk: 'Cà Phê Công Viên', grocery: 'Tạp Hoá Cô Lan', sugarcane: 'Nước Mía Hồ Tây', banhmi: 'Bánh Mì Sáng' },
  hcmc: { cafe: ['Cà Phê Vỉa Hè', 'Cà Phê Sữa Đá'], resto: ['Cơm Tấm Cô Ba', 'Hủ Tiếu Đêm'], kiosk: 'Cà Phê Công Viên', grocery: 'Tạp Hoá Bà Tư', sugarcane: 'Nước Mía Siêu Sạch', banhmi: 'Bánh Mì Nóng' },
  singapore: { cafe: ['Kopi Corner', 'Tiong Bahru Brew'], resto: ['Laksa House', 'Hawker 88'], kiosk: 'Park Kopi', grocery: 'Mama Shop', sugarcane: 'Cane Juice', banhmi: 'Kaya Toast' },
  tokyo: { cafe: ['Kissa Hoshi', 'Café Sakura'], resto: ['Ramen Kaze', 'Izakaya Tsuki'], kiosk: 'Kōen Café', grocery: 'Konbini Mori', sugarcane: 'Ocha Stand', banhmi: 'Onigiri Ya' },
  newyork: { cafe: ['Corner Roast', 'Bean & Bagel'], resto: ['Liberty Diner', "Tony's Slice"], kiosk: 'Park Coffee Cart', grocery: 'Corner Bodega', sugarcane: 'Lemonade Stand', banhmi: 'Pretzel Cart' },
};

const SEED: Record<City, number> = { hanoi: 11, hcmc: 23, singapore: 37, tokyo: 41, newyork: 53 };

export function cityLayout(city: City, detail: DetailLevel): { front: CityBuilding[]; back: CityBuilding[] } {
  const r = rng(SEED[city] * 7 + 1);
  const style = STYLE[city];
  const colors = COLORS[style];
  const narrow = style === 'tube';
  const front: CityBuilding[] = [];
  // March round the ring by arc length at the front face.
  let arc = r() * 3;
  const circumference = 2 * Math.PI * FRONT_RADIUS;
  while (arc < circumference - 8) {
    const w = narrow ? 3.6 + r() * 1.0 : 6 + r() * 3;
    const d = narrow ? 9 : 8;
    const a = (arc + w / 2) / FRONT_RADIUS - Math.PI; // start south-west, go round
    const rc = FRONT_RADIUS + d / 2;
    const h = narrow ? 8 + r() * 7 : style === 'brick' ? 12 + r() * 14 : 9 + r() * 8;
    front.push({ x: Math.cos(a) * rc, z: Math.sin(a) * rc, facing: Math.atan2(-Math.cos(a), -Math.sin(a)), w, d, h, style, color: colors[front.length % colors.length]! });
    arc += w + 0.1;
  }
  // Two cafés and two restaurants on the north side, in the default view (−z is north).
  const north = -Math.PI / 2;
  const angleOf = (b: CityBuilding) => Math.atan2(b.z, b.x);
  const wanted: [number, 'cafe' | 'resto', 0 | 1][] = [
    [north - 0.1, 'cafe', 0],
    [north + 0.1, 'resto', 0],
    [north - 0.28, 'resto', 1],
    [north + 0.28, 'cafe', 1],
  ];
  for (const [ang, kind, i] of wanted) {
    let best: CityBuilding | null = null;
    for (const b of front) {
      if (b.shop) continue;
      if (!best || Math.abs(angleOf(b) - ang) < Math.abs(angleOf(best) - ang)) best = b;
    }
    if (best) {
      best.shop = kind;
      best.name = SHOP_NAMES[city][kind][i];
      best.h = Math.max(best.h, 9);
    }
  }
  // Towers further out (the skyline), clear of the landmark.
  const back: CityBuilding[] = [];
  const n = DETAIL[detail].buildings;
  for (let i = 0; i < n * 3 && back.length < n; i++) {
    const a = r() * Math.PI * 2;
    const dist = FRONT_RADIUS + 20 + r() * 70;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    if (Math.hypot(x - LANDMARK_AT.x, z - LANDMARK_AT.z) < 24) continue;
    const w = 6 + r() * 9;
    const tall = city === 'newyork' || city === 'hcmc' ? 1.6 : city === 'hanoi' ? 1.0 : 1.3;
    const towerStyle: BuildingStyle = r() < 0.6 ? 'glass' : style === 'tube' ? 'shophouse' : style;
    back.push({ x, z, facing: Math.atan2(-x, -z), w, d: w * (0.7 + r() * 0.5), h: (14 + r() * r() * 50) * tall, style: towerStyle, color: COLORS[towerStyle][i % COLORS[towerStyle].length]! });
  }
  return { front, back };
}
