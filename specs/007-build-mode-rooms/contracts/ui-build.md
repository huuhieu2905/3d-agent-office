# UI contract: build mode (007)

All text in English (006). Test ids follow `tests/e2e/testids.ts`.

## U7-1 Placing with rotation

| Input | While | Effect |
|---|---|---|
| `R` / click `⟳ Rotate` (`data-testid="build-rotate-placing"`) | an item is picked (`palette` set), nothing selected | ghost turns 90° clockwise in place under the cursor |
| click on the floor | valid ghost | item placed with the ghost's rotation; palette and rotation stay for the next one |
| `R` / `⟳ Rotate` | an item is selected | unchanged: rotates the selected item |

While placing, the hint line is replaced by "<Item>: click the floor to place it · `R` rotates" and the Rotate button (same row, so the toolbar does not grow and cover the floor).

## U7-2 Palette

New buttons, in this order after the existing ones: Long glass wall, Office door, Meeting table (4), Meeting table (8), Painting, Photo frame. Each `palette-item` button gets `data-testid="palette-<type>"`.

## U7-3 Frames

- Hanging height: 1.5 m (centre) on glass and in first person; in the overview camera a frame on a cut-down solid wall stands on the wall's top edge (research R7-05).
- Ghost snaps to the nearest 0.5 m edge segment; the side follows the cursor (which half of the edge it is on). Invalid (red) when not on a wall or overlapping another frame.
- Selected frame toolbar adds:
  - `Change picture` (`data-testid="frame-change-picture"`): opens a file picker with `accept="image/png,image/jpeg,image/webp"`.
  - `Reset picture` (`data-testid="frame-reset-picture"`), shown only when the frame has a picture.
- Error messages (shown in the toolbar, `role="alert"`):
  - wrong type: "Choose a PNG, JPEG or WebP image"
  - over 10 MB: "The image is larger than 10 MB"
  - cannot decode or upload fails: "Could not read this image"
- While uploading, the button shows "Uploading…" and is disabled.

## U7-4 Seating employees at a meeting table

- Dragging an employee over a meeting table highlights the nearest free or occupied seat (same green/amber hint as desks).
- Drop on a seat → employee takes it (swap if occupied). Drop on their own desk → they leave the meeting. Drop on another desk → desk swap as today, and they leave the meeting.
- Outside build mode, one click on a seated employee still opens their chat (Constitution V).
