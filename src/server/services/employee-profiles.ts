import type { EmployeeProfile, EmployeeProfilesFile } from '../../shared/domain';
import { employeeProfilesFileSchema } from '../../shared/schemas';
import { JsonStore } from '../storage/json-store';

// employees.json — appearance + assigned desk per conversation (system-owned data only).

export const APPEARANCES = [
  'worker-a',
  'worker-b',
  'worker-c',
  'worker-d',
  'worker-e',
  'worker-f',
  'worker-g',
  'worker-h',
] as const;

const RETENTION_MS = 30 * 24 * 3600_000;
/** Polls in a row a conversation must be absent before its remembered model is forgotten (FR-005). */
export const MISSING_POLLS = 3;

export function appearanceFor(conversationId: string): string {
  let h = 2166136261;
  for (let i = 0; i < conversationId.length; i++) h = Math.imul(h ^ conversationId.charCodeAt(i), 16777619) >>> 0;
  return APPEARANCES[h % APPEARANCES.length]!;
}

export class EmployeeProfiles {
  private store: JsonStore<EmployeeProfilesFile>;
  private data: EmployeeProfilesFile | null = null;
  private dirty = false;
  /** Consecutive successful polls each conversation with a remembered model was missing from. */
  private missing = new Map<string, number>();

  constructor(dataDir: string) {
    this.store = new JsonStore<EmployeeProfilesFile>(dataDir, {
      file: 'employees.json',
      schema: employeeProfilesFileSchema as never,
      defaults: () => ({ schemaVersion: 1, profiles: {} }),
    });
  }

  async load(): Promise<EmployeeProfilesFile> {
    if (!this.data) this.data = await this.store.read();
    return this.data;
  }

  async get(conversationId: string): Promise<EmployeeProfile> {
    const data = await this.load();
    let p = data.profiles[conversationId];
    if (!p) {
      p = { appearance: appearanceFor(conversationId), deskId: null, lastSeenAt: new Date().toISOString() };
      data.profiles[conversationId] = p;
      this.dirty = true;
    }
    return p;
  }

  async update(
    conversationId: string,
    patch: Partial<Pick<EmployeeProfile, 'deskId' | 'appearance' | 'meetingSeatId'>> & { preferredModel?: string | null },
    now = Date.now(),
  ): Promise<EmployeeProfile> {
    const p = await this.get(conversationId);
    if (patch.deskId !== undefined) {
      // A desk belongs to one employee: whoever had it swaps to this employee's old desk.
      const data = await this.load();
      if (patch.deskId) {
        for (const [id, other] of Object.entries(data.profiles)) {
          if (id !== conversationId && other.deskId === patch.deskId) other.deskId = p.deskId;
        }
      }
      p.deskId = patch.deskId;
    }
    if (patch.meetingSeatId !== undefined) p.meetingSeatId = patch.meetingSeatId;
    if (patch.appearance !== undefined) p.appearance = patch.appearance;
    // 002 US1: remember the model picked for this conversation (null forgets it). The profile — and so
    // the choice — is dropped with the rest of the profile when the conversation disappears (touch()).
    if (patch.preferredModel !== undefined) {
      p.preferredModel = patch.preferredModel ? { modelId: patch.preferredModel, chosenAt: new Date(now).toISOString() } : null;
    }
    this.dirty = true;
    await this.flush();
    return p;
  }

  /**
   * Apply a whole seating plan from arrange mode (002 L2-2): each listed conversation gets its desk
   * (null = lobby); anyone else still holding one of those desks is sent to the lobby, so no desk is
   * ever shared. The client already resolved swaps.
   */
  async setSeats(seating: Record<string, string | null>): Promise<void> {
    const data = await this.load();
    const claimed = new Set(Object.values(seating).filter((d): d is string => !!d));
    for (const [id, p] of Object.entries(data.profiles)) {
      if (!(id in seating) && p.deskId && claimed.has(p.deskId)) p.deskId = null;
    }
    for (const [id, deskId] of Object.entries(seating)) (await this.get(id)).deskId = deskId;
    this.dirty = true;
    await this.flush();
  }

  /**
   * 007 US3: apply meeting seats from arrange mode, like setSeats: listed conversations get their seat (null =
   * left the meeting); anyone else holding one of those seats loses it. Desks are not touched (they stay reserved).
   */
  async setMeetingSeats(seating: Record<string, string | null>): Promise<void> {
    const data = await this.load();
    const claimed = new Set(Object.values(seating).filter((d): d is string => !!d));
    for (const [id, p] of Object.entries(data.profiles)) {
      if (!(id in seating) && p.meetingSeatId && claimed.has(p.meetingSeatId)) p.meetingSeatId = null;
    }
    for (const [id, seat] of Object.entries(seating)) (await this.get(id)).meetingSeatId = seat;
    this.dirty = true;
    await this.flush();
  }

  /**
   * 002 T093 / FR-005: forget the model chosen for a conversation once the App no longer lists it —
   * after MISSING_POLLS successful polls in a row without it. An empty list is treated as an App hiccup,
   * not as "every conversation was deleted". The rest of the profile still follows the 30-day rule.
   */
  async forgetMissingModels(presentIds: string[]): Promise<void> {
    if (presentIds.length === 0) return;
    const data = await this.load();
    const present = new Set(presentIds);
    for (const [id, p] of Object.entries(data.profiles)) {
      if (!p.preferredModel) {
        this.missing.delete(id);
        continue;
      }
      if (present.has(id)) {
        this.missing.delete(id);
        continue;
      }
      const n = (this.missing.get(id) ?? 0) + 1;
      if (n >= MISSING_POLLS) {
        p.preferredModel = null;
        this.missing.delete(id);
        this.dirty = true;
      } else this.missing.set(id, n);
    }
  }

  /** Mark conversations as seen and drop profiles unseen for 30 days. */
  async touch(seenIds: string[], now = Date.now()): Promise<void> {
    const data = await this.load();
    const iso = new Date(now).toISOString();
    for (const id of seenIds) {
      const p = data.profiles[id];
      if (p) p.lastSeenAt = iso;
    }
    for (const [id, p] of Object.entries(data.profiles)) {
      if (now - Date.parse(p.lastSeenAt) > RETENTION_MS) {
        delete data.profiles[id];
        this.dirty = true;
      }
    }
  }

  async assignedDesks(): Promise<Map<string, string>> {
    const data = await this.load();
    const m = new Map<string, string>();
    for (const [id, p] of Object.entries(data.profiles)) if (p.deskId) m.set(p.deskId, id);
    return m;
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.data) return;
    this.dirty = false;
    await this.store.write(this.data);
  }
}
