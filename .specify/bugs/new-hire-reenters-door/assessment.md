# Bug Assessment: New hire walks back in from the door on every layout change

- **Slug**: new-hire-reenters-door
- **Created**: 2026-11-11
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)

> Khi tôi click vào bàn và chọn nhân viên, nhân viên đã ngồi vào vị trí được chỉ định, đến lúc vào chế độ Xây dựng, nhân viên đó bị out ra khỏi bàn và tự đi lại từ cửa vào bàn đã chọn. Khi tôi sắp xếp bất kỳ vật phẩm nào vào văn phòng thì cũng bị tình trạng tương tự (chỉ nhân viên vừa mới add vào trong phiên hiện tại mới bị, các nhân viên ở phiên trước đó không bị ảnh hưởng). Chỉ có reload lại thì tôi mới không bị tình trạng trên

Summary: an employee assigned to a desk during the current session sits down correctly, but whenever the user enters Build mode or moves any item, that employee disappears from the desk and walks in again from the door. Employees from earlier sessions are unaffected. A reload makes it go away.

## Symptom

Every layout change (entering Build mode, every draft edit) teleports the employees hired in this session to the office door, and they walk back to their seat. Expected: they stay seated (or walk from where they are) like the employees who were there at page load.

## Reproduction

1. Load the office (employees present at load are "old").
2. Click a desk, choose a new employee → they walk in from the door and sit down.
3. Enter Build mode (or move/place any item in Build mode).
4. The new employee jumps to the door and walks back to the desk; old employees stay seated.
5. Reload the page → the employee is now "old" and no longer affected.

## Suspected Code Paths

- `src/web/scene/employee-lifecycle.ts:25` — `enter` is set to `!firstSnapshot` the first time an id is seen and then **copied forever** (`old ? old.enter : …`). An employee who arrived after the first snapshot keeps `enter: true` for the whole session; employees from the first snapshot keep `false`. That is exactly the "only new hires, fixed by reload" split.
- `src/web/scene/Employee.tsx:75-79` — the `EmployeeBrain` is memoised on `[grid]` and built with the current `enter` prop. When the grid changes, a fresh brain is created with `enter: true` again.
- `src/web/scene/OfficeScene.tsx:56-59` — `layout = build.active && build.draft ? build.draft : saved`; `grid = useMemo(new OfficeGrid(layout), [layout])`. Entering Build mode swaps in the draft, and every draft edit produces a new layout object → new grid → every brain is rebuilt.
- `src/web/scene/employee-behaviors.ts:184-190` — with `o.enter` the brain `place(door)`s the character and starts an `entering` walk to its seat; without it the brain starts at home (seated).

## Root Cause Hypothesis

`enter` is meant as a one-shot "walk in from the door on arrival", but it is stored as a permanent attribute of the stage entry and re-applied each time the brain is rebuilt. Brains are rebuilt on every grid change (Build mode on, each draft edit, saving), so new hires replay their entrance each time. Confidence: **high** — the code path is direct and matches every detail of the report (only this-session hires, any layout change, cured by reload).

## Proposed Remediation

**Preferred**: make `enter` apply only to the first brain an `Employee` component builds. In `Employee.tsx`, keep a ref (e.g. `const entered = useRef(false)`) and build the brain with `enter: enter && !entered.current`, then set `entered.current = true`. A rebuilt brain (new grid) then starts at the seat like an old employee does. Small, local, no change to the stage hook's contract.

**Alternatives**:
- Clear `enter` in `useEmployeeStage` after the employee is first staged (e.g. `enter: false` when `old` exists). Simpler-looking, but the stage effect re-runs on every `visible` change, which can happen before the `Employee` mounts its first brain, risking a lost entrance. The ref in `Employee` is tied to the actual brain creation, so it is safer.
- Carry the old brain's position into the new brain on grid change (so someone mid-walk continues from where they are instead of snapping to the seat). Nicer, but larger; current behaviour for old employees is already "start at seat", so matching that is enough for this bug.

**Files likely to change**:
- `src/web/scene/Employee.tsx`
- a test under `tests/unit/` or `tests/e2e/`

**Tests to add or update**:
- e2e (existing harness, `window.__agentOffice` / `BRAINS` test hooks): hire an employee onto a desk, wait until seated, enter Build mode, assert the employee's brain is not in `entering` mode and its position is still at the seat.
- If kept to unit level: extract the one-shot decision into a tiny pure helper and test that a second brain build reports `enter: false`.

## Risks & Considerations

- An employee still mid-entrance when Build mode opens will snap to their seat on the rebuild (same as an old employee today). Acceptable; noted as the alternative above if it matters.
- A leaving employee (`leaving: true`) is unaffected: `brain.leave()` is re-applied via its effect on the new brain.
- No server, API, or data change.

## Open Questions

- None blocking. [NEEDS CLARIFICATION: should an employee caught mid-entrance continue walking after a layout change, or is snapping to the seat fine?]
