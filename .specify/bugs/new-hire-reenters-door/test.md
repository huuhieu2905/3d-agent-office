# Bug Verification: New hire walks back in from the door on every layout change

- **Slug**: new-hire-reenters-door
- **Tested**: 2026-11-11
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The bug no longer reproduces. An employee who arrives after page load stays in their seat through entering Build mode, placing an item, and saving. Without the fix, the same steps reproduce the bug (`entering`). No regressions: the full unit and e2e suites pass.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix): enter Build mode, place an item, save | temporary spec `tests/e2e/zz-tmp-verify-place.spec.ts` (deleted after the run) | pass | New arrival walks in, sits; then Build mode → place sofa at (14.5, 6) → Save. Each step: brain stays `seated` within 0.5 m of its seat for about 1.2 s |
| Same reproduction without the fix | `Employee.tsx` stashed, same spec | fail (expected) | `Error: after entering build mode` / `Expected: "seated"` / `Received: "entering"`. The check really exercises the bug |
| New test from the fix | `npx playwright test tests/e2e/new-hire-reenters.spec.ts` | pass | Run as part of the full e2e suite |
| Unit + guards | `npm test` | pass | 45 files, 321 passed, 6 skipped; check-guards OK |
| Full e2e regression | `npx playwright test` | pass | 70 passed (5.2 min) |
| Type-check | `npm run typecheck` | pass | |
| Lint | `npm run lint` | pass | no output |
| Manual check in the real Antigravity App | not done | not-run | e2e runs against the mock App; rendering and brain logic are the same code |

## Output Excerpts

```
✓  1 tests/e2e/zz-tmp-verify-place.spec.ts:19:1 › new arrival stays seated through build, place item, save (15.2s)
✘  1 … (without fix)  Error: after entering build mode  Expected: "seated"  Received: "entering"
Test Files  45 passed | 1 skipped (46)    Tests  321 passed | 6 skipped (327)
70 passed (5.2m)
```

## Residual Risks

- The "new arrival" is simulated by hiding a mock conversation at load and showing it later, not by the real "click desk → choose employee" flow. Both paths reach the same `useEmployeeStage` → `Employee` code (an id first seen after the first snapshot).
- An employee still mid-entrance when Build mode opens snaps to their seat (assessment open question). Not covered by a test.
- Dev-mode StrictMode behaviour (first entrance still plays) was reasoned from the code, not run: e2e uses the production build.

## Recommendation

Close the bug. Verified end-to-end against the mock App: reproduction fails before the fix and passes after, with the full regression suite green. A quick manual check in the real app (hire onto a desk, open Build mode) is worth doing before release, but is not blocking.
