import { readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

// T081 / FR-031: folder browser for "Tạo project". Directories only, never outside the user's home
// (checked on the real path, so symlinks cannot escape), hidden folders skipped, ≤ 500 entries.

const MAX = 500;

export class FolderAccessError extends Error {}

export interface DirListing {
  path: string;
  parent: string | null;
  home: string;
  dirs: { name: string; path: string }[];
}

export class FolderService {
  private readonly home: string;
  constructor(home?: string) {
    this.home = home ?? homedir();
  }

  private async realHome(): Promise<string> {
    return realpath(this.home);
  }

  /** Resolve and verify that `p` is an existing directory inside home. */
  async resolveInsideHome(p: string | undefined): Promise<string> {
    const home = await this.realHome();
    const target = resolve(p && p.trim() ? p : home);
    let real: string;
    try {
      real = await realpath(target);
    } catch {
      throw new FolderAccessError('Folder does not exist');
    }
    if (real !== home && !real.startsWith(home + sep)) throw new FolderAccessError('Only folders inside your home folder can be chosen');
    if (!(await stat(real)).isDirectory()) throw new FolderAccessError('Not a folder');
    return real;
  }

  async list(p?: string): Promise<DirListing> {
    const home = await this.realHome();
    const dir = await this.resolveInsideHome(p);
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      throw new FolderAccessError('No permission to read this folder');
    }
    const dirs: { name: string; path: string }[] = [];
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      let isDir = e.isDirectory();
      if (!isDir && e.isSymbolicLink()) {
        try {
          const real = await realpath(join(dir, e.name));
          isDir = (real === home || real.startsWith(home + sep)) && (await stat(real)).isDirectory();
        } catch {
          isDir = false;
        }
      }
      if (isDir) dirs.push({ name: e.name, path: join(dir, e.name) });
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
    return { path: dir, parent: dir === home ? null : dirname(dir), home, dirs: dirs.slice(0, MAX) };
  }
}
