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
  it('accepts every listed version and nothing else', () => {
    for (const v of VERIFIED_APP_VERSIONS) expect(isVerified(v.version)).toBe(true);
    expect(isVerified('2.24.0')).toBe(true);
    expect(isVerified('2.29.0')).toBe(true);
    expect(isVerified('2.30.0')).toBe(false);
    expect(isVerified('unknown')).toBe(false);
    expect(isVerified('')).toBe(false);
  });

  it('lists the newest version first', () => {
    const list = verifiedVersionList();
    expect(list).toEqual([...list].sort(semverDesc));
  });

  it('records when and where each version was verified', () => {
    for (const v of VERIFIED_APP_VERSIONS) {
      expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(v.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.evidence).toMatch(/^specs\//);
    }
  });
});
