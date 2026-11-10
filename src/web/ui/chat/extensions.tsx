import { useEffect, useMemo, useRef, useState } from 'react';
import type { Command, Mention, UserInputPart } from '@shared/domain';
import { api } from '../../api/client';

// T085 `/` menu and T086 `@` menu for the Composer. Keyboard: ↑ ↓ to move, Enter/Tab to pick, Esc to close.
// A capturing keydown listener runs before the Composer's Enter-to-send and marks handled keys.

interface Props {
  conversationId: string;
  text: string;
  setText(t: string): void;
  model: string | null;
  addPart(p: UserInputPart): void;
}

interface Item {
  key: string;
  label: string;
  hint?: string;
  badge?: string;
  pick(): void;
}

function useMenuKeys(items: Item[], open: boolean, onClose: () => void) {
  const [active, setActive] = useState(0);
  const ref = useRef({ items, active, open, onClose });
  ref.current = { items, active, open, onClose };
  useEffect(() => setActive(0), [items.length, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { items, active, open, onClose } = ref.current;
      if (!open || items.length === 0) return;
      if (!(e.target instanceof HTMLTextAreaElement)) return;
      if (e.key === 'ArrowDown') setActive((a) => (a + 1) % items.length);
      else if (e.key === 'ArrowUp') setActive((a) => (a - 1 + items.length) % items.length);
      else if (e.key === 'Enter' || e.key === 'Tab') items[active]?.pick();
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return active;
}

function Menu({ title, items, active }: { title: string; items: Item[]; active: number }) {
  if (items.length === 0) return null;
  return (
    <div className="menu panel" role="listbox" aria-label={title}>
      <div className="menu-title">{title}</div>
      {items.map((it, i) => (
        <button
          key={it.key}
          role="option"
          aria-selected={i === active}
          className={`menu-item ${i === active ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            it.pick();
          }}
        >
          <span className="menu-label">{it.label}</span>
          {it.badge && <span className="menu-badge">{it.badge}</span>}
          {it.hint && <span className="menu-hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}

const commandCache = new Map<string, Promise<Command[]>>();

function SlashMenu({ text, setText, model }: Props) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const m = /^\/(\S*)$/.exec(text);
  const open = !!m && !dismissed;
  useEffect(() => {
    if (!text.startsWith('/')) setDismissed(false);
  }, [text]);
  useEffect(() => {
    if (!open || !model) return;
    let p = commandCache.get(model);
    if (!p) {
      p = api<Command[]>(`/api/commands?model=${encodeURIComponent(model)}`);
      commandCache.set(model, p);
      p.catch(() => commandCache.delete(model));
    }
    p.then(setCommands).catch(() => undefined);
  }, [open, model]);
  const q = (m?.[1] ?? '').toLowerCase();
  const items: Item[] = useMemo(
    () =>
      commands
        .filter((c) => c.name.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
        .slice(0, 12)
        .map((c) => ({
          key: c.name,
          label: `/${c.name}`,
          badge: c.kind === 'skill' ? 'skill' : c.kind === 'workflow' ? 'workflow' : 'command',
          hint: c.description?.slice(0, 80),
          pick: () => setText(`/${c.name} `),
        })),
    [commands, q, setText],
  );
  const active = useMenuKeys(items, open, () => setDismissed(true));
  return open ? <Menu title="Commands and skills" items={items} active={active} /> : null;
}

function MentionMenu({ conversationId, text, setText, addPart }: Props) {
  const [results, setResults] = useState<Mention[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const m = /(^|\s)@([^\s@]*)$/.exec(text);
  const open = !!m && !dismissed;
  const q = m?.[2] ?? '';
  useEffect(() => setDismissed(false), [q]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api<Mention[]>(`/api/conversations/${conversationId}/mentions?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 120);
    return () => clearTimeout(t);
  }, [open, q, conversationId]);
  const items: Item[] = results.slice(0, 12).map((r) => ({
    key: r.uri,
    label: r.label,
    pick: () => {
      addPart({ mention: r });
      setText(text.replace(/@[^\s@]*$/, ''));
    },
  }));
  const active = useMenuKeys(items, open, () => setDismissed(true));
  if (!open) return null;
  if (items.length === 0) return <div className="menu panel muted small">No matching files in the workspace.</div>;
  return <Menu title="Mention a file" items={items} active={active} />;
}

export function ComposerExtensions(props: Props) {
  return (
    <>
      <SlashMenu {...props} />
      <MentionMenu {...props} />
    </>
  );
}
