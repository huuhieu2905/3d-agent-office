import type { Project } from '../../../shared/domain';
import { colorFor } from '../../../shared/colors';

// ListProjects {projectIds[]} + ReadProjects {ids} → {projects[{id, name}]} (spike T028(d), 2026-11-06).

type Raw = Record<string, unknown>;

const FRIENDLY: Record<string, string> = {
  'default-cli-project': 'Dự án mặc định',
  'outside-of-project': 'Ngoài dự án',
};

export function mapProjectIds(response: unknown): string[] {
  const ids = (response as Raw | null)?.projectIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

export function mapProjects(response: unknown): Project[] {
  const list = (response as Raw | null)?.projects;
  if (!Array.isArray(list)) return [];
  return (list as Raw[])
    .filter((p) => typeof p.id === 'string')
    .map((p) => {
      const id = p.id as string;
      const name = typeof p.name === 'string' && p.name ? p.name : (FRIENDLY[id] ?? id);
      return { id, name, color: colorFor(id) };
    });
}
