// The ONLY place that names Antigravity App versions (Constitution II v2.1.1, research R3-01).
// Source code and user-facing messages read from here; docs, install script and tests may name
// versions but must change in the same commit as this list.

export interface VerifiedAppVersion {
  version: string;
  /** ISO date the read + write live checks passed on this version. */
  verifiedOn: string;
  /** Where the verification is recorded. */
  evidence: string;
}

/** Newest first. A version is added only after its fixtures and live read/write tests pass (FR-003). */
export const VERIFIED_APP_VERSIONS: readonly VerifiedAppVersion[] = [
  { version: '2.29.0', verifiedOn: '2026-11-09', evidence: 'specs/003-antigravity-2-29-compat' },
  { version: '2.24.0', verifiedOn: '2026-11-06', evidence: 'specs/001-3d-agent-office' },
];

export function isVerified(version: string): boolean {
  return VERIFIED_APP_VERSIONS.some((v) => v.version === version);
}

export function verifiedVersionList(): string[] {
  return VERIFIED_APP_VERSIONS.map((v) => v.version);
}
