// Domain types shared by server and web (specs/001-3d-agent-office/data-model.md).
// Nothing here knows about the Antigravity App wire format (Constitution II).

export type ISODateTime = string;

// ---- Status -------------------------------------------------------------

export const RUN_STATUSES = ['IDLE', 'RUNNING', 'BUSY', 'CANCELING', 'UNKNOWN'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STEP_STATUSES = [
  'PENDING',
  'QUEUED',
  'GENERATING',
  'RUNNING',
  'WAITING',
  'DONE',
  'ERROR',
  'CANCELED',
  'INTERRUPTED',
  'HALTED',
  'CLEARED',
  'INVALID',
  'UNKNOWN',
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const VISUAL_STATES = [
  'disconnected',
  'waiting_for_boss',
  'error',
  'thinking',
  'working',
  'stopped',
  'idle',
  'unknown',
] as const;
export type VisualState = (typeof VISUAL_STATES)[number];

// ---- Conversation & steps (App data, read-only, memory only) -------------

export interface Conversation {
  id: string;
  title: string;
  projectId: string | null;
  parentId: string | null;
  runStatus: RunStatus;
  stepCount: number;
  lastActivityAt: ISODateTime;
  lastUserInputAt: ISODateTime | null;
  workspaceUris: string[];
  currentModel: string | null;
}

export const STEP_KINDS = [
  'user',
  'agent',
  'thinking',
  'tool',
  'command',
  'file_view',
  'file_change',
  'system',
  'permission_request',
  'error',
  'other',
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface ToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface Mention {
  kind: 'file' | 'directory';
  uri: string;
  label: string;
}

export interface PermissionRequest {
  requestId: string;
  description: string;
  options: string[];
}

export interface Step {
  index: number;
  kind: StepKind;
  status: StepStatus;
  createdAt: ISODateTime | null;
  text: string | null;
  thinking: string | null;
  toolCalls: ToolCall[];
  mentions: Mention[];
  command: { commandLine: string; output: string; exitCode: number | null } | null;
  file: { uri: string; summary: string } | null;
  permission: PermissionRequest | null;
  /** Raw App step type, kept only so `other` steps can be shown collapsed. */
  rawType: string;
  /** User turns only: the model the user asked for on this turn (A2-1). Null when unknown. */
  model: string | null;
}

// ---- Employees (combined) --------------------------------------------------

export type AppearanceId = string;

export interface Employee {
  conversationId: string;
  name: string;
  visualState: VisualState;
  appearance: AppearanceId;
  deskId: string | null;
  projectId: string | null;
  projectColor: string;
  isSubagent: boolean;
  parentId: string | null;
  visible: boolean;
  lastActivityAt: ISODateTime;
  /** Model the user picked for this conversation in the office (002 US1); null if never picked. */
  preferredModel: string | null;
  /** Model the conversation used last according to the App (A2-1); null when unknown. */
  currentModel: string | null;
}

export interface PreferredModel {
  modelId: string;
  chosenAt: ISODateTime;
}

export interface EmployeeProfile {
  appearance: AppearanceId;
  deskId: string | null;
  /** Model chosen for this conversation (002 data-model §1). Optional so older files still load. */
  preferredModel?: PreferredModel | null;
  /** When this conversation was last seen in the App; used for 30-day cleanup. */
  lastSeenAt: ISODateTime;
}

export interface EmployeeProfilesFile {
  schemaVersion: 1;
  profiles: Record<string, EmployeeProfile>;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  /** Folder the project is bound to (workspace of its conversations), if any. */
  folderUri: string | null;
}

// ---- Office layout (system data, persisted) ------------------------------

export const ITEM_TYPES = [
  'desk',
  'chair',
  'wall',
  'glass_wall',
  'door',
  'plant',
  'water_cooler',
  'sofa',
  'wall_screen',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Item types that can be placed in a v2 layout ('door' lives in the office shell). */
export const PLACEABLE_TYPES = ITEM_TYPES.filter((t) => t !== 'door') as Exclude<ItemType, 'door'>[];

export type Rotation = 0 | 90 | 180 | 270;

// Layout v2 (specs/002-realistic-ui-refresh/data-model.md §3). Coordinates are metres from the
// north-west corner of the floor: x grows east, z grows south. The floor is drawn centred on the origin.

export const FLOOR_MIN = 6;
export const FLOOR_MAX = 40;
export const FLOOR_STEP = 0.5;
/** Furniture position granularity (FR-007). */
export const POS_STEP = 0.05;
/** Interior walls and glass stay on the 0.5 m edge grid. */
export const WALL_STEP = 0.5;
export const DOOR_WIDTH = 1;

export interface PlacedItem {
  id: string;
  type: ItemType;
  pos: { x: number; z: number };
  rotation: Rotation;
}

export type DoorSide = 'south' | 'east' | 'west';

export interface OfficeShell {
  /** The park-facing glass façade. */
  glassSide: 'north';
  /** Main door; `offset` = metres from the west (south side) or north (east/west sides) end of that side. */
  door: { side: DoorSide; offset: number };
}

export interface OfficeLayout {
  schemaVersion: 2;
  floor: { width: number; depth: number };
  shell: OfficeShell;
  items: PlacedItem[];
}

/** Layout v1 (feature 001): 0.5 m cells, perimeter walls as items. Read only, for migration. */
export interface PlacedItemV1 {
  id: string;
  type: ItemType;
  cell: { x: number; z: number };
  rotation: Rotation;
}

export interface OfficeLayoutV1 {
  schemaVersion: 1;
  floor: { widthCells: number; depthCells: number; cellSize: 0.5 };
  items: PlacedItemV1[];
}

// ---- Quota (App data, personal info removed) ----------------------------

export interface QuotaGroup {
  key: string;
  models: { label: string; modelId: string }[];
  remainingPercent: number;
  resetAt: ISODateTime | null;
  low: boolean;
}

export interface Quota {
  planName: string;
  groups: QuotaGroup[];
  credits: {
    prompt: { available: number | null; monthly: number | null };
    flow: { available: number | null; monthly: number | null };
  };
  fetchedAt: ISODateTime;
}

export interface ModelOption {
  label: string;
  modelId: string;
  quotaGroupKey: string;
  remainingPercent: number | null;
}

// ---- Commands & input -----------------------------------------------------

export interface Command {
  name: string;
  kind: 'system' | 'skill' | 'workflow';
  description?: string;
}

export type UserInputPart = { text: string } | { mention: Mention };

export interface UserInput {
  parts: UserInputPart[];
  model: string;
}

// ---- Connection -------------------------------------------------------------

export type ConnectionState =
  | { kind: 'searching' }
  | { kind: 'connected'; appVersion: string; versionSupported: boolean }
  | { kind: 'error'; reason: 'auth' | 'protocol' | 'unreachable'; detail: string };

export const SUPPORTED_APP_VERSION = '2.24.0';

// ---- Settings & weather -------------------------------------------------------

export const CITIES = ['hanoi', 'hcmc', 'singapore', 'tokyo', 'newyork'] as const;
export type City = (typeof CITIES)[number];

export type DetailLevel = 'low' | 'medium' | 'high';

export interface Settings {
  schemaVersion: 1;
  city: City;
  theme: 'light' | 'dark';
  detailLevel: DetailLevel;
  autoLowerDetail: boolean;
  camera: 'overview' | 'first_person';
  defaultModel: string | null;
}

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog_snow';

export interface WeatherSnapshot {
  city: City;
  condition: WeatherCondition;
  isDay: boolean;
  temperatureC: number | null;
  fetchedAt: ISODateTime;
  source: 'open-meteo';
}

// ---- Usage (counts only) --------------------------------------------------------

export interface UsageFile {
  schemaVersion: 1;
  days: Record<string, { sentViaOffice: number; userInputsTotal: number }>;
}
