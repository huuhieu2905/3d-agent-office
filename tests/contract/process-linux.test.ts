import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LinuxProcessFinder } from '../../src/server/app-adapter/discovery/process-linux';
import { createProcessFinder } from '../../src/server/app-adapter/discovery/process-finder';

// spec 005 contracts/process-finder.md, on a fake /proc tree (runs on macOS too, FR-016).

const APP_PID = 20190;
const APP_ARGS = [
  '/opt/Antigravity/resources/bin/language_server', '--standalone', '--override_ide_name', 'antigravity',
  '--subclient_type', 'hub', '--override_ide_version', '9.9.9', '--https_server_port', '0',
  '--csrf_token', 'FAKE', '--app_data_dir', 'antigravity', '--enable_sidecars',
  '--host_bridge_url=http://127.0.0.1:44665/', '--host_bridge_token=FAKE',
];
const HEADER = '  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode';
const row = (local: string, st: string, inode: number) =>
  `   0: ${local} 00000000:0000 ${st} 00000000:00000000 00:00000000 00000000  1000        0 ${inode} 1 0000000000000000 100 0 0 10 0`;

let root: string;
let lockedFd: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'proc-'));
  const proc = async (pid: number, args: string[] | null, sockets: number[] = []) => {
    const dir = join(root, String(pid));
    await mkdir(join(dir, 'fd'), { recursive: true });
    if (args) await writeFile(join(dir, 'cmdline'), args.join('\0') + '\0');
    for (const [i, inode] of sockets.entries()) await symlink(`socket:[${inode}]`, join(dir, 'fd', String(10 + i)));
  };
  await proc(100, ['/usr/bin/bash']); // unrelated
  await proc(150, null); // no cmdline: skipped
  await proc(200, APP_ARGS.filter((a) => a !== '--subclient_type' && a !== 'hub'), [9001]); // IDE server
  await proc(APP_PID, APP_ARGS, [111, 222, 333, 444, 555]);
  await symlink('/dev/null', join(root, String(APP_PID), 'fd', '3'));
  await proc(300, ['/usr/bin/other']);
  lockedFd = join(root, '300', 'fd');
  await chmod(lockedFd, 0o000);
  await mkdir(join(root, 'net'));
  await writeFile(join(root, 'net', 'tcp'), [
    HEADER,
    row('0100007F:9371', '0A', 111), // 37745
    row('0100007F:932B', '0A', 222), // 37675
    row('0100007F:9A85', '0A', 333), // 39557
    row('00000000:1F90', '0A', 444), // 0.0.0.0 → ignored
    row('0100007F:1F91', '01', 555), // ESTABLISHED → ignored
    row('0100007F:1F92', '0A', 9001), // other process → ignored
  ].join('\n'));
  await writeFile(join(root, 'net', 'tcp6'), HEADER + '\n');
});

afterAll(async () => {
  await chmod(lockedFd, 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

describe('LinuxProcessFinder', () => {
  it('finds the App language server, not the IDE one', async () => {
    const found = await new LinuxProcessFinder(root).findLanguageServer();
    expect(found?.pid).toBe(APP_PID);
    expect(found?.args).toEqual(APP_ARGS);
  });

  it('lists only the loopback LISTEN ports owned by the process, ascending', async () => {
    expect(await new LinuxProcessFinder(root).listListeningPorts(APP_PID)).toEqual([0x932b, 0x9371, 0x9a85]);
  });

  it('returns no ports for a process with no sockets', async () => {
    expect(await new LinuxProcessFinder(root).listListeningPorts(100)).toEqual([]);
  });

  it.skipIf(process.getuid?.() === 0)('explains an unreadable fd dir without naming the pid', async () => {
    const err = await new LinuxProcessFinder(root).listListeningPorts(300).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Cannot read the Antigravity App process info (different user or sandboxed install?)');
    expect((err as Error).message).not.toContain('300');
  });

  it('throws when /proc itself is missing', async () => {
    await expect(new LinuxProcessFinder(join(root, 'nope')).findLanguageServer()).rejects.toThrow();
  });
});

describe('createProcessFinder', () => {
  it('picks the Linux finder on linux', () => {
    expect(createProcessFinder('linux')).toBeInstanceOf(LinuxProcessFinder);
  });

  it('names the supported OSes otherwise', () => {
    expect(() => createProcessFinder('win32')).toThrow(/macOS, Linux/);
  });
});
