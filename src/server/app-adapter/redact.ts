import { createHash } from 'node:crypto';
import { homedir, tmpdir, userInfo } from 'node:os';
import { redactString } from '../log';

// Sanitize raw App JSON before it leaves the adapter for fixtures (T023). Keeps structure, drops content.

const IDENTITY_KEYS = new Set(['email', 'userName', 'displayName', 'profilePictureUrl', 'apiKey']);
/** `name` is identity only inside these parents (account, projects); command/skill names are kept. */
const NAME_PARENTS = new Set(['userStatus', 'projects', 'user', 'account', 'profile']);
const CONTENT_KEYS = new Set([
  'text',
  'userResponse',
  'response',
  'modifiedResponse',
  'thinking',
  'thinkingSignature',
  'content',
  'markdown',
  'message',
  'summary',
  'title',
  'preview',
  'combinedOutput',
  'stdout',
  'stderr',
  'argumentsJson',
  'description',
  'commandLine',
  'proposedCommandLine',
  'diff',
  // Spec 003 (A3-4): question text, error messages (may carry URLs/IPs), web-search queries, write-in answers.
  'question',
  'shortError',
  'fullError',
  'query',
  'writeInResponse',
  // Spec 005: the model prompt carries the user's global rules (<user_rules>) and the chat itself.
  'prompt',
  'systemPrompt',
]);
/** Workspace/project folders: their names say what the user works on. Hashed, so equal folders stay equal. */
const FOLDER_KEYS = new Set(['folderUri', 'workspaceFolderAbsoluteUri', 'workspaceUris']);
const FOLDER = /^(file:\/\/\/(?:Users\/USER|mnt\/MOUNT|tmp\/TMP))\/(.+?)(\/?)$/;

/** Permission grant lists (`command(...)`, `write_file(/path)`) hold the user's own commands and paths. */
const GRANT_KEYS = new Set(['allow', 'ask', 'deny']);
/** Data disks outside home (Linux /mnt/<uuid>, /media/<user>/<label>) name the machine (spec 005). */
const MOUNT = /\/(?:run\/media\/[^/\s"')]+|media\/[^/\s"')]+|mnt)\/[^/\s"')]+/g;

const HOME = homedir();
const USERNAME = userInfo().username;
/** macOS per-user temp dir (/var/folders/xx/<id>/T) identifies the account; normalise it too. */
const TMP = tmpdir().replace(/\/+$/, '');

export function sanitizeRaw(value: unknown, key = '', parent = ''): unknown {
  if (typeof value === 'string') {
    if (IDENTITY_KEYS.has(key) || (key === 'name' && NAME_PARENTS.has(parent))) return `<${key}>`;
    if (CONTENT_KEYS.has(key)) {
      if (/^<[A-Za-z]+(:\d+)?>$/.test(value)) return value; // already sanitized (re-sanitizing a fixture)
      if (key === 'argumentsJson') return '{}';
      return `<${key}:${Math.min(value.length, 9999)}>`;
    }
    if (GRANT_KEYS.has(key)) return value.replace(/\(.*\)$/s, '(<grant>)');
    let s = value.split(HOME).join('/Users/USER').replace(MOUNT, '/mnt/MOUNT');
    if (TMP.length > 4) s = s.split(TMP).join('/tmp/TMP');
    if (USERNAME.length >= 3) s = s.split(USERNAME).join('USER');
    if (FOLDER_KEYS.has(key) && !/^folder-[0-9a-f]{8}$/.test(s.match(FOLDER)?.[2] ?? '')) {
      s = s.replace(FOLDER, (_, root: string, rest: string, slash: string) =>
        `${root}/folder-${createHash('sha256').update(rest).digest('hex').slice(0, 8)}${slash}`);
    }
    return redactString(s);
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeRaw(v, key, parent));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeRaw(v, k, key);
    return out;
  }
  return value;
}

/** Drop identity fields from GetUserStatus before anything else touches it (FR-081). */
export function stripIdentity<T extends Record<string, unknown>>(userStatusResponse: T): T {
  const us = (userStatusResponse as { userStatus?: Record<string, unknown> }).userStatus;
  if (us) {
    delete us.name;
    delete us.email;
  }
  return userStatusResponse;
}
