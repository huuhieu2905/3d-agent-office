# Feature Specification: Build Mode Rooms — Doors, Long Glass, Wall Art, Meeting Rooms, Rotate While Placing

**Feature Branch**: `007-build-mode-rooms`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Trong chế độ xây dựng, bổ sung vật phẩm: Cửa văn phòng, Kính dài (hiện tại mới chỉ có các mảnh kính ngắn) để tự xây dựng các phòng ban riêng trong văn phòng lớn. Bổ sung tranh tường, ảnh; sau khi lắp trên tường / cửa kính thì cho phép người dùng tự upload ảnh của mình lên (kiểm tra tính khả thi). Bổ sung bàn làm việc lớn / bàn họp để tự xây dựng phòng họp riêng. Thay ghế hiện tại bằng ghế công thái học / ghế văn phòng. Trong phòng họp, người dùng có thể kéo thả nhân viên vào từng vị trí ghế quanh bàn. Cho phép xoay vật phẩm trong bước đặt vào vị trí (hiện chỉ xoay được sau khi đã đặt)."

## Context *(findings from the current product)*

- Build mode today offers: Desk, Chair, Wall, Glass wall, Plant, Water cooler, Sofa, Wall screen. Walls and glass are 0.5 m segments on a 0.5 m edge grid, so a 4 m glass partition needs 8 placements.
- The only door is the office's outer door; there is no door that can be placed inside the office.
- Chairs look like rattan chairs (concept "Soft Studio · Sài Gòn").
- Employees can only be seated at desks (drag an employee onto a desk; dropping on an occupied desk swaps).
- Rotating while placing: the `R` key already turns the item being placed, but nothing on screen says so — the only visible Rotate button appears after an item is placed and selected. To the user this looks like "rotation is only possible after placing". The gap is mainly discoverability and preview feedback.
- **Photo upload feasibility — feasible.** The system runs entirely on the user's machine and already keeps its own data (office layout, seating, settings) in a local data folder. Uploaded pictures can be stored in that same folder and shown only to the local browser. No Internet connection is needed, so it fits the project's local-first and privacy principles. The real limits are file size and image type, which this spec bounds.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rotate an item before placing it (Priority: P1)

While an item is picked from the palette and follows the mouse as a preview, the user turns it to the orientation they want and then clicks to place it, instead of placing it first and rotating it afterwards.

**Why this priority**: Smallest change, used by every other story (doors, long glass, meeting tables all need orientation), and it removes an everyday friction.

**Independent Test**: Pick "Sofa", press Rotate (button or `R`) twice, check the preview turned 180°, click the floor; the placed sofa has that orientation with no extra step.

**Acceptance Scenarios**:

1. **Given** an item is picked in the palette, **When** the user presses `R` or clicks the visible Rotate control, **Then** the preview turns 90° clockwise immediately, without moving the mouse.
2. **Given** a rotated preview, **When** the user clicks a valid floor spot, **Then** the item is placed with exactly the rotation shown.
3. **Given** a rotated preview, **When** the user places several of the same item in a row, **Then** each one keeps the last chosen rotation until the user changes it.
4. **Given** the rotated preview would overlap something or leave the floor, **Then** the preview is shown as invalid and a click does not place it.

---

### User Story 2 - Build a department room with long glass and an office door (Priority: P1)

The user encloses part of the big office into a room using long glass partitions and an interior office door, in a few placements instead of many short glass pieces.

**Why this priority**: The core of the request: carving the open office into departments.

**Independent Test**: Build a 4 m × 3 m room in one corner using long glass and one office door; save; reload; the room is still there and employees can walk in and out through the door.

**Acceptance Scenarios**:

1. **Given** build mode, **When** the user picks "Long glass wall", **Then** one placement creates a glass partition 2 m long that snaps to the same 0.5 m edge grid as existing walls and glass, and can be rotated before placing.
2. **Given** build mode, **When** the user picks "Office door", **Then** one placement creates a 1 m interior door segment that fits in a wall or glass line on the same edge grid.
3. **Given** a room closed by walls/glass with an office door, **When** an employee needs to reach a desk inside, **Then** they walk through the door and never through glass or walls.
4. **Given** a room closed by walls/glass with no door, **When** the user tries to save, **Then** the system warns that the desks inside cannot be reached (same rule as today's reachability check) and does not save.
5. **Given** existing layouts with short glass pieces, **Then** they load and behave exactly as before.

---

### User Story 3 - Build a meeting room and seat employees around the table (Priority: P2)

The user places a meeting table, which comes with office chairs arranged around it, and drags employees onto individual chairs to "hold a meeting".

**Why this priority**: Gives the room a purpose; depends on rooms (US2) to be meaningful but works on the open floor too.

**Independent Test**: Place a meeting table, drag two employees onto two of its chairs, check they walk there and sit; save, reload, check they are still seated there.

**Acceptance Scenarios**:

1. **Given** build mode, **When** the user picks "Meeting table" (4-seat or 8-seat), **Then** one placement creates the table with its chairs evenly arranged around it; the table and chairs move, rotate and delete as one item.
2. **Given** a placed meeting table, **When** the user drags an employee onto one of its chairs, **Then** that employee is assigned to that chair and, outside build mode, walks to it and sits facing the table.
3. **Given** an occupied meeting chair, **When** the user drops another employee on it, **Then** the two employees swap places (same rule as desks).
4. **Given** an employee seated in a meeting chair, **Then** their status (working, thinking, waiting, idle…) still shows truthfully from the App, and one click on them still opens their chat.
5. **Given** an employee with a desk is seated in a meeting chair, **Then** they keep their desk (no one else can take it), and **When** the user drags them back onto their own desk, **Then** the meeting chair becomes free and they sit at their desk again.
6. **Given** an employee without a desk, **When** the user drags them onto a meeting chair, **Then** they sit there; their seat is only the meeting chair, and the system does not assign them a free desk while they are in the meeting (they get one automatically again once they leave the meeting, as today).

---

### User Story 4 - Office chairs replace the rattan chairs (Priority: P2)

Every chair in the office — the stand-alone Chair item, the chairs at desks and the chairs around meeting tables — looks like an ergonomic office chair (high back, armrests, five-star base on casters).

**Why this priority**: Visual change only; no new behaviour.

**Independent Test**: Open an existing office; every chair shows the office-chair look; seated employees still sit correctly on it.

**Acceptance Scenarios**:

1. **Given** an existing saved office, **When** it loads, **Then** all chairs show the office-chair look without the user having to rebuild anything.
2. **Given** an employee sits at a desk or meeting chair, **Then** the chair back stays behind them and they do not visibly sink into or float above the seat.

---

### User Story 5 - Hang pictures and photos and upload your own image (Priority: P3)

The user hangs wall art (a landscape painting frame and a smaller photo frame) on walls or glass walls. Each frame shows a default picture; the user can replace it with an image from their computer.

**Why this priority**: Decoration and personalisation; nothing else depends on it.

**Independent Test**: Hang a photo frame on a glass wall, upload a PNG from the computer, save, reload: the frame shows the uploaded image.

**Acceptance Scenarios**:

1. **Given** build mode, **When** the user picks "Painting" or "Photo frame" and hovers a wall or glass wall, **Then** the preview snaps flat against that wall at a fixed hanging height; on open floor the preview is invalid.
2. **Given** a placed frame selected in build mode, **When** the user chooses "Change picture" and selects a PNG, JPEG or WebP image up to 10 MB, **Then** the frame shows that image, cropped to fill the frame without stretching.
3. **Given** the user selects a file that is not an image, is larger than 10 MB, or cannot be read, **Then** a clear message explains why and the frame keeps its current picture.
4. **Given** a frame with an uploaded picture, **When** the user deletes the frame and saves, **Then** the uploaded picture is no longer kept by the system.
5. **Given** a frame with an uploaded picture, **When** the user clicks "Reset picture", **Then** the frame goes back to its default picture.
6. **Given** uploaded pictures, **Then** they never leave the user's machine.

---

### Edge Cases

- A wall or glass segment that holds a frame is deleted or moved: the frame is removed with it (undo restores both).
- A frame is placed on a glass wall: it is visible from the side it was hung on; from the other side the user sees the frame's back.
- Two frames on the same wall would overlap: the second placement is invalid.
- A meeting table is deleted while employees sit at it: those employees go back to their reserved desks if they have one, otherwise stand in the lobby (same as deleting an occupied desk today).
- An employee in a meeting chair is dropped onto another employee's desk: the existing desk swap rule applies, and the meeting chair becomes free.
- An employee's reserved desk is deleted while they are in a meeting: they stay in the meeting chair, now with no desk; the system does not give them a new desk while they are in a meeting.
- Rotating a selected frame turns it to face the other side of the same wall (it never leaves its wall).
- A meeting table is rotated or moved while employees sit at it: the employees move with their chairs.
- An employee's conversation disappears from the App: their meeting chair becomes free.
- Long glass or an office door would cross an existing wall/glass segment or go outside the floor: preview is invalid.
- The office is shrunk and a meeting table would fall outside: same "can't shrink: items in the way" behaviour as today.
- The office is resized while frames hang on its east or south outer wall: those frames move with the wall (they stay on it); they never block a resize and are never dropped by it.
- The uploaded image file is deleted from the local data folder by hand: the frame falls back to its default picture, no error loop.
- The user cancels build mode after uploading a picture: the frame keeps its saved picture; the unused upload is removed at the next save or restart.

## Requirements *(mandatory)*

### Functional Requirements

**Rotate while placing**

- **FR-001**: While an item is picked from the palette, the build toolbar MUST show a visible Rotate control and the hint MUST mention `R`.
- **FR-002**: Rotating MUST turn the preview 90° clockwise immediately, and the placed item MUST have the rotation shown in the preview.
- **FR-003**: The chosen rotation MUST persist for subsequent placements of the same palette pick until changed.

**Rooms**

- **FR-004**: The palette MUST offer a "Long glass wall": one 2 m glass segment on the 0.5 m edge grid, blocking movement like the short glass wall.
- **FR-005**: The palette MUST offer an "Office door": a 1 m interior door segment on the 0.5 m edge grid that employees can walk through and that does not block movement.
- **FR-006**: Walls, glass, long glass and office doors MUST NOT overlap one another on the same edge.
- **FR-007**: The existing rule that every desk must be reachable MUST also apply to meeting-table chairs.

**Meeting rooms**

- **FR-008**: The palette MUST offer a meeting table in two sizes, 4 seats and 8 seats, each placed as one item with its chairs evenly arranged around it.
- **FR-009**: Users MUST be able to drag an employee onto a specific meeting chair; dropping on an occupied chair MUST swap the two employees.
- **FR-010**: Meeting-chair assignments MUST be saved with the layout and restored after reload.
- **FR-011**: Employees seated at a meeting chair MUST keep showing their real App status and MUST open their chat with one click.
- **FR-012**: An employee in a meeting chair MUST keep their own desk reserved; dragging them back onto that desk MUST free the meeting chair. An employee is shown in at most one place at a time (the meeting chair while assigned there, otherwise their desk). Employees never move between desk and meeting chair on their own.

**Chairs**

- **FR-013**: All chairs (stand-alone, at desks, around meeting tables) MUST use one office-chair look in the project's "Soft Studio · Sài Gòn" style, with no change to how existing layouts are stored.

**Wall art**

- **FR-014**: The palette MUST offer "Painting" (landscape, 1.0 m × 0.7 m) and "Photo frame" (0.4 m × 0.5 m), which can only be placed on a wall, glass wall or long glass wall, or on the inside of the office's outer walls (not on the main door or an office door).
- **FR-015**: A selected frame MUST offer "Change picture" and "Reset picture".
- **FR-016**: Uploads MUST accept only PNG, JPEG and WebP images up to 10 MB, and MUST reject anything else with a clear message.
- **FR-017**: Uploaded pictures MUST be stored only in the system's local data folder, served only to the local browser, and MUST NOT be sent anywhere else.
- **FR-018**: Uploaded pictures no longer used by any saved frame MUST be removed at the next layout save or the next start of the system (this covers pictures uploaded in a build session that was cancelled).
- **FR-019**: A frame whose picture is missing MUST show its default picture.

**General**

- **FR-020**: All new items MUST support move, rotate, delete, undo/redo and save/cancel exactly like existing items.
- **FR-021**: Layouts saved before this feature MUST load unchanged.
- **FR-022**: New 3D items MUST be original models in the project's chosen visual style, with their licence/source recorded.
- **FR-023**: All new on-screen text MUST be in English, consistent with feature 006.

### Key Entities

- **Placed item** (existing): type, position, rotation. New types: long glass wall, office door, meeting table (4 / 8 seats), painting, photo frame.
- **Meeting seat** ("meeting chair" in the user stories): one chair of a meeting table, identified by its table and seat number; holds at most one employee.
- **Seat assignment** (existing seating, extended): links an employee to their desk (optional) and, separately, to a meeting seat (optional); when both are set the employee sits at the meeting seat and the desk stays reserved.
- **Frame picture**: an uploaded image tied to one frame item; the frame stores a reference to it, the image itself lives in the local data folder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can enclose a 4 m × 3 m room with one door in 8 placements or fewer (today: 28 short pieces for a free-standing room).
- **SC-002**: In a hallway test, a first-time user rotates an item before placing it without being told how, within 10 seconds of picking it.
- **SC-003**: A user can build a meeting room (table, partitions, door) and seat 4 employees in under 3 minutes.
- **SC-004**: A user can hang a frame and replace its picture with their own image in under 30 seconds.
- **SC-005**: 100% of layouts saved before this feature load with no visible change other than the new chair look.
- **SC-006**: With 8 frames showing uploaded pictures and two 8-seat meeting tables, the office still renders at the project's 60 FPS budget on the reference Mac.
- **SC-007**: No uploaded picture is sent off the user's machine (verifiable by watching network traffic during upload and display).

## Assumptions

- "Bàn làm việc lớn / bàn họp" is covered by one meeting-table item in two sizes (4 and 8 seats); a separate large single-person desk is not included.
- Long glass is a fixed 2 m piece; longer partitions are built from several pieces (combined with the 0.5 m piece for odd lengths). Click-and-drag "draw a wall" is out of scope.
- The office door is an open doorway with a door leaf that does not animate; employees pass through it freely. Locked doors are out of scope.
- The new chair look replaces the existing chair look everywhere; there is no option to keep rattan chairs.
- Frames hang at a fixed height; free vertical placement is out of scope.
- Uploaded images are shown as-is (cropped to fill); no in-app editing, filters or galleries. One picture per frame.
- 10 MB per image is enough for photos from a phone; images may be downscaled for display to keep the scene fast.
- No new Internet connection is introduced, so no constitution change is needed for this feature.
