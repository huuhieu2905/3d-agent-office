import type {
  Command,
  ConnectionState,
  Conversation,
  Mention,
  ModelOption,
  Project,
  Quota,
  Step,
  UserInput,
} from '../../shared/domain';

// contracts/app-adapter.md — the only interface the rest of the server may use to reach the App.

export type Unsubscribe = () => void;

export interface AppAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  onConnectionChange(cb: (s: ConnectionState) => void): Unsubscribe;
  getConnection(): ConnectionState;

  listConversations(): Promise<Conversation[]>;
  getSteps(conversationId: string, fromIndex?: number): Promise<Step[]>;
  watchConversation(conversationId: string, cb: (steps: Step[]) => void): Unsubscribe;
  getSlashCommands(model: string): Promise<Command[]>;
  suggestMentions(conversationId: string, query: string): Promise<Mention[]>;
  getModels(): Promise<ModelOption[]>;
  getQuota(maxAgeMs?: number): Promise<Quota>;
  listProjects(): Promise<Project[]>;
  createProject(input: { name: string; folderUri: string }): Promise<Project>;

  sendMessage(conversationId: string, input: UserInput): Promise<void>;
  startConversation(input: UserInput & { projectId?: string }): Promise<{ conversationId: string }>;
  cancel(conversationId: string): Promise<void>;
  answerPermission(conversationId: string, requestId: string, decision: 'allow' | 'deny'): Promise<void>;
}

export class AppUnavailableError extends Error {
  readonly code = 'APP_UNAVAILABLE';
  constructor(message = 'Antigravity App is not connected') {
    super(message);
  }
}

export class AppProtocolError extends Error {
  readonly code = 'APP_PROTOCOL';
}

export class AppNotSupportedError extends Error {
  readonly code = 'NOT_SUPPORTED';
}

export type RpcErrorKind = 'auth' | 'unreachable' | 'protocol' | 'app';

export class RpcError extends Error {
  constructor(
    readonly kind: RpcErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
