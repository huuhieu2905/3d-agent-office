import type { City, DetailLevel } from '@shared/domain';
import { Kiosk } from '../city/Shops';
import { SHOP_NAMES } from '../city/city-layout';
import type { ParkShop } from './park-layout';

// 004 US3 (FR-026, FR-027): the four shops around the park, where idle employees sit or stand for a while.
// Scenery only — nothing to buy, no shopkeeper. Fictional names per city.

export function ParkShops({ shops, city, night, detail }: { shops: ParkShop[]; city: City; night: boolean; detail: DetailLevel }) {
  const names = SHOP_NAMES[city];
  return (
    <group>
      {shops.map((s) => (
        <Kiosk
          key={s.id}
          x={s.x}
          z={s.z}
          facing={s.facing}
          kind={s.kind}
          name={s.id === 'cafe' ? names.kiosk : names[s.id]}
          night={night}
          umbrellas={detail !== 'low'}
        />
      ))}
    </group>
  );
}
