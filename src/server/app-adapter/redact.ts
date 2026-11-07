import { homedir, userInfo } from 'node:os';
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
]);

const HOME = homedir();
const USERNAME = userInfo().username;

export function sanitizeRaw(value: unknown, key = '', parent = ''): unknown {
  if (typeof value === 'string') {
    if (IDENTITY_KEYS.has(key) || (key === 'name' && NAME_PARENTS.has(parent))) return `<${key}>`;
    if (CONTENT_KEYS.has(key)) {
      if (key === 'argumentsJson') return '{}';
      return `<${key}:${Math.min(value.length, 9999)}>`;
    }
    let s = value.split(HOME).join('/Users/USER');
    if (USERNAME.length >= 3) s = s.split(USERNAME).join('USER');
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
