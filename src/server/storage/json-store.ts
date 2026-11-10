import { mkdir, readFile, rename, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import envPaths from 'env-paths';
import type { ZodType } from 'zod';

// Atomic JSON persistence for system-owned data (research.md R10). Never stores chat content.

export function defaultDataDir(): string {
  if (process.env.AGENT_OFFICE_DATA_DIR) return process.env.AGENT_OFFICE_DATA_DIR;
  // macOS: ~/Library/Application Support/agent-office · Linux: ~/.local/share/agent-office (XDG_DATA_HOME)
  return envPaths('agent-office', { suffix: '' }).data;
}

export interface JsonStoreOptions<T> {
  file: string;
  schema: ZodType<T>;
  defaults: () => T;
  /** Upgrade older documents; receives the raw parsed JSON. */
  migrate?: (raw: unknown) => unknown;
}

export class JsonStore<T> {
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly opts: JsonStoreOptions<T>,
  ) {}

  get path(): string {
    return join(this.dir, this.opts.file);
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await chmod(this.dir, 0o700).catch(() => undefined);
  }

  async read(): Promise<T> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.path, 'utf8'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return this.opts.defaults();
      // Corrupt file: fall back to defaults rather than crash (keeps the office usable).
      return this.opts.defaults();
    }
    const migrated = this.opts.migrate ? this.opts.migrate(raw) : raw;
    const parsed = this.opts.schema.safeParse(migrated);
    return parsed.success ? parsed.data : this.opts.defaults();
  }

  /** Validate then write atomically (tmp file + rename). Writes are serialized. */
  async write(value: T): Promise<void> {
    const data = this.opts.schema.parse(value);
    const job = this.writing.then(async () => {
      await this.ensureDir();
      const tmp = `${this.path}.${randomBytes(6).toString('hex')}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
      await rename(tmp, this.path);
    });
    this.writing = job.catch(() => undefined);
    return job;
  }
}
