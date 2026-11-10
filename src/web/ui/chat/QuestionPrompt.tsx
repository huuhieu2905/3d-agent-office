import { useState } from 'react';
import { WRITE_IN_MAX, type AgentQuestion, type QuestionAnswer } from '@shared/domain';
import { api, ApiError } from '../../api/client';
import { Md } from './StepView';

// Spec 003 US2 (contracts/local-api.md U3-1, U3-2, U3-6): answer an agent's multiple-choice question.
// Single choice → radios; multi-select → checkboxes; "Khác" (write-in) is always offered (the App supports it).
// Single choice: "Khác" is one more radio, so a choice and a write-in never go together.
// Multi-select: "Khác" is one more checkbox and may be combined with choices.

interface Draft {
  selected: string[];
  other: boolean;
  text: string;
}

type Phase =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; text: string }
  | { kind: 'closed'; text: string };

const CLOSED_TEXT: Record<Exclude<AgentQuestion['state'], 'waiting'>, string> = {
  answered: 'This question was answered elsewhere',
  skipped: 'This question was skipped',
  canceled: 'This question was canceled',
};

const answered = (d: Draft) => d.selected.length > 0 || (d.other && d.text.trim().length > 0);

export function QuestionPrompt({
  conversationId,
  question,
  onDismiss,
}: {
  conversationId: string;
  /** Latest state from the App; when it leaves `waiting` while open, the form locks (T032/T033). */
  question: AgentQuestion;
  onDismiss: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => question.entries.map(() => ({ selected: [], other: false, text: '' })));
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' });

  // The App moved on (answered elsewhere, skipped, canceled) while this form was open.
  const closedByApp = question.state !== 'waiting' && phase.kind !== 'sent' ? CLOSED_TEXT[question.state] : null;
  const shownPhase: Phase = closedByApp ? { kind: 'closed', text: closedByApp } : phase;
  const locked = shownPhase.kind === 'sending' || shownPhase.kind === 'sent' || shownPhase.kind === 'closed';
  const canSend = !locked && drafts.every(answered);

  const update = (i: number, f: (d: Draft) => Draft) => setDrafts((all) => all.map((d, j) => (j === i ? f(d) : d)));

  async function send() {
    setPhase({ kind: 'sending' });
    const body: QuestionAnswer = {
      answers: drafts.map((d) => ({ selectedOptionIds: d.selected, ...(d.other && d.text.trim() ? { writeIn: d.text.trim() } : {}) })),
    };
    try {
      await api(`/api/conversations/${conversationId}/questions/${encodeURIComponent(question.requestId)}`, { method: 'POST', json: body });
      setPhase({ kind: 'sent' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setPhase({ kind: 'closed', text: CLOSED_TEXT.answered });
      else if (err instanceof ApiError && err.status === 422) setPhase({ kind: 'error', text: 'The App did not accept this answer. Pick one of the choices or edit your answer and send it again.' });
      else if (err instanceof ApiError && err.appUnavailable) setPhase({ kind: 'error', text: 'Not connected to the Antigravity App. Your answer is kept; send it again later.' });
      else setPhase({ kind: 'error', text: 'Could not send the answer. Try again or answer in the Antigravity App.' });
    }
  }

  return (
    <div className="permission question panel" role="dialog" aria-label="The agent is asking you" data-testid="question-prompt">
      <div className="permission-title">❓ The employee is asking you</div>
      {question.entries.map((e, i) => {
        const d = drafts[i]!;
        const name = `${question.requestId}-${i}`;
        return (
          <fieldset key={i} className="question-entry" disabled={locked}>
            <legend className="question-text">
              <Md text={e.question || '(empty question)'} />
            </legend>
            {e.options.map((o) => (
              <label key={o.id} className="question-option">
                <input
                  type={e.multiSelect ? 'checkbox' : 'radio'}
                  name={name}
                  data-testid={`question-option-${i}-${o.id}`}
                  checked={d.selected.includes(o.id)}
                  onChange={(ev) =>
                    update(i, (x) =>
                      e.multiSelect
                        ? { ...x, selected: ev.target.checked ? [...x.selected, o.id] : x.selected.filter((s) => s !== o.id) }
                        : { ...x, selected: [o.id], other: false },
                    )
                  }
                />
                <span className="question-option-text">
                  <Md text={o.text} />
                </span>
              </label>
            ))}
            <label className="question-option">
              <input
                type={e.multiSelect ? 'checkbox' : 'radio'}
                name={name}
                data-testid={`question-other-${i}`}
                checked={d.other}
                onChange={(ev) => update(i, (x) => (e.multiSelect ? { ...x, other: ev.target.checked } : { ...x, other: true, selected: [] }))}
              />
              <span>Other</span>
            </label>
            {d.other && (
              <input
                className="question-writein"
                data-testid={`question-writein-${i}`}
                aria-label={`Other answer for question ${i + 1}`}
                maxLength={WRITE_IN_MAX}
                value={d.text}
                placeholder="Type your answer"
                onChange={(ev) => update(i, (x) => ({ ...x, text: ev.target.value }))}
              />
            )}
          </fieldset>
        );
      })}
      {shownPhase.kind === 'error' && <div className="send-failed">{shownPhase.text}</div>}
      {shownPhase.kind === 'closed' && <div className="question-closed">{shownPhase.text}</div>}
      <div className="modal-actions">
        {shownPhase.kind === 'closed' || shownPhase.kind === 'sent' ? (
          <>
            {shownPhase.kind === 'sent' && <span className="muted">Sent</span>}
            <button className="btn" data-testid="question-dismiss" onClick={onDismiss}>
              Close
            </button>
          </>
        ) : (
          <button className="btn btn-primary" data-testid="question-submit" disabled={!canSend} onClick={() => void send()}>
            {shownPhase.kind === 'sending' ? 'Sending…' : 'Send'}
          </button>
        )}
      </div>
    </div>
  );
}
