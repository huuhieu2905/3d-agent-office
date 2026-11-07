import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FolderAccessError, FolderService } from '../../src/server/services/folders';

let root: string;
let home: string;
let outside: string;
let svc: FolderService;

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'ao-folders-')));
  home = join(root, 'home');
  outside = join(root, 'outside');
  await mkdir(join(home, 'code', 'app'), { recursive: true });
  await mkdir(join(home, '.secret'), { recursive: true });
  await mkdir(join(home, 'Documents'));
  await writeFile(join(home, 'notes.txt'), 'x');
  await mkdir(outside);
  await symlink(outside, join(home, 'escape'));
  svc = new FolderService(home);
});
afterAll(() => rm(root, { recursive: true, force: true }));

describe('FolderService (FR-031)', () => {
  it('lists only visible directories of home by default', async () => {
    const l = await svc.list();
    expect(l.path).toBe(home);
    expect(l.parent).toBeNull();
    expect(l.dirs.map((d) => d.name)).toEqual(['code', 'Documents']);
  });

  it('navigates into sub-folders and reports the parent', async () => {
    const l = await svc.list(join(home, 'code'));
    expect(l.dirs.map((d) => d.name)).toEqual(['app']);
    expect(l.parent).toBe(home);
  });

  it('refuses paths outside home, including via ../ and symlinks', async () => {
    await expect(svc.list(root)).rejects.toBeInstanceOf(FolderAccessError);
    await expect(svc.list(join(home, '..', 'outside'))).rejects.toBeInstanceOf(FolderAccessError);
    await expect(svc.list(join(home, 'escape'))).rejects.toBeInstanceOf(FolderAccessError);
    await expect(svc.resolveInsideHome(join(home, 'notes.txt'))).rejects.toBeInstanceOf(FolderAccessError);
    await expect(svc.resolveInsideHome(join(home, 'missing'))).rejects.toBeInstanceOf(FolderAccessError);
  });
});
