import type {
  Command,
  ConnectionState,
  Conversation,
  Mention,
  ModelOption,
  Project,
  QuestionAnswer,
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
  /** Spec 003 A3-3: answer an agent's ask_question. Only on an explicit user action (FR-011). */
  answerQuestion(conversationId: string, requestId: string, answer: QuestionAnswer): Promise<void>;
}

/** Spec 003 US4 (data-model §6): result of the read-only compatibility check. Names and counts only. */
export interface CompatReport {
  appVersion: string;
  verified: boolean;
  /** Fixture set the field diff compares against, e.g. "x.y.z"; null when none was found. */
  baseline: string | null;
  rpcs: { name: string; present: boolean }[];
  /** `contentDependent`: steps differ with what the user's conversations contain, so removals are expected. */
  fieldDiff: { rpc: string; baseline: string; added: string[]; removed: string[]; contentDependent?: boolean }[];
  unknownStepTypes: { rawType: string; count: number }[];
  scannedConversations: number;
  durationMs: number;
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

/** Spec 003 (found while verifying the target App version): the App refuses a project name that is already taken (HTTP 409). */
export class ProjectNameTakenError extends Error {
  readonly code = 'PROJECT_NAME_TAKEN';
  constructor() {
    super('A project with this name already exists');
  }
}

/** A3-3b: the question was already answered, skipped or canceled (e.g. from another window). */
export class QuestionNotPendingError extends Error {
  readonly code = 'QUESTION_NOT_PENDING';
  constructor() {
    super('The question is no longer waiting for an answer');
  }
}

/** A3-3c: the App refused the answer. The App's own message is never carried (FR-010a). */
export class AppRejectedError extends Error {
  readonly code = 'APP_REJECTED';
  constructor() {
    super('Antigravity App did not accept this answer');
  }
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
