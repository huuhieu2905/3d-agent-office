# Feature Specification: Working Office Doors and Free Picture Placement

**Feature Branch**: `008-doors-free-frames`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Bổ sung thêm cho phase 007-build-mode-rooms: (1) Cửa có thể đóng/mở được; khi nhân viên bước ra thì tự mở cửa và đóng lại; ở góc nhìn thứ nhất cũng tương tác đóng/mở được. (2) Tranh treo tường và ảnh treo được lên tường / mặt kính dài; hiện không treo được lên phần tường treo màn hình, kiểm tra lại. (3) Tranh và ảnh đặt được ở vị trí bất kỳ trên mặt phẳng của tường; hiện chỉ đặt theo toạ độ của văn phòng (điều tra lại)."

## Context *(findings from the current product, after feature 007)*

- **Office door (007)**: drawn with its glass leaf permanently standing open. It never closes, employees walk straight through, and in first person there is nothing to interact with (the door is not in the list of things the `E` key can use). The building's main door is different: it already slides open by itself when someone comes near and closes again (feature 004).
- **"The wall with the screen" — confirmed limitation**: the wall screen hangs in front of the north side of the office, which is the glass façade facing the park. Feature 007 deliberately forbade frames on that façade ("never on the north glass façade"), so a painting or photo cannot be hung there. Frames work on interior walls, glass walls, long glass walls and the west/east/south outer walls.
- **Free placement — confirmed limitation**: today a frame's position along the wall snaps to the office's 0.5 m grid (the same grid as walls), and its height is fixed at 1.5 m. So the user cannot put a picture "anywhere on the wall": not between two grid points, not higher or lower. In the overview camera, a frame on a cut-down solid wall is shown standing on the cut edge.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Employees open and close office doors (Priority: P1)

An office door is closed when nobody uses it. An employee who needs to pass opens it, walks through and closes it behind them.

**Why this priority**: Makes the rooms built in 007 feel real; it is visible all day without any user action.

**Independent Test**: Build a room with an office door and a desk inside, seat an employee there, send them on a break; watch the door open as they reach it and close after they pass.

**Acceptance Scenarios**:

1. **Given** an office door with nobody near it, **Then** it is shown closed.
2. **Given** an employee walking a path through a closed office door, **When** they reach it, **Then** they stop at the door, open it (a short opening of about 1 second), walk through, and the door swings closed within about 2 seconds after the last person has passed.
3. **Given** two employees passing the same door one after the other, **Then** the door stays open until the second one has passed, then closes.
4. **Given** a closed office door, **Then** no employee walks through it while it is closed: it blocks them like a wall until it is open. Employees still plan their routes through doors, because they can open them, so a closed door never makes a room unreachable.
5. **Given** a door already open (someone else is passing, or the user opened it), **When** an employee reaches it, **Then** they walk straight through without stopping.

---

### User Story 2 - Open and close doors yourself in first person (Priority: P2)

Walking around in first person, the user looks at an office door and presses the interaction key to open or close it.

**Why this priority**: Requested explicitly; builds on US1's open/closed door.

**Independent Test**: In first person, walk to a closed office door, aim at it, press `E`: it opens and you can walk through; press `E` again: it closes and you can no longer walk through.

**Acceptance Scenarios**:

1. **Given** first person and an office door within reach under the crosshair, **Then** the hint shows "E — Open door" (or "E — Close door" when it is open).
2. **Given** a closed door, **When** the user presses `E`, **Then** it opens; **When** pressed again, **Then** it closes.
3. **Given** a closed office door, **When** the user walks into it in first person, **Then** they are stopped like at a glass wall; through an open door they pass.
4. **Given** the user left a door open, **When** an employee passes through it, **Then** the employee closes it behind them (doors return to closed at rest).
5. **Given** the user is standing in the doorway, **Then** the door does not close on them (it waits until the doorway is clear).

---

### User Story 3 - Hang pictures on the glass façade behind the wall screen (Priority: P2)

Paintings and photo frames can hang on the inside of the north glass façade, the wall the wall screen stands in front of, like on any other glass wall.

**Why this priority**: A visible gap reported by the user; small change.

**Independent Test**: In build mode, hang a painting on the north façade next to the wall screen; save; it stays there after reload.

**Acceptance Scenarios**:

1. **Given** build mode with a frame picked, **When** the user points at the inside of the north glass façade, **Then** the preview is valid and the frame can be placed facing into the office.
2. **Given** a frame on the north façade, **Then** it may not be placed directly behind the wall screen (where the screen would hide it); the preview is invalid there.
3. **Given** a frame facing out of the office (towards the park) on any outer wall, **Then** the preview is invalid.

---

### User Story 4 - Place pictures anywhere on the wall surface (Priority: P2)

The user places a frame at any point along a wall and at any height, instead of only on the 0.5 m office grid at a fixed height.

**Why this priority**: The user wants free composition of wall decorations.

**Independent Test**: Hang a photo frame on a long glass wall; move it 15 cm sideways and 40 cm up; save; reload; it is at exactly that place.

**Acceptance Scenarios**:

1. **Given** a frame picked in build mode, **When** the user points at a wall, **Then** the preview follows the pointer along the wall in 5 cm steps (hold `Shift` for 0.5 m steps), centred under the pointer.
2. **Given** a selected frame, **When** the user presses `←`/`→`, **Then** it moves along its wall by 5 cm (`Shift`: 0.5 m); **When** the user presses `↑`/`↓`, **Then** its height changes by 5 cm (`Shift`: 0.5 m).
3. **Given** a selected frame, **Then** the toolbar shows its height above the floor and lets the user type a height.
4. **Given** a frame dragged with the mouse in build mode, **Then** it slides along its wall (it does not leave the wall).
5. **Given** a frame whose new position or height would stick out past the end of its wall, below 0.2 m from the floor or above the top of the wall, or overlap another frame on the same side, **Then** the move is refused (preview invalid / key does nothing).
6. **Given** a frame spanning two adjoining wall pieces (e.g. a short glass piece next to a long glass piece in one line), **Then** it is valid as long as there is wall behind its whole width.

---

### Edge Cases

- A door is deleted, moved or rotated in build mode: its open/closed state resets to closed.
- An employee is standing still inside a doorway (e.g. stuck in the crowd): the door stays open until they leave it.
- Build mode: doors are shown closed; employees moving in the background still open them.
- The user is in first person and an employee opens a door the user had closed: it closes again behind the employee (rest state is closed).
- Main (outer) door: unchanged; it keeps opening by itself (feature 004).
- A frame saved by feature 007 (0.5 m grid, no height stored) loads at the same place with the 1.5 m height it had.
- A frame on a cut-down solid wall in the overview camera: still shown standing on the cut edge whatever its height (unchanged from 007); its real height shows in first person and on glass.
- The office is resized: frames on the outer walls move with the wall as in 007; their height is unchanged.
- The wall screen is moved or added in build mode so that it now stands in front of a frame on the north façade: that frame becomes invalid and Save is blocked with a clear reason until one of them is moved.
- Two frames on opposite sides of the same glass may overlap in position (they do not touch).

## Requirements *(mandatory)*

### Functional Requirements

**Doors**

- **FR-001**: Every office door MUST have an open and a closed state; at rest (nobody passing, not opened by the user) it MUST be closed.
- **FR-002**: A closed office door MUST block employees like a wall. An employee whose path crosses it MUST stop at the door, open it, and only then walk through; the door MUST close after the doorway is clear. Opening MUST NOT delay the walk by more than about 1 second per door; an already open door is passed without stopping.
- **FR-003**: Route planning MUST still treat office doors as openable passages, so a closed door never makes a seat unreachable (the layout rule "every seat reachable from the main door" is unchanged).
- **FR-004**: In first person, an office door under the crosshair within reach MUST offer "Open door" / "Close door" on the interaction key.
- **FR-005**: In first person, a closed office door MUST block the user like a wall; an open one MUST let them pass.
- **FR-006**: A door MUST NOT close while someone (employee or first-person user) is in the doorway.
- **FR-007**: Door open/closed state MUST NOT be saved with the layout; after a reload every door starts closed.
- **FR-008**: The main outer door MUST keep its current behaviour.

**Frames on the façade**

- **FR-009**: Paintings and photo frames MUST be allowed on the inside of the north glass façade (facing into the office), except where a wall screen stands in front of them.
- **FR-010**: Frames MUST NOT face out of the office on any outer wall, and MUST NOT hang over the main door.

**Free frame placement**

- **FR-011**: A frame's position along its wall MUST use 5 cm steps (0.5 m with `Shift`), independent of the office's 0.5 m grid.
- **FR-012**: A frame MUST store its own height (centre above the floor), adjustable in 5 cm steps between 0.2 m + half its height and the wall top − half its height; frames saved before this feature keep 1.5 m.
- **FR-013**: In build mode, the user MUST be able to set a frame's position along the wall by pointer (place and drag) and arrow keys, and its height by arrow keys and a typed value.
- **FR-014**: A frame MUST be valid only when there is wall (wall, glass, long glass, or the inside of an outer wall) behind its entire width, and it MUST NOT overlap another frame on the same side of the same wall (overlap measured in both position and height).
- **FR-015**: Frames MUST keep all 007 behaviour: upload/reset picture, flip side with `R` on interior glass, removal when their wall is removed, undo/redo.

**General**

- **FR-016**: Layouts and profiles saved by feature 007 MUST load unchanged.
- **FR-017**: All new on-screen text MUST be in English.

### Key Entities

- **Office door state** (not saved): per door, open or closed, plus who is currently passing or waiting for it to open; closed doors are obstacles for employees and the first-person user.
- **Frame placement** (saved with the layout): which wall line and side it hangs on, its position along that line (5 cm steps), and its height (5 cm steps).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a room with one office door, 100% of employee passages are seen opening the door before passing and closing it afterwards (observed over 10 passages).
- **SC-002**: An employee's walk through a closed door takes no more than 1 second longer than the same walk through an open door, and no employee is ever seen passing through a closed door.
- **SC-003**: In first person, a user opens or closes a door within 2 seconds of aiming at it, on the first try.
- **SC-004**: A user can hang a painting next to the wall screen on the glass façade in under 30 seconds.
- **SC-005**: A user can put a frame at a chosen spot (within 5 cm along the wall and 5 cm in height) in under 30 seconds.
- **SC-006**: 100% of layouts saved by feature 007 load with every frame at the same place and 1.5 m height.
- **SC-007**: The office still renders at the 60 FPS budget on the reference Mac with 6 office doors animating and 8 frames.

## Assumptions

- "Cửa" means the interior **office door** from 007. The main outer door already opens and closes by itself and is out of scope.
- Doors swing open (hinged) rather than slide, matching the 007 model; no lock, no knocking.
- First-person interaction uses the existing interaction key (`E`) and reach used for screens and the water cooler.
- "Kính dài / tường" includes every wall type that can hold a frame in 007, plus the north façade.
- Free placement is limited to the wall plane: frames stay flat on a wall; rotating a frame to an angle or tilting it is out of scope.
- Frames still cannot hang across a corner or over an office door.
- Snapping to other frames (alignment guides) is out of scope.
- This feature extends 007 and can ship on its own branch after 007 is merged.
