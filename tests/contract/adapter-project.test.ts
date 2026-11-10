import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter, ProjectNameTakenError, RpcError } from '../../src/server/app-adapter/index';
import { mapProjects } from '../../src/server/app-adapter/mappers/project';
import { FakeFinder, FakeTransport, FIXTURE_SETS, fixtureFrom } from './helpers';

// T080 / FR-031: create a project bound to a folder (spike 2026-11-07).

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

describe.each(FIXTURE_SETS)('recorded projects (App %s)', (version) => {
  it('reads the bound folder of existing projects', () => {
    const ps = mapProjects(fixtureFrom(version, 'ReadProjects'));
    expect(ps.some((p) => p.folderUri?.startsWith('file:///'))).toBe(true);
    const cli = ps.find((p) => p.id === 'default-cli-project'); // missing on a fresh Linux App (spec 005)
    if (cli) expect(cli.folderUri).toBeNull();
  });
});

describe('projects', () => {
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

  it('a duplicate project name (App 2.29.0: HTTP 409 already_exists) becomes ProjectNameTakenError', async () => {
    const t = new FakeTransport();
    t.handlers.CreateProject = () => {
      throw new RpcError('protocol', 'CreateProject: HTTP 409 (already_exists)', 409);
    };
    const a = createAppAdapter({ finder: new FakeFinder(), transport: t, healthIntervalMs: 60_000 });
    await a.start();
    stops.push(() => a.stop());
    await expect(a.createProject({ name: 'Trùng tên', folderUri: 'file:///Users/USER/code/app' })).rejects.toBeInstanceOf(ProjectNameTakenError);
  });
});
