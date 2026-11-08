import type { Cell, OfficeGrid } from './grid';

// 4-connected A* on the office grid with a Manhattan heuristic and a binary-heap open list (layout v2
// grids are 0.25 m, so a 40 × 40 m office has 25 600 cells). Returns the path including both ends, or
// null when unreachable. `maxNodes` bounds work on large/blocked layouts.

export function findPath(grid: Pick<OfficeGrid, 'width' | 'inside' | 'neighbours'>, from: Cell, to: Cell, maxNodes = 40_000): Cell[] | null {
  const key = (c: Cell) => c.z * grid.width + c.x;
  if (!grid.inside(from.x, from.z) || !grid.inside(to.x, to.z)) return null;
  const goal = key(to);
  const h = (c: Cell) => Math.abs(c.x - to.x) + Math.abs(c.z - to.z);

  const heap: { c: Cell; f: number }[] = [];
  const push = (n: { c: Cell; f: number }) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= heap[i]!.f) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]!.f < heap[m]!.f) m = l;
        if (r < heap.length && heap[r]!.f < heap[m]!.f) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };

  push({ c: from, f: h(from) });
  const g = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, Cell>();
  const closed = new Set<number>();
  let expanded = 0;

  while (heap.length) {
    const { c } = pop();
    const k = key(c);
    if (closed.has(k)) continue;
    closed.add(k);
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
        push({ c: n, f: cost + h(n) });
      }
    }
  }
  return null;
}
