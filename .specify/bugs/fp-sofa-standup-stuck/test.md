# Bug Verification: First person — can't move after standing up from the sofa

- **Slug**: fp-sofa-standup-stuck
- **Tested**: 2026-11-10
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

Reproduced the bug end-to-end in the real app on the pre-fix commit (0.00 m moved after standing up); with the fix, the user walks ~2.2 m in 1 s after every way of standing up. No regressions in unit, type-check, lint or the first-person e2e suite.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (pre-fix, baseline) | temp Playwright spec on `HEAD` in a scratch git worktree | fail (as expected) | sit → E → hold W 1 s: moved 0.00 m |
| Reproduction (post-fix) | same temp spec on the working tree | pass | sit+E 2.24 m, sit+W 2.20 m, lie+E 2.20 m |
| New / updated tests | `npx vitest run tests/unit/fp-motion.test.ts` | pass | 8 passed |
| Regression suite | `npm test` (vitest + check-guards) | pass | 255 passed, 4 skipped; guards OK |
| First-person e2e | `npx playwright test tests/e2e/first-person.spec.ts` | pass | 5 passed |
| Lint / type-check | `npm run typecheck`; `npx eslint src/web/scene/cameras tests/unit/fp-motion.test.ts` | pass | no output |

The temporary repro spec and scratch worktree were removed after the run; no source files were changed by this step.

## Output Excerpts

```
# pre-fix (HEAD)
REPRO sit+E: moved 0.00 m with W for 1 s
    Expected: > 0.5
    Received:   0

# post-fix
REPRO sit+E: moved 2.24 m with W for 1 s
REPRO sit+W: moved 2.20 m with W for 1 s
REPRO lie+E: moved 2.20 m with W for 1 s
  1 passed (7.3s)
```

## Residual Risks

- Only the default layout's sofa (rotation 0, against the back wall) was exercised; rotated or furniture-wedged sofas rely on the 1.5 m search + `nearestWalkable` fallback.
- The e2e repro is not kept in the repo; the regression is locked by the unit test only. Adding a "walk after stand-up" assertion to `tests/e2e/first-person.spec.ts` would cover the browser path.
- The first repro attempt failed once at "sit" because E was pressed before the aim hint settled (test timing, fixed by waiting for the hint as the real spec does) — unrelated to the fix.

## Recommendation

Close the bug — verified end-to-end (reproduced pre-fix, resolved post-fix, no regressions).
