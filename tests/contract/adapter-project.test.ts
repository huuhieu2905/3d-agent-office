import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { mapProjects } from '../../src/server/app-adapter/mappers/project';
import { FakeFinder, FakeTransport, fixture } from './helpers';

// T080 / FR-031: create a project bound to a folder (spike 2026-11-07).

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

describe('projects', () => {
  it('reads the bound folder of existing projects', () => {
    const ps = mapProjects(fixture('ReadProjects'));
    expect(ps.some((p) => p.folderUri?.startsWith('file:///'))).toBe(true);
    expect(ps.find((p) => p.id === 'default-cli-project')?.folderUri).toBeNull();
  });

  it('createProject sends a client-generated id and the folder, then reads it back', async () => {
    const t = new FakeTransport();
    let created: { id: string; name: string; projectResources: unknown } | null = null;
    t.handlers.CreateProject = (b) => {
      created = (b as { project: typeof created }).project;
      return {};
    };
    t.handlers.ReadProjects = (b) => {
      const ids = (b as { ids: string[] }).ids;
      return { projects: created && ids.includes(created.id) ? [created] : [] };
    };
    const a = createAppAdapter({ finder: new FakeFinder(), transport: t, healthIntervalMs: 60_000 });
    await a.start();
    stops.push(() => a.stop());
    const p = await a.createProject({ name: 'Dự án mới', folderUri: 'file:///Users/USER/code/app' });
    expect(created!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created!.projectResources).toEqual({ resources: [{ folderUri: 'file:///Users/USER/code/app' }] });
    expect(p).toMatchObject({ id: created!.id, name: 'Dự án mới', folderUri: 'file:///Users/USER/code/app' });
  });
});
