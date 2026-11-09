import type { Step } from '../../shared/domain';

// Spec 003 US4 (research R3-08, data-model §6): pure helpers behind `npm run check:compat`.
// Everything here works on key names, RPC names and counts — never on content (FR-016).

/**
 * Every LanguageServerService RPC the adapter calls (production + dev-only helpers).
 * tests/contract/compat.test.ts scans src/server/app-adapter/** and fails if a call is missing here.
 */
export const USED_RPCS = [
  // read
  'GetAllCascadeTrajectories',
  'GetCascadeTrajectorySteps',
  'GetCascadeTrajectory',
  'GetUserStatus',
  'GetSlashCommands',
  'GetAllSkills',
  'GetAllWorkflows',
  'GetAvailableModels',
  'GetMatchingContextScopeItems',
  'ListProjects',
  'ReadProjects',
  'StreamAgentStateUpdates',
  // write (user-initiated or test cleanup)
  'SendUserCascadeMessage',
  'StartCascade',
  'CancelCascadeInvocation',
  'HandleCascadeUserInteraction',
  'CreateProject',
  'DeleteProject',
  'DeleteCascadeTrajectory',
] as const;

const SERVICE_PATH = 'LanguageServerService/';

/** Which RPC names appear as `LanguageServerService/<name>` in the App's language_server binary. */
export function scanRpcNames(binary: Buffer, names: readonly string[]): { name: string; present: boolean }[] {
  return names.map((name) => ({ name, present: binary.includes(`${SERVICE_PATH}${name}`) }));
}

const ID_KEY = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/** Key paths of a JSON value: UUID / numeric keys become `*`, array items `[]`. Values are never kept. */
export function normalizedPaths(value: unknown, prefix = '', out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) normalizedPaths(v, `${prefix}[]`, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = `${prefix}.${ID_KEY.test(k) ? '*' : k}`;
      out.add(p);
      normalizedPaths(v, p, out);
    }
  }
  return out;
}

export function diffPaths(current: Set<string>, baseline: Set<string>): { added: string[]; removed: string[] } {
  return {
    added: [...current].filter((p) => !baseline.has(p)).sort(),
    removed: [...baseline].filter((p) => !current.has(p)).sort(),
  };
}

/** Raw App step types the mappers did not recognise (kind `other`), most frequent first. */
export function countUnknownStepTypes(steps: Step[]): { rawType: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of steps) if (s.kind === 'other') counts.set(s.rawType, (counts.get(s.rawType) ?? 0) + 1);
  return [...counts].map(([rawType, count]) => ({ rawType, count })).sort((a, b) => b.count - a.count || a.rawType.localeCompare(b.rawType));
}
