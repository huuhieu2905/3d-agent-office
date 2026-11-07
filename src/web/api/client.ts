import type { ErrorBody } from '@shared/protocol';

// REST client for the local server (contracts/local-api.md). The session token comes from the URL hash
// printed by `npm start` (#k=...), is kept in sessionStorage, and removed from the visible URL.

const KEY = 'agent-office.session';

function readToken(): string | null {
  const m = /[#&]k=([^&]+)/.exec(location.hash);
  if (m) {
    const t = decodeURIComponent(m[1]!);
    try {
      sessionStorage.setItem(KEY, t);
    } catch {
      /* private mode */
    }
    history.replaceState(null, '', location.pathname + location.search);
    return t;
  }
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let token: string | null = typeof window !== 'undefined' ? readToken() : null;

export function getSessionToken(): string | null {
  return token;
}

export function setSessionTokenForTests(t: string): void {
  token = t;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
  get appUnavailable(): boolean {
    return this.code === 'APP_UNAVAILABLE';
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = (data as ErrorBody | undefined)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? res.statusText);
  }
  return data as T;
}
