import type { ConnectionState, Employee, Quota, Step } from './domain';

// WebSocket messages and error codes (contracts/local-api.md).

export type WarningCode = 'APP_VERSION_UNSUPPORTED' | 'DETAIL_LOWERED';

export type ServerMessage =
  | { type: 'connection'; payload: ConnectionState }
  | { type: 'employees.snapshot'; payload: { employees: Employee[]; overflow: number } }
  | { type: 'employees.patch'; payload: { upserted: Employee[]; removed: string[]; overflow: number } }
  | { type: 'steps.append'; payload: { conversationId: string; steps: Step[] } }
  | { type: 'quota'; payload: Quota }
  | { type: 'warning'; payload: { code: WarningCode; message: string } };

export type ClientMessage =
  | { type: 'watch'; payload: { conversationId: string } }
  | { type: 'unwatch'; payload: { conversationId: string } };

export type ErrorCode =
  | 'APP_UNAVAILABLE'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_ORIGIN'
  | 'MISDIRECTED_HOST'
  | 'NOT_FOUND'
  | 'INVALID_LAYOUT'
  | 'INVALID_SEATING'
  | 'FLOOR_TOO_SMALL'
  | 'NOT_SUPPORTED'
  | 'QUESTION_NOT_PENDING'
  | 'APP_REJECTED'
  | 'OFFICE_FULL'
  | 'PROJECT_NAME_TAKEN'
  | 'AGENT_BUSY'
  | 'INTERNAL';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; /** 004 L4-1 AGENT_BUSY: which conversation of the tree is busy. */ busyId?: string; visualState?: string };
}

export const DEFAULT_PORT = 4317;
