import type { UsageFile } from '../../shared/domain';
import { usageFileSchema } from '../../shared/schemas';
import { JsonStore } from '../storage/json-store';

// T073: counts only (SC-001/SC-006) — no content, no message or conversation ids (FR-081).

const RETENTION_DAYS = 90;

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export class UsageService {
  private store: JsonStore<UsageFile>;
  private data: UsageFile | null = null;

  constructor(dataDir: string) {
    this.store = new JsonStore<UsageFile>(dataDir, {
      file: 'usage.json',
      schema: usageFileSchema as never,
      defaults: () => ({ schemaVersion: 1, days: {} }),
    });
  }

  private async load(): Promise<UsageFile> {
    if (!this.data) this.data = await this.store.read();
    return this.data;
  }

  private async bump(field: 'sentViaOffice' | 'userInputsTotal', n: number): Promise<void> {
    if (n <= 0) return;
    const data = await this.load();
    const k = dayKey();
    const day = (data.days[k] ??= { sentViaOffice: 0, userInputsTotal: 0 });
    day[field] += n;
    const cutoff = dayKey(new Date(Date.now() - RETENTION_DAYS * 86_400_000));
    for (const d of Object.keys(data.days)) if (d < cutoff) delete data.days[d];
    await this.store.write(data);
  }

  /** A message or new conversation was sent through the office. */
  sentViaOffice(): Promise<void> {
    return this.bump('sentViaOffice', 1);
  }

  /** New USER_INPUT steps seen in the App (from any client). */
  userInputs(n: number): Promise<void> {
    return this.bump('userInputsTotal', n);
  }

  async weeks(): Promise<{ weekStart: string; sentViaOffice: number; userInputsTotal: number }[]> {
    const data = await this.load();
    const weeks = new Map<string, { sentViaOffice: number; userInputsTotal: number }>();
    for (const [d, v] of Object.entries(data.days)) {
      const date = new Date(`${d}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); // Monday
      const k = dayKey(date);
      const w = weeks.get(k) ?? { sentViaOffice: 0, userInputsTotal: 0 };
      w.sentViaOffice += v.sentViaOffice;
      w.userInputsTotal += v.userInputsTotal;
      weeks.set(k, w);
    }
    return [...weeks.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([weekStart, v]) => ({ weekStart, ...v }));
  }
}
