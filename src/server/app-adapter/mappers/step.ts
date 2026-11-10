import { STEP_STATUSES, type AgentQuestion, type Mention, type QuestionEntry, type Step, type StepKind, type StepStatus } from '../../../shared/domain';
import { redactString } from '../../log';

// GetCascadeTrajectorySteps → Step[] (App JSON, see recorded fixtures). Unknown step types map to `other` (A5).

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
  SEARCH_WEB: 'web_search',
  ASK_QUESTION: 'question',
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

// Spike T029/T084 (2026-11-06): a pending approval is a step with status WAITING and
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

// A2-1 (since the first verified App): the model the user picked for a turn is userInput.userConfig.plannerConfig.planModel
// (lastUserConfig as a fallback). Anything that is not a non-empty string is treated as unknown.
function requestedModel(input: Raw): string | null {
  for (const key of ['userConfig', 'lastUserConfig']) {
    const planner = ((input[key] as Raw | undefined)?.plannerConfig ?? undefined) as Raw | undefined;
    const m = str(planner?.planModel);
    if (m) return m;
  }
  return null;
}

// Spec 003 R3-04: ask_question steps. Entries live in askQuestion.questions; once answered, the App
// also keeps completedInteractions[].response.askQuestion.responses (same entry shape).
function questionEntries(list: unknown): Raw[] {
  return Array.isArray(list) ? (list as unknown[]).filter((e): e is Raw => !!e && typeof e === 'object') : [];
}

function questionFrom(raw: Raw, index: number, status: StepStatus): AgentQuestion {
  // Spike S1 (2026-11-08): while WAITING, requestedInteraction.askQuestion carries the same `questions`.
  const fromStep = questionEntries((raw.askQuestion as Raw | undefined)?.questions);
  const asked = fromStep.length
    ? fromStep
    : questionEntries(((raw.requestedInteraction as Raw | undefined)?.askQuestion as Raw | undefined)?.questions);
  const completed = Array.isArray(raw.completedInteractions) ? (raw.completedInteractions as Raw[]) : [];
  const response = (completed.at(-1)?.response as Raw | undefined)?.askQuestion as Raw | undefined;
  const answers = questionEntries(response?.responses);
  const entries: QuestionEntry[] = asked.map((q, i) => {
    const a = answers[i] ?? q;
    const options = Array.isArray(q.options)
      ? (q.options as Raw[]).filter((o) => o && typeof o === 'object').map((o) => ({ id: String(o.id ?? ''), text: typeof o.text === 'string' ? o.text : '' }))
      : [];
    const selected = Array.isArray(a.selectedOptionIds) ? (a.selectedOptionIds as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    return {
      question: typeof q.question === 'string' ? q.question : '',
      options,
      multiSelect: q.isMultiSelect === true,
      selectedOptionIds: selected,
      writeIn: str(a.writeInResponse),
    };
  });
  const skipped = asked.some((q, i) => q.skipped === true || answers[i]?.skipped === true);
  const anyAnswer = entries.some((e) => e.selectedOptionIds.length > 0 || e.writeIn);
  const state: AgentQuestion['state'] =
    status === 'DONE' ? (skipped && !anyAnswer ? 'skipped' : 'answered') : status === 'CANCELED' || status === 'ERROR' || status === 'INTERRUPTED' || status === 'HALTED' ? 'canceled' : 'waiting';
  const trajectoryId = str(((raw.metadata as Raw | undefined)?.sourceTrajectoryStepInfo as Raw | undefined)?.trajectoryId) ?? '';
  return { requestId: `${trajectoryId}:${index}:askQuestion`, state, entries };
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
    question: null,
    rawType,
    model: null,
  };

  switch (rawType) {
    case 'USER_INPUT': {
      const ui = (raw.userInput ?? {}) as Raw;
      step.text = userText(ui);
      step.mentions = mapMentions(ui.items);
      step.model = requestedModel(ui);
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
      step.file = { uri, summary: str(ca.description) ?? (uri.split('/').pop() ?? 'file change') };
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
    case 'ERROR_MESSAGE': {
      // Spec 003 R3-05: the App puts the message in errorMessage.error.shortError. Never empty.
      const err = (((raw.errorMessage as Raw | undefined)?.error ?? {}) as Raw);
      const msg = str(err.shortError) ?? str(err.userErrorMessage) ?? str(err.message);
      const id = str(err.errorId);
      step.text = msg ? redactString(msg) : `Unknown error${id ? ` (code ${id})` : ''}`;
      break;
    }
    case 'ASK_QUESTION': {
      step.question = questionFrom(raw, index, status);
      break;
    }
    case 'SEARCH_WEB': {
      step.text = str((raw.searchWeb as Raw | undefined)?.query);
      break;
    }
    default:
      break;
  }

  // R3-07: a waiting question is answered with QuestionPrompt, never as a permission (allow/deny).
  const permission = status === 'WAITING' && rawType !== 'ASK_QUESTION' ? permissionFrom(raw, index) : null;
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
