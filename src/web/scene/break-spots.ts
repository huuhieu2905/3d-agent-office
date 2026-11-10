import type { OfficeLayout, PlacedItem } from '@shared/domain';
import { footprintRect } from '@shared/catalog';
import type { ParkShop, Spot } from './park/park-layout';

// 004 US3 (research R4-05, data-model §6): who may use which break spot. One SpotBook per scene, so two
// people never take the same sofa seat or shop stool, and only a third of the staff is outside at once.
// The first-person player books spots too (owner PLAYER), so employees never sit on the user (FR-032).
// Pure for unit tests.

export const PLAYER = '__player__';

/** World position of a point given in floor space (metres from the north-west corner). */
function floorToWorld(layout: OfficeLayout, x: number, z: number): { x: number; z: number } {
  return { x: x - layout.floor.width / 2, z: z - layout.floor.depth / 2 };
}

/**
 * Two seats per sofa: `<itemId>:L` and `<itemId>:R`, on the cushion, facing out of the sofa. The sofa
 * model's back is at local −z, so sitters face local +z, turned by the item's rotation.
 */
export function sofaSpots(layout: OfficeLayout): Spot[] {
  const out: Spot[] = [];
  for (const it of layout.items) {
    if (it.type !== 'sofa') continue;
    const r = footprintRect(it);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    // Same convention as itemTransform: the model is turned by −rotation around y.
    const rot = -(it.rotation * Math.PI) / 180;
    // Local: seats at x = ±0.45 along the sofa, 0.05 m forward of its centre.
    for (const [side, lx] of [
      ['L', -0.45],
      ['R', 0.45],
    ] as const) {
      const lz = 0.05;
      const wx = cx + lx * Math.cos(rot) + lz * Math.sin(rot);
      const wz = cz - lx * Math.sin(rot) + lz * Math.cos(rot);
      const w = floorToWorld(layout, wx, wz);
      out.push({ id: `${it.id}:${side}`, x: w.x, z: w.z, facing: rot });
    }
  }
  return out;
}

export function sofaOf(spotId: string): string {
  return spotId.slice(0, spotId.lastIndexOf(':'));
}

export class SpotBook {
  private owners = new Map<string, string>(); // spotId → owner
  private outside = new Set<string>();
  private population = 0;

  setPopulation(n: number): void {
    this.population = n;
  }

  /** FR-024: at most a third of the staff outside at once, and at least one. */
  get outingSlots(): number {
    return Math.max(1, Math.floor(this.population / 3));
  }

  isFree(spotId: string): boolean {
    return !this.owners.has(spotId);
  }

  ownerOf(spotId: string): string | undefined {
    return this.owners.get(spotId);
  }

  /** Book every spot in `spotIds` (all or nothing). An owner holds one booking at a time. */
  reserve(owner: string, ...spotIds: string[]): boolean {
    if (spotIds.some((s) => this.owners.has(s) && this.owners.get(s) !== owner)) return false;
    this.releaseSpots(owner);
    for (const s of spotIds) this.owners.set(s, owner);
    return true;
  }

  /** Free the owner's spots only (keeps its outing slot). */
  releaseSpots(owner: string): void {
    for (const [s, o] of this.owners) if (o === owner) this.owners.delete(s);
  }

  /** Free everything the owner holds: spots and outing slot. */
  release(owner: string): void {
    this.releaseSpots(owner);
    this.outside.delete(owner);
  }

  spotsOf(owner: string): string[] {
    return [...this.owners].filter(([, o]) => o === owner).map(([s]) => s);
  }

  tryOuting(owner: string): boolean {
    if (this.outside.has(owner)) return true;
    if (this.outside.size >= this.outingSlots) return false;
    this.outside.add(owner);
    return true;
  }

  endOuting(owner: string): void {
    this.outside.delete(owner);
  }

  get outsideCount(): number {
    return this.outside.size;
  }

  /** Drop bookings of spots that no longer exist; returns the owners who lost theirs (they go back). */
  revalidate(layout: OfficeLayout, shops: ParkShop[]): string[] {
    const exists = new Set<string>([...sofaSpots(layout).map((s) => s.id), ...shops.flatMap((s) => [...s.seats, ...s.stands].map((x) => x.id))]);
    const lost = new Set<string>();
    for (const [s, o] of this.owners) {
      if (!exists.has(s)) {
        this.owners.delete(s);
        lost.add(o);
      }
    }
    return [...lost];
  }
}

/** Items a brain can walk to (type guard for the layout). */
export function hasItem(layout: OfficeLayout, type: PlacedItem['type']): boolean {
  return layout.items.some((i) => i.type === type);
}
