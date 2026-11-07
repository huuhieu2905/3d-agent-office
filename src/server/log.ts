import pino from 'pino';

// Constitution III / FR-081: tokens, account identity and message content must never be logged.

const SENSITIVE_KEYS = [
  'csrf',
  'csrfToken',
  'csrf_token',
  'token',
  'sessionToken',
  'authorization',
  'email',
  'name',
  'text',
  'content',
  'message_text',
  'messageText',
  'userResponse',
  'response',
  'thinking',
];

const redactPaths = SENSITIVE_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`, `req.headers.${k}`]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TOKEN_FLAG_RE = /(--csrf_token[= ])\S+/g;
const HEADER_RE = /(x-codeium-csrf-token|authorization)(["']?\s*[:=]\s*["']?)(Bearer\s+)?[^\s"',}]+/gi;
const URL_TOKEN_RE = /([#?&]k=)[^&\s"']+/g;
const LONG_HEX_RE = /\b[0-9a-f]{32,}\b/gi;
const UUID_LIKE_TOKEN_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const secrets = new Set<string>();

/** Register a runtime secret (e.g. the App CSRF token) so it is scrubbed from every string. */
export function registerSecret(value: string | null | undefined): void {
  if (value && value.length >= 8) secrets.add(value);
}

export function forgetSecret(value: string | null | undefined): void {
  if (value) secrets.delete(value);
}

/** Replace anything that looks like a token or an email with [REDACTED]. */
export function redactString(input: string, opts: { uuids?: boolean } = {}): string {
  let out = input;
  for (const s of secrets) out = out.split(s).join('[REDACTED]');
  out = out
    .replace(TOKEN_FLAG_RE, '$1[REDACTED]')
    .replace(HEADER_RE, '$1$2[REDACTED]')
    .replace(URL_TOKEN_RE, '$1[REDACTED]')
    .replace(EMAIL_RE, '[REDACTED]')
    .replace(LONG_HEX_RE, '[REDACTED]');
  if (opts.uuids) out = out.replace(UUID_LIKE_TOKEN_RE, '[REDACTED]');
  return out;
}

export function createLogger(destination?: pino.DestinationStream) {
  return pino(
    {
      level: process.env.AGENT_OFFICE_LOG_LEVEL ?? 'info',
      redact: { paths: redactPaths, censor: '[REDACTED]' },
      hooks: {
        logMethod(args, method) {
          const cleaned = args.map((a) => (typeof a === 'string' ? redactString(a) : a));
          return method.apply(this, cleaned as Parameters<typeof method>);
        },
      },
      formatters: {
        log(obj) {
          // Error messages can carry upstream content (chat text, emails, tokens), so only the error's
          // type, code and where it happened are logged — never its message (FR-081, found by T119).
          const err = obj.err as { name?: string; code?: unknown; kind?: unknown; status?: unknown; statusCode?: unknown; stack?: string } | undefined;
          if (err && typeof err === 'object') {
            const at = (err.stack ?? '')
              .split('\n')
              .slice(1, 4)
              .map((l) => redactString(l.trim()))
              .join(' | ');
            return {
              ...obj,
              err: { type: err.name ?? 'Error', code: err.code, kind: err.kind, status: err.status ?? err.statusCode, at },
            };
          }
          return obj;
        },
      },
    },
    destination,
  );
}

export const log = createLogger();
export type Logger = ReturnType<typeof createLogger>;
