import { DarwinProcessFinder } from './process-darwin';

// OS-specific process discovery sits behind this interface (Constitution VI v2.0.0):
// only macOS is implemented; Linux is deferred.

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
  throw new Error(`Platform "${platform}" is not supported yet (macOS only; Linux/Windows deferred).`);
}
