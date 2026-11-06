import { STEP_STATUSES, type Mention, type Step, type StepKind, type StepStatus } from '../../../shared/domain';

// GetCascadeTrajectorySteps → Step[] (App 2.24.0 JSON). Unknown step types map to `other` (A5).

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

const TYPE_MAP: Record<string, StepKind> = {
  USER_INPUT: 'user',
  PLANNER_RESPONSE: 'agent',
  RUN_COMMAND: 'command',
  VIEW_FILE: 'file_view',
  CODE_ACTION: 'file_change',
  SYSTEM_MESSAGE: 'system',
  ERROR_MESSAGE: 'error',
};

export function mapStepStatus(v: unknown): StepStatus {
  const s = typeof v === 'string' ? v.replace(/^CORTEX_STEP_STATUS_/, '') : '';
  return (STEP_STATUSES as readonly string[]).includes(s) ? (s as StepStatus) : 'UNKNOWN';
}

function mapMentions(items: unknown): Mention[] {
  if (!Array.isArray(items)) return [];
  const out: Mention[] = [];
  for (const it of items as Raw[]) {
    const file = (it?.item as Raw | undefined)?.file as Raw | undefined;
    const dir = (it?.item as Raw | undefined)?.directory as Raw | undefined;
    const uri = str(file?.absoluteUri) ?? str(dir?.absoluteUri);
    if (uri) out.push({ kind: file ? 'file' : 'directory', uri, label: uri.split('/').pop() ?? uri });
  }
  return out;
}

function userText(input: Raw): string | null {
  const items = input.items;
  if (Array.isArray(items)) {
    const parts = (items as Raw[]).map((i) => {
      if (typeof i.text === 'string') return i.text;
      const uri = str(((i.item as Raw | undefined)?.file as Raw | undefined)?.absoluteUri);
      return uri ? `@${uri.split('/').pop()}` : '';
    });
    const joined = parts.join('');
    if (joined) return joined;
  }
  return str(input.userResponse);
}

// Spike T029/T079 (2026-11-06): a pending approval is a step with status WAITING and
// `requestedInteraction.{permission|filePermission|runCommand|...}`. Answering needs the step's
// trajectoryId + stepIndex, so requestId = "<trajectoryId>:<stepIndex>:<interactionKind>".
const INTERACTION_KINDS = ['permission', 'filePermission', 'runCommand', 'approvalInteraction', 'mcp'] as const;

function permissionFrom(raw: Raw, index: number): Step['permission'] {
  const ri = raw.requestedInteraction as Raw | undefined;
  if (!ri || typeof ri !== 'object') return null;
  const kind = INTERACTION_KINDS.find((k) => ri[k] && typeof ri[k] === 'object') ?? (Object.keys(ri)[0] as string | undefined);
  if (!kind) return null;
  const p = (ri[kind] ?? {}) as Raw;
  const resource = (p.resource ?? {}) as Raw;
  const trajectoryId = str(((raw.metadata as Raw | undefined)?.sourceTrajectoryStepInfo as Raw | undefined)?.trajectoryId) ?? '';
  const what = str(p.actionDescription) ?? str(resource.action) ?? kind;
  const target = str(resource.target) ?? str(p.absolutePathUri) ?? str(p.proposedCommandLine);
  return {
    requestId: `${trajectoryId}:${index}:${kind}`,
    description: target ? `${what}: ${target}` : what,
    options: ['allow', 'deny'],
  };
}

export function mapStep(raw: Raw, index: number): Step {
  const rawType = typeof raw.type === 'string' ? raw.type.replace(/^CORTEX_STEP_TYPE_/, '') : 'UNKNOWN';
  const status = mapStepStatus(raw.status);
  const meta = (raw.metadata ?? {}) as Raw;
  let kind: StepKind = TYPE_MAP[rawType] ?? 'other';

  const step: Step = {
    index,
    kind,
    status,
    createdAt: str(meta.createdAt),
    text: null,
    thinking: null,
    toolCalls: [],
    mentions: [],
    command: null,
    file: null,
    permission: null,
    rawType,
  };

  switch (rawType) {
    case 'USER_INPUT': {
      const ui = (raw.userInput ?? {}) as Raw;
      step.text = userText(ui);
      step.mentions = mapMentions(ui.items);
      break;
    }
    case 'PLANNER_RESPONSE': {
      const pr = (raw.plannerResponse ?? {}) as Raw;
      step.text = str(pr.modifiedResponse) ?? str(pr.response);
      step.thinking = str(pr.thinking);
      step.toolCalls = Array.isArray(pr.toolCalls)
        ? (pr.toolCalls as Raw[]).map((c) => ({
            id: String(c.id ?? ''),
            name: String(c.name ?? 'tool'),
            argumentsJson: typeof c.argumentsJson === 'string' ? c.argumentsJson : '{}',
          }))
        : [];
      break;
    }
    case 'RUN_COMMAND': {
      const rc = (raw.runCommand ?? {}) as Raw;
      step.command = {
        commandLine: str(rc.commandLine) ?? str(rc.proposedCommandLine) ?? str(rc.command) ?? '',
        output: str(rc.combinedOutput) ?? str((rc.combinedOutput as Raw | undefined)?.full) ?? str(rc.stdout) ?? '',
        exitCode: typeof rc.exitCode === 'number' ? rc.exitCode : null,
      };
      break;
    }
    case 'VIEW_FILE': {
      const vf = (raw.viewFile ?? {}) as Raw;
      const uri = str(vf.absolutePathUri) ?? str(vf.absoluteUri) ?? '';
      step.file = { uri, summary: uri.split('/').pop() ?? uri };
      break;
    }
    case 'CODE_ACTION': {
      const ca = (raw.codeAction ?? {}) as Raw;
      const uri = str(ca.absolutePathUri) ?? str((ca.actionSpec as Raw | undefined)?.absoluteUri) ?? '';
      step.file = { uri, summary: str(ca.description) ?? (uri.split('/').pop() ?? 'thay đổi file') };
      break;
    }
    case 'GENERIC': {
      const g = ((raw.generic as Raw | undefined)?.args ?? {}) as Raw;
      const cl = str(g.CommandLine);
      if (cl) step.command = { commandLine: cl, output: '', exitCode: null };
      break;
    }
    case 'SYSTEM_MESSAGE': {
      const sm = (raw.systemMessage ?? {}) as Raw;
      const blocks = ((sm.renderInfo as Raw | undefined)?.contentBlocks ?? []) as Raw[];
      step.text = blocks.map((b) => str(b.markdown) ?? '').join('\n') || str(sm.message);
      break;
    }
    default:
      break;
  }

  const permission = status === 'WAITING' ? permissionFrom(raw, index) : null;
  if (permission && status === 'WAITING') {
    step.permission = permission;
    kind = 'permission_request';
    step.kind = kind;
  }
  if (status === 'ERROR' && kind === 'other') step.kind = 'error';
  return step;
}

export function mapSteps(response: unknown, fromIndex = 0): Step[] {
  const steps = (response as Raw | null)?.steps;
  if (!Array.isArray(steps)) return [];
  const out: Step[] = [];
  (steps as Raw[]).forEach((raw, i) => {
    if (i >= fromIndex) out.push(mapStep(raw ?? {}, i));
  });
  return out;
}
