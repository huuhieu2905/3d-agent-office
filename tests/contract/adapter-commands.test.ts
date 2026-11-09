import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { mapCommands } from '../../src/server/app-adapter/mappers/command';
import { mapQuota } from '../../src/server/app-adapter/mappers/quota';
import { score } from '../../src/server/services/mentions';
import { FakeFinder, FakeTransport, FIXTURE_SETS, fixture, fixtureFrom } from './helpers';

// T084 (slash commands, mentions) + T089 (quota, A8) on every recorded App fixture set (FR-006).

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

describe.each(FIXTURE_SETS)('slash commands (App %s)', (version) => {
  it('maps system commands and skills', () => {
    const cmds = mapCommands(fixtureFrom(version, 'GetSlashCommands'));
    expect(cmds.length).toBeGreaterThan(5);
    expect(cmds.filter((c) => c.kind === 'system').map((c) => c.name)).toEqual(expect.arrayContaining(['plan', 'goal', 'compact']));
    expect(cmds.some((c) => c.kind === 'skill')).toBe(true);
  });
});

describe('slash commands cache', () => {
  it('passes the model and caches per model for 60 s', async () => {
    const t = new FakeTransport();
    let calls = 0;
    t.handlers.GetSlashCommands = (b) => {
      calls++;
      expect(b).toEqual({ cascadeConfig: { plannerConfig: { planModel: 'M1' } } });
      return fixture('GetSlashCommands');
    };
    const a = createAppAdapter({ finder: new FakeFinder(), transport: t, healthIntervalMs: 60_000 });
    await a.start();
    stops.push(() => a.stop());
    await a.getSlashCommands('M1');
    await a.getSlashCommands('M1');
    expect(calls).toBe(1);
  });
});

describe('mention fuzzy score', () => {
  it('ranks name prefix < name substring < path < subsequence', () => {
    expect(score('src/app.ts', 'app')).toBe(0);
    expect(score('src/myapp.ts', 'app')).toBe(1);
    expect(score('app/x.ts', 'app')).toBe(2);
    expect(score('src/a_b_c.ts', 'abc')).toBe(3);
    expect(score('src/x.ts', 'zz')).toBe(Infinity);
  });
});

describe.each(FIXTURE_SETS)('quota (A8, FR-081) — App %s', (version) => {
  const q = mapQuota(fixtureFrom(version, 'GetUserStatus'));
  it('never contains name or email', () => {
    const s = JSON.stringify(q);
    expect(s).not.toMatch(/"(name|email)"/);
    expect(s).not.toMatch(/@/);
  });
  it('groups models sharing remaining fraction + reset time and flags low groups', () => {
    expect(q.groups.length).toBeGreaterThan(0);
    const total = q.groups.reduce((n, g) => n + g.models.length, 0);
    expect(total).toBeGreaterThan(q.groups.length);
    for (const g of q.groups) expect(g.low).toBe(g.remainingPercent < 10);
    expect(q.planName.length).toBeGreaterThan(0);
  });
  it('flags < 10 % as low', () => {
    const low = mapQuota({
      userStatus: {
        cascadeModelConfigData: {
          clientModelConfigs: [{ label: 'X', modelOrAlias: { model: 'M' }, quotaInfo: { remainingFraction: 0.05, resetTime: 't' } }],
        },
      },
    });
    expect(low.groups[0]).toMatchObject({ remainingPercent: 5, low: true });
  });
});
