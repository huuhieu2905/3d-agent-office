# UI and data contract (008)

English text only. No new REST route; `PUT /api/layout` (007 L7-1) now also accepts the optional `height` on frame items, validated by the shared rules in data-model §1.

## U8-1 Office doors (overview and first person)

- At rest an office door is drawn closed (leaf in the wall line).
- An employee whose route crosses a closed door stops within 0.6 m of it, the leaf swings open (≤ 0.6 s), they walk through, and the leaf swings closed 2 s after the doorway is clear.
- Never seen: an employee passing through a closed leaf.

## U8-2 First person

| Input | When | Effect |
|---|---|---|
| aim at an office door within reach | — | hint `E — Open door` / `E — Close door` |
| `E` | aiming at a door | toggles it (won't close while you stand in the doorway) |
| walk into a closed door | — | stopped like at glass |

## U8-3 Build mode: frames

| Input | Target | Effect |
|---|---|---|
| pointer over a wall with a frame picked | — | ghost centred under the pointer, along-wall 5 cm steps (Shift 0.5 m), height = last used (1.5 m at first) |
| drag | selected frame | slides along its wall, 5 cm steps |
| `←` / `→` | selected frame | along its wall by 5 cm (Shift 0.5 m) |
| `↑` / `↓` | selected frame | height ±5 cm (Shift 0.5 m) |
| "Height (m)" input (`data-testid="frame-height-input"`) | selected frame | sets the height; invalid values shown with the range |
| `R` | selected frame | unchanged from 007 (flip side on interior glass) |

A move or height that breaks a rule (data-model §1) is refused; the ghost turns red.
