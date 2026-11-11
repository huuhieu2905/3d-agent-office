// 009 R8: who leaves the office when it is full and the boss hires someone. Shared by the server (decides)
// and the hire dialog (announces), so both follow one rule.

/** Visual states during which an employee is never sent out of the office. */
export const BUSY_STATES: readonly string[] = ['working', 'thinking', 'waiting_for_boss'];

export interface LeaverCandidate {
  id: string;
  lastActivityAt: string;
  memberSince: string | null;
  visualState: string;
}

/** The idle member inactive the longest (ties: joined earliest); null when every member is busy. */
export function pickLeaver(members: LeaverCandidate[]): string | null {
  let best: LeaverCandidate | null = null;
  for (const m of members) {
    if (BUSY_STATES.includes(m.visualState)) continue;
    const d = best ? Date.parse(m.lastActivityAt) - Date.parse(best.lastActivityAt) : -1;
    if (!best || d < 0 || (d === 0 && Date.parse(m.memberSince ?? '') < Date.parse(best.memberSince ?? ''))) best = m;
  }
  return best?.id ?? null;
}
