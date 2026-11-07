import type { Command } from '../../../shared/domain';

// GetSlashCommands → Command[] (SLASH_COMMAND_TYPE_SYSTEM/SKILL/WORKFLOW).

type Raw = Record<string, unknown>;

export function mapCommands(response: unknown): Command[] {
  const list = (response as Raw | null)?.commands;
  if (!Array.isArray(list)) return [];
  const out: Command[] = [];
  for (const entry of list as Raw[]) {
    // App 2.24.0 wraps each command as { info: { name, type, description, ... } }.
    const c = ((entry?.info as Raw | undefined) ?? entry ?? {}) as Raw;
    if (typeof c.name !== 'string' || !c.name) continue;
    const type = String(c.type ?? '');
    const kind: Command['kind'] = type.endsWith('SKILL') ? 'skill' : type.endsWith('WORKFLOW') ? 'workflow' : 'system';
    const description = [entry?.description, entry?.title, c.description].find((d) => typeof d === 'string' && d) as string | undefined;
    out.push({ name: c.name, kind, ...(description ? { description } : {}) });
  }
  return out;
}
