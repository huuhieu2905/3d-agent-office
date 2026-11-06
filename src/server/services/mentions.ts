import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Mention } from '../../shared/domain';
import type { AppAdapter } from '../app-adapter/index';

// T081 / FR-028 / A9: file suggestions for `@`. Ask the App first; if it returns nothing, list files in the
// conversation's workspace ourselves (skip .git/node_modules/dist; ≤ 5 000 files; cache 30 s; ≤ 50 results).

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', '.venv', '__pycache__', '.DS_Store']);
const MAX_FILES = 5_000;
const CACHE_MS = 30_000;

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const queue = [root];
  while (queue.length && out.length < MAX_FILES) {
    const dir = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.github')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) queue.push(p);
      else if (e.isFile()) out.push(p);
      if (out.length >= MAX_FILES) break;
    }
  }
  return out;
}

/** Fuzzy score: substring in the file name wins, then in the path, then subsequence. Lower is better. */
export function score(path: string, q: string): number {
  const name = path.split('/').pop()!.toLowerCase();
  const p = path.toLowerCase();
  const query = q.toLowerCase();
  if (!query) return 10;
  if (name.startsWith(query)) return 0;
  if (name.includes(query)) return 1;
  if (p.includes(query)) return 2;
  let i = 0;
  for (const ch of p) if (ch === query[i]) i++;
  return i === query.length ? 3 : Infinity;
}

export class MentionService {
  private cache = new Map<string, { at: number; files: string[] }>();

  constructor(private readonly adapter: AppAdapter) {}

  private async files(root: string): Promise<string[]> {
    const hit = this.cache.get(root);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.files;
    const files = await listFiles(root);
    this.cache.set(root, { at: Date.now(), files });
    return files;
  }

  async suggest(conversationId: string, query: string): Promise<Mention[]> {
    const fromApp = await this.adapter.suggestMentions(conversationId, query).catch(() => []);
    if (fromApp.length) return fromApp.slice(0, 50);

    const conv = (await this.adapter.listConversations()).find((c) => c.id === conversationId);
    const roots = (conv?.workspaceUris ?? []).filter((u) => u.startsWith('file://')).map((u) => fileURLToPath(u));
    const scored: { path: string; root: string; s: number }[] = [];
    for (const root of roots) {
      for (const path of await this.files(root)) {
        const s = score(relative(root, path), query);
        if (s !== Infinity) scored.push({ path, root, s });
      }
    }
    scored.sort((a, b) => a.s - b.s || a.path.length - b.path.length);
    return scored.slice(0, 50).map(({ path, root }) => ({
      kind: 'file' as const,
      uri: pathToFileURL(path).href,
      label: relative(root, path),
    }));
  }
}
