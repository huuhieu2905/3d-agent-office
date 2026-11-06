// Stable color per project id (FR-013).

const PALETTE = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e6c8a', '#2ec4b6', '#ff9f1c', '#5d737e', '#c1121f'];

export function colorFor(id: string | null): string {
  if (!id) return '#9aa5b1';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
