# Data Model: Working Office Doors and Free Picture Placement (008)

Layout stays `schemaVersion: 2`; one optional field is added. Nothing about doors is saved.

## 1. PlacedItem (layout v2)

```ts
interface PlacedItem {
  id: string;
  type: ItemType;
  pos: { x: number; z: number };
  rotation: Rotation;
  picture?: string;   // 007, frames only
  height?: number;    // NEW 008, frames only: centre above the floor (m), 0.05 steps; absent = 1.5
}
```

Zod: `height: z.number().min(0).max(3).optional()`.

### Validation rules (changed / added in `validateLayout`)

| # | Rule | Reason text |
|---|---|---|
| 1 | Frame: across-wall coordinate on 0.5 m, along-wall coordinate on 0.05 m (replaces the 0.5 m rule for frames) | `Position must be in 5 cm steps` |
| 2 | Frame: wall behind its whole width — merged intervals of wall / glass / long glass on its line, plus the inside of the outer wall facing inward (north façade allowed, facing south; main door span excluded); office doors never count | `A picture must hang on a wall` |
| 3 | Frame on the north façade: not behind a wall screen whose footprint starts within 1 m of z = 0 and overlaps the frame's x-range | `Hidden behind the wall screen` |
| 4 | Frame height within `[0.2 + h/2, 2.6 − h/2]` (`h` = 0.7 painting, 0.5 photo frame), on 0.05 m | `The picture is too high or too low` |
| 5 | Two frames on the same line and side overlap if both along- and height-intervals overlap | `Another picture is already here` |
| 6 | `height` only on frames | `Only picture frames have a height` |

Facing is unchanged from 007 (rotation 0 south, 90 east, 180 north, 270 west).

## 2. DoorBook (browser memory only)

Per office door id:

| Field | Meaning |
|---|---|
| `line` | its edge segment in floor metres (from the layout item) |
| `openness` | 0 = closed … 1 = open; animated at 1/0.6 s⁻¹ |
| `holders` | employee ids that asked to pass |
| `userOpen` | toggled by `E` in first person |
| `clearSince` | when the doorway last became empty (ms) |

State transitions:

```
closed ──(request | userOpen | someone in doorway)──▶ opening ──(openness ≥ 0.8)──▶ open (isOpen)
open ──(no holders, !userOpen, doorway clear for 2 s)──▶ closing ──▶ closed
```

- `isOpen(id)` = openness ≥ 0.8 (employees pass, first-person user passes).
- An employee who has crossed calls `release(id, who)` and clears `userOpen` (rest state closed).
- Rebuilt on layout change → every door starts closed.

## 3. Build session state (`useBuild`)

- `frameHeight: number` — height used for the next frame placed (starts 1.5, set when a frame is placed or its height changed). Not saved.
