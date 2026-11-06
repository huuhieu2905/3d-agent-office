import type { Project } from '../../../shared/domain';

// ListProjects {projectIds[]} + ReadProjects {ids} → {projects[{id, name}]} (spike T028(d), 2026-11-06).

type Raw = Record<string, unknown>;

const PALETTE = ['#e4572e', '#29335c', '#f3a712', '#669bbc', '#a8c686', '#8e6c8a', '#2ec4b6', '#ff9f1c', '#5d737e', '#c1121f'];

export function colorFor(id: string | null): string {
  if (!id) return '#9aa5b1';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

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
