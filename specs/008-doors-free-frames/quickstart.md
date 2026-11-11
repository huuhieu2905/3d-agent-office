# Quickstart: validate 008

## Automated

```bash
npm run typecheck && npm run lint
npm test                                   # unit/contract + guards
npm run test:e2e                           # real GPU (ANGLE/Metal)
npm run bench:fps -- --scenario rooms      # SC-007, take the 2nd run
```

New tests to look for:
- `tests/unit/doors.test.ts`: DoorBook transitions (request → open within 0.6 s, close 2 s after clear, never closes on someone in the doorway, user toggle, `blocksMove`).
- `tests/unit/employee-doors.test.ts`: a brain routed through a closed door waits, then passes; never crosses while closed; walk time through a closed door ≤ 1 s longer than through an open one.
- `tests/unit/layout-v2.test.ts`: north façade frames, behind-screen rule, 5 cm along-wall steps, height range, interval coverage across two glass pieces, 2-D overlap, 007 frames load at 1.5 m.
- `tests/e2e/build-rooms.spec.ts`: frame on the façade next to the screen; frame moved 15 cm and raised 40 cm with keys, saved and reloaded; first-person door toggle.

## Manual (`npm run dev`)

1. Build a room with an office door and a desk inside; seat an employee; exit build mode; set break interval short (`?debug=crowd` or wait). Watch: door closed → employee stops, door swings open, they pass, door closes ~2 s later (SC-001, SC-002).
2. Press `V` (first person), walk to the door: blocked while closed; aim, `E` → opens, walk through; `E` → closes; stand in the doorway and press `E` → it stays open until you step out.
3. Build mode: hang a painting on the north glass next to the wall screen (valid), then try directly behind the screen (red) (SC-004).
4. Select a photo frame on glass: `→` ×3, `↑` ×8 → 15 cm along, 40 cm up; type 1.2 in Height; Save, reload → same place (SC-005).
5. Load a data folder saved by 007 → frames unchanged, at 1.5 m (SC-006).
