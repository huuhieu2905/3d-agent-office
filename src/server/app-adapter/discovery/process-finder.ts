import { DarwinProcessFinder } from './process-darwin';
import { LinuxProcessFinder } from './process-linux';

// OS-specific process discovery sits behind this interface (Constitution VI v2.2.0):
// macOS (ps + lsof) and Linux (/proc). Windows is out of scope.

export interface LanguageServerProcess {
  pid: number;
  args: string[];
}

export interface ProcessFinder {
  findLanguageServer(): Promise<LanguageServerProcess | null>;
  listListeningPorts(pid: number): Promise<number[]>;
}

export function createProcessFinder(platform: NodeJS.Platform = process.platform): ProcessFinder {
  if (platform === 'darwin') return new DarwinProcessFinder();
  if (platform === 'linux') return new LinuxProcessFinder();
  throw new Error(`Platform "${platform}" is not supported (supported: macOS, Linux).`);
}
