import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LanguageServerProcess, ProcessFinder } from './process-finder';
import { isAppLanguageServer, splitArgs } from './args';

const run = promisify(execFile);

/** macOS discovery: `ps` for the process, `lsof` for listening ports. No shell is involved. */
export class DarwinProcessFinder implements ProcessFinder {
  async findLanguageServer(): Promise<LanguageServerProcess | null> {
    const { stdout } = await run('/bin/ps', ['-axww', '-o', 'pid=,args='], { maxBuffer: 16 * 1024 * 1024 });
    for (const line of stdout.split('\n')) {
      const m = /^\s*(\d+)\s+(.*)$/.exec(line);
      if (!m) continue;
      const args = splitArgs(m[2]!);
      if (isAppLanguageServer(args)) return { pid: Number(m[1]), args };
    }
    return null;
  }

  async listListeningPorts(pid: number): Promise<number[]> {
    let stdout: string;
    try {
      ({ stdout } = await run('/usr/sbin/lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN']));
    } catch (err) {
      // lsof exits 1 when nothing matches.
      stdout = (err as { stdout?: string }).stdout ?? '';
    }
    const ports = new Set<number>();
    for (const line of stdout.split('\n')) {
      const m = /\s127\.0\.0\.1:(\d+)\s+\(LISTEN\)/.exec(line);
      if (m) ports.add(Number(m[1]));
    }
    return [...ports].sort((a, b) => a - b);
  }
}
