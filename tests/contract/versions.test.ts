import { describe, expect, it } from 'vitest';
import { isVerified, VERIFIED_APP_VERSIONS, verifiedVersionList } from '../../src/server/app-adapter/versions';

// contracts/app-adapter.md A3-1a/b (spec 003).

const semverDesc = (a: string, b: string) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i]! - pa[i]!;
  return 0;
};

describe('verified App versions', () => {
  // Platform is always explicit so these pass the same on macOS and Linux (spec 005).
  it('accepts every listed version on its platforms and nothing else', () => {
    for (const v of VERIFIED_APP_VERSIONS) for (const p of v.platforms) expect(isVerified(v.version, p)).toBe(true);
    expect(isVerified('2.24.0', 'darwin')).toBe(true);
    expect(isVerified('2.29.0', 'darwin')).toBe(true);
    expect(isVerified('2.29.0', 'linux')).toBe(false);
    expect(isVerified('2.29.1', 'linux')).toBe(true);
    expect(isVerified('2.29.1', 'darwin')).toBe(false);
    expect(isVerified('2.30.0', 'darwin')).toBe(false);
    expect(isVerified('unknown', 'darwin')).toBe(false);
    expect(isVerified('', 'darwin')).toBe(false);
  });

  it('filters the list by platform', () => {
    expect(verifiedVersionList('linux')).toEqual(['2.29.1']);
    expect(verifiedVersionList('win32')).toEqual([]);
    expect(verifiedVersionList('darwin')).toContain('2.29.0');
  });

  it('lists the newest version first', () => {
    for (const p of ['darwin', 'linux'] as const) {
      const list = verifiedVersionList(p);
      expect(list).toEqual([...list].sort(semverDesc));
    }
  });

  it('records when and where each version was verified', () => {
    for (const v of VERIFIED_APP_VERSIONS) {
      expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(v.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.evidence).toMatch(/^specs\//);
      expect(v.platforms.length).toBeGreaterThan(0);
      for (const p of v.platforms) expect(['darwin', 'linux']).toContain(p);
    }
    const versions = VERIFIED_APP_VERSIONS.map((v) => v.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});
