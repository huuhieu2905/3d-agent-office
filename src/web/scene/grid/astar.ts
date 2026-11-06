import type { Cell, OfficeGrid } from './grid';

// 4-connected A* on the office grid with a Manhattan heuristic. Returns the path including both ends,
// or null when unreachable. `maxNodes` bounds work on large/blocked layouts.

export function findPath(grid: OfficeGrid, from: Cell, to: Cell, maxNodes = 20_000): Cell[] | null {
  const key = (c: Cell) => c.z * grid.width + c.x;
  if (!grid.inside(from.x, from.z) || !grid.inside(to.x, to.z)) return null;
  const goal = key(to);
  const h = (c: Cell) => Math.abs(c.x - to.x) + Math.abs(c.z - to.z);

  const open: { c: Cell; f: number }[] = [{ c: from, f: h(from) }];
  const g = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, Cell>();
  let expanded = 0;

  while (open.length) {
    // Small grids: a linear scan for the lowest f is fast enough and keeps this dependency-free.
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[best]!.f) best = i;
    const { c } = open.splice(best, 1)[0]!;
    const k = key(c);
    if (k === goal) {
      const path = [c];
      let cur = c;
      while (came.has(key(cur))) {
        cur = came.get(key(cur))!;
        path.push(cur);
      }
      return path.reverse();
    }
    if (++expanded > maxNodes) return null;
    for (const n of grid.neighbours(c)) {
      const nk = key(n);
      const cost = (g.get(k) ?? 0) + 1;
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, c);
        open.push({ c: n, f: cost + h(n) });
      }
    }
  }
  return null;
}
