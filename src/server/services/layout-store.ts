import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OfficeLayout } from '../../shared/domain';
import { isLayoutV1, migrateV1toV2 } from '../../shared/layout-migrate';
import { officeLayoutSchema, officeLayoutV1Schema } from '../../shared/schemas';
import { JsonStore } from '../storage/json-store';
import { defaultLayout } from './default-layout';

// layout.json. Layout v1 files (feature 001) are migrated to v2 on first read; the original is kept
// as layout.v1.bak.json (written once, never overwritten) before the v2 file replaces it (FR-014).

type Logger = { warn(obj: unknown, msg?: string): void };

export class LayoutStore {
  private store: JsonStore<OfficeLayout>;
  private cache: OfficeLayout | null = null;

  constructor(
    private readonly dataDir: string,
    private readonly log?: Logger,
  ) {
    this.store = new JsonStore<OfficeLayout>(dataDir, {
      file: 'layout.json',
      schema: officeLayoutSchema as never,
      defaults: defaultLayout,
      migrate: (raw) => {
        if (!isLayoutV1(raw)) return raw;
        const v1 = officeLayoutV1Schema.safeParse(raw);
        return v1.success ? migrateV1toV2(v1.data) : raw;
      },
    });
  }

  get backupPath(): string {
    return join(this.dataDir, 'layout.v1.bak.json');
  }

  async get(): Promise<OfficeLayout> {
    if (this.cache) return this.cache;
    let wasV1 = false;
    try {
      wasV1 = isLayoutV1(JSON.parse(await readFile(this.store.path, 'utf8')));
    } catch {
      /* missing or unreadable: JsonStore falls back to defaults */
    }
    const layout = await this.store.read();
    if (wasV1) {
      try {
        await copyFile(this.store.path, this.backupPath, 1 /* COPYFILE_EXCL: never overwrite a backup */).catch((e: NodeJS.ErrnoException) => {
          if (e.code !== 'EEXIST') throw e;
        });
        await this.store.write(layout);
      } catch (err) {
        // Keep the office usable; the v1 file stays in place and is migrated again next time.
        this.log?.warn({ err: { code: (err as NodeJS.ErrnoException).code } }, 'layout v1 → v2 migration could not be saved');
      }
    }
    this.cache = layout;
    return layout;
  }

  async save(layout: OfficeLayout): Promise<void> {
    await this.store.write(layout);
    this.cache = layout;
  }
}
