# Bug Fix: New hire walks back in from the door on every layout change

- **Slug**: new-hire-reenters-door
- **Fixed**: 2026-11-11
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

The walk-in from the door now plays only for the first brain an `Employee` component builds. Brains rebuilt when the office grid changes (entering Build mode, every draft edit, saving) start seated, the same way employees present at page load already did.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/web/scene/Employee.tsx` | modified | `entered` ref; brain gets `enter && !entered.current`; ref set in a mount effect |
| `tests/e2e/start-with-mock.ts` | modified | mock controls `hide/<id>` and `show/<id>` so a conversation can arrive after page load |
| `tests/e2e/new-hire-reenters.spec.ts` | added test | regression test for this bug |

## Diff Highlights

```tsx
const entered = useRef(false);
const brain = useMemo(
  () => new EmployeeBrain({ grid, seat, enter: enter && !entered.current, /* … */ }),
  [grid],
);
// Set after mount, not inside the memo: StrictMode runs the memo twice on mount.
useEffect(() => void (entered.current = true), []);
```

## Tests Added or Updated

- `tests/e2e/new-hire-reenters.spec.ts › an employee who arrived this session stays seated when build mode opens`: hides an employee at page load, shows it again so it walks in from the door, waits until it is `seated`, opens Build mode, then checks for about 1.5 s that the brain stays `seated` within 0.5 m of its seat.

## Local Verification

- `npx playwright test tests/e2e/new-hire-reenters.spec.ts` with the fix → 1 passed.
- Same spec with `Employee.tsx` reverted (git stash) → failed: `Expected: "seated"`, `Received: "entering"`. The test reproduces the bug.
- `npm test` (vitest + guards) → 45 files / 321 tests passed, 6 skipped; guards OK.
- `npm run typecheck` and eslint on the changed files → clean.
- `npx playwright test build.spec.ts build-rooms.spec.ts delete-employee.spec.ts new-hire-reenters.spec.ts` → 17 passed.
- Manual check in the real app: not done.

## Deviations from Assessment

- Files outside the assessment list: `tests/e2e/start-with-mock.ts` gets two mock-only control actions. No existing control can make an employee appear after page load, and the test needs that.
- The assessment suggested setting the ref when the brain is built. It is set in a mount effect instead: the app runs under React `StrictMode` (`src/web/main.tsx`), which calls memo functions twice on mount, so setting it inside the memo would cancel the first entrance in dev.

## Follow-ups

- Open question from the assessment is still open: an employee caught mid-entrance when Build mode opens now snaps to their seat instead of continuing the walk. Same as for old employees today.
