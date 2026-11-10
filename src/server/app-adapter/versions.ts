// The ONLY place that names Antigravity App versions (Constitution II v2.1.1, research R3-01).
// Source code and user-facing messages read from here; docs, install script and tests may name
// versions but must change in the same commit as this list.

export type VerifiedPlatform = 'darwin' | 'linux';

export interface VerifiedAppVersion {
  version: string;
  /** OSes the live checks passed on (Constitution II v2.2.0). Never empty. */
  platforms: readonly VerifiedPlatform[];
  /** ISO date the read + write live checks passed on this version. */
  verifiedOn: string;
  /** Where the verification is recorded. */
  evidence: string;
}

/** Newest first. A version is added only after its fixtures and live read/write tests pass (FR-003). */
export const VERIFIED_APP_VERSIONS: readonly VerifiedAppVersion[] = [
  { version: '2.29.0', platforms: ['darwin'], verifiedOn: '2026-11-09', evidence: 'specs/003-antigravity-2-29-compat' },
  { version: '2.24.0', platforms: ['darwin'], verifiedOn: '2026-11-06', evidence: 'specs/001-3d-agent-office' },
];

const onPlatform = (v: VerifiedAppVersion, platform: NodeJS.Platform): boolean =>
  (v.platforms as readonly string[]).includes(platform);

export function isVerified(version: string, platform: NodeJS.Platform = process.platform): boolean {
  return VERIFIED_APP_VERSIONS.some((v) => v.version === version && onPlatform(v, platform));
}

export function verifiedVersionList(platform: NodeJS.Platform = process.platform): string[] {
  return VERIFIED_APP_VERSIONS.filter((v) => onPlatform(v, platform)).map((v) => v.version);
}
