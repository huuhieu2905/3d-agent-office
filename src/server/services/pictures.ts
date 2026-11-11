import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PICTURE_ID_RE } from '../../shared/schemas';
import type { OfficeLayout } from '../../shared/domain';
import type { Logger } from '../log';

// 007 US5: uploaded frame pictures live in <dataDir>/pictures (research R7-06).

export const picturesDir = (dataDir: string) => join(dataDir, 'pictures');

/** Delete stored pictures that no frame of `layout` uses (FR-018). Errors are logged, never thrown. */
export async function prunePictures(dataDir: string, layout: OfficeLayout, log?: Logger): Promise<void> {
  const used = new Set(layout.items.map((i) => i.picture).filter((p): p is string => !!p));
  try {
    for (const f of await readdir(picturesDir(dataDir))) {
      if (PICTURE_ID_RE.test(f) && !used.has(f)) await unlink(join(picturesDir(dataDir), f));
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log?.warn({ err }, 'picture cleanup failed');
  }
}

