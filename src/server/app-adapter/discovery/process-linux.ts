import { readdir, readFile, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { LanguageServerProcess, ProcessFinder } from './process-finder';
import { isAppLanguageServer } from './args';

// Linux discovery reads /proc directly: no external tools, no shell (spec 005 research R1/R2).
// Never log `args` (it contains the CSRF and host-bridge tokens).

const LOOPBACK_V4 = '0100007F';
const LOOPBACK_V4_MAPPED_V6 = '0000000000000000FFFF00000100007F';
const TCP_LISTEN = '0A';

export class LinuxProcessFinder implements ProcessFinder {
  constructor(private readonly procRoot = '/proc') {}

  async findLanguageServer(): Promise<LanguageServerProcess | null> {
    for (const name of await readdir(this.procRoot)) {
      if (!/^\d+$/.test(name)) continue;
      let args: string[];
      try {
        args = (await readFile(join(this.procRoot, name, 'cmdline'), 'utf8')).split('\0').filter(Boolean);
      } catch {
        continue; // exited or not readable
      }
      if (isAppLanguageServer(args)) return { pid: Number(name), args };
    }
    return null;
  }

  async listListeningPorts(pid: number): Promise<number[]> {
    const fdDir = join(this.procRoot, String(pid), 'fd');
    let fds: string[];
    try {
      fds = await readdir(fdDir);
    } catch {
      throw new Error('Cannot read the Antigravity App process info (different user or sandboxed install?)');
    }
    const inodes = new Set<string>();
    for (const fd of fds) {
      const m = /^socket:\[(\d+)\]$/.exec(await readlink(join(fdDir, fd)).catch(() => ''));
      if (m) inodes.add(m[1]!);
    }

    const ports = new Set<number>();
    for (const file of ['tcp', 'tcp6']) {
      const text = await readFile(join(this.procRoot, 'net', file), 'utf8').catch(() => '');
      for (const line of text.split('\n').slice(1)) {
        // sl local_address rem_address st tx:rx tr:when retrnsmt uid timeout inode
        const cols = line.trim().split(/\s+/);
        if (cols.length < 10 || cols[3] !== TCP_LISTEN || !inodes.has(cols[9]!)) continue;
        const [addr, port] = cols[1]!.split(':');
        if (addr === LOOPBACK_V4 || addr === LOOPBACK_V4_MAPPED_V6) ports.add(parseInt(port!, 16));
      }
    }
    return [...ports].sort((a, b) => a - b);
  }
}
