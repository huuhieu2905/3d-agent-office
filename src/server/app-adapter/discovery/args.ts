// Parse the language_server command line. Never log the result (it contains the CSRF token).

export function splitArgs(commandLine: string): string[] {
  // The App passes flags without quoting; whitespace splitting is sufficient and avoids shell parsing.
  return commandLine.trim().split(/\s+/).filter(Boolean);
}

export function getFlag(args: string[], name: string): string | null {
  const long = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === long) return args[i + 1] ?? null;
    if (a.startsWith(`${long}=`)) return a.slice(long.length + 1);
  }
  return null;
}

export function isAppLanguageServer(args: string[]): boolean {
  const exe = args[0] ?? '';
  return (
    /(^|\/)language_server$/.test(exe) &&
    getFlag(args, 'app_data_dir') === 'antigravity' &&
    getFlag(args, 'subclient_type') === 'hub'
  );
}

export interface ParsedServerArgs {
  csrfToken: string;
  appVersion: string;
}

export function parseServerArgs(args: string[]): ParsedServerArgs | null {
  const csrfToken = getFlag(args, 'csrf_token');
  if (!csrfToken) return null;
  return { csrfToken, appVersion: getFlag(args, 'override_ide_version') ?? 'unknown' };
}
