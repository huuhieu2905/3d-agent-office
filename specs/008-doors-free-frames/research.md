# Research: Working Office Doors and Free Picture Placement (008)

All decisions come from reading the code after feature 007. No new dependency.

## R8-01 Door state lives in the browser, in one shared book

- **Finding**: employees are simulated in the browser (`EmployeeBrain` in `src/web/scene/employee-behaviors.ts`), sharing per-scene objects created in `OfficeScene.tsx` (`Crowd`, `SpotBook`). The main door's animation already reads "is anyone near" each frame (`Door isNear` in `Office.tsx`). The server never sees positions.
- **Decision**: a pure class `DoorBook` in `src/web/scene/doors.ts`, created once per layout in `OfficeScene` like `SpotBook`, passed to brains, `Office` (for the animation) and `FirstPersonCamera`. Per office door it keeps: `openness` 0–1 (animated), `holders` (ids of employees that asked for it), `userOpen` (toggled with `E`), `clearAt` (time the doorway became clear). Rules:
  - target = open when it has holders, or `userOpen`, or someone stands in the doorway; otherwise closed once the doorway has been clear for 2 s (FR-002, FR-006).
  - opening/closing speed: fully open in 0.6 s, so a waiting employee is released within ≤ 1 s (`isOpen` = openness ≥ 0.8) (SC-002).
  - an employee passing through clears `userOpen` once past (spec US2/AC4: rest state is closed).
  - the book is rebuilt when the layout changes, so a moved/deleted door starts closed (edge case); nothing is saved (FR-007).
- **Alternatives**: door state on the server (rejected: positions are browser-only, and it is not data to keep, Constitution I/III); closing the nav edge in the A* grid (rejected: a closed door would make rooms unreachable and break the layout rule, FR-003).

## R8-02 Employees stop, open, walk through

- **Finding**: `followPath` walks waypoint to waypoint (0.25 m nav cells); office doors do not block the nav grid (catalog `blocks: 'none'`), so A* routes pass through them.
- **Decision**: before each step, the brain looks at the next few waypoints (current position → `path[i..i+3]`). If a pair of consecutive cells crosses an office door (`DoorBook.doorBetween(a, b, grid)`: both cells to floor metres, segment-crossing test against the door line ± 0.05 m — the brain may walk on the offset `SiteGrid`, and nav cells are 0.25 m while doors sit on the 0.5 m edge grid) and the employee is within 0.6 m of the doorway, it asks the door to open (`request`), and while `!isOpen` it stands still facing the door (idle pose, "opening"). Once the crossing is behind it, it calls `release`. A door already open is passed without stopping (spec US1/AC5).
- The A* grid and the layout validation stay unchanged (doors passable), so FR-003 holds.
- Jam handling (`blockedFor`) must not count waiting at a door as being blocked, so the brain does not replan around a closing door.

## R8-03 A closed door blocks the first-person user; `E` opens it

- **Finding**: first-person movement (`slide` / `freeAt` in `fp-motion.ts`) checks cells and edges of the `SiteGrid`; interactables (`interactables.ts`) list what `E` can use, with a hint text.
- **Decision**:
  - `slide` gets an optional `blocked(x0, z0, x1, z1)` test; `FirstPerson` passes `doors.blocksMove`, which is true when the move crosses the line of a door that is not open (world coordinates, door segment ± player radius).
  - `interactables.ts` gains type `office_door` (aim height 1.1 m, action "Open door" / "Close door" from `DoorBook`), and `E` calls `doors.toggleUser(id)`. The door will not close while the player is in the doorway (FR-006).
- The main outer door is untouched (FR-008).

## R8-04 Door model swings

- **Decision**: `OfficeDoor` keeps its frame; the glass leaf rotates on its hinge from 0° (closed, in the wall line) to 90° (open), read from `doors.openness(id)` in `useFrame` — the same pattern as the main `Door`. No React re-render per frame.

## R8-05 Frames on the north façade

- **Finding**: 007's `frameSupported` explicitly rejects the north façade.
- **Decision**: accept the north façade (z = 0) for frames facing south (rotation 0), except where a wall screen stands in front: any `wall_screen` whose footprint starts within 1 m of z = 0 and overlaps the frame's x-range makes the frame invalid — reason `"Hidden behind the wall screen"`. This is checked in `validateLayout` (not in `frameSupported`), so moving a screen in front of a frame flags the frame instead of deleting it (spec edge case).

## R8-06 Free placement: 5 cm along the wall, stored height

- **Finding**: 007 frames use the 0.5 m edge grid for both coordinates and `edgeSegments` for support/overlap; height is the constant `FRAME_Y = 1.5`.
- **Decision**:
  - **Position**: the coordinate across the wall line (z for rotation 0/180, x for 90/270) stays on the 0.5 m line grid (walls only exist there); the coordinate along the wall uses 0.05 m steps (0.5 m with Shift).
  - **Height**: new optional `PlacedItem.height` (metres, centre above the floor, 0.05 m steps); absent = 1.5 m, so 007 layouts load unchanged (FR-012, SC-006). Allowed range: `[0.2 + h/2, 2.6 − h/2]` where `h` is the frame's picture height (painting 0.7 m, photo 0.5 m) and 2.6 m is the wall height of every wall type.
  - **Support**: replace the segment test by interval coverage on the wall line: collect intervals from wall / glass / long glass items on that line, plus the inward-facing outer wall (minus the main door span, and for the north façade the whole width), merge them, and require `[along, along + width]` to be covered (FR-014, spec US4/AC6). Office doors never count as wall.
  - **Overlap**: two frames on the same line facing the same side overlap when both their along-intervals and height-intervals overlap (FR-014); opposite sides never overlap.
  - **Pointer placement** (`BuildGizmo.placementFor`): line and side as in 007; along = `snap(pointer − width/2, 0.05)` (Shift 0.5); height = the last height used in this build session (starts 1.5).
  - **Drag** (`DragLayer.itemPos`): a frame keeps its line coordinate and slides along it in 0.05 m steps.
  - **Keys** (`BuildMode` arrow handler): for a selected frame `←/→` move along the wall, `↑/↓` change height (5 cm, Shift 0.5 m), refused when invalid (`moveIsValid` for frames runs `validateLayout` on the moved frame).
  - **Toolbar**: a "Height (m)" number input for the selected frame, same 5 cm step, validated like the floor-size inputs.
- `edgeSegments` stays for edge items (walls, glass, doors); frames stop using it. `Office.tsx`'s "low on cut-down walls" check uses glass coverage at the frame's middle point instead.

## R8-07 Performance

- Doors: at most a few `useFrame` rotations and one `DoorBook.tick` per frame (O(doors × people)). Frames: no change in draw cost. SC-007 checked with the bench "rooms" scenario extended with 6 office doors.
