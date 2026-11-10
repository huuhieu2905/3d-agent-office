import { useEffect, useRef } from 'react';

// 006 FR-008: Esc closes only the topmost open dialog. One capture-phase listener for all dialogs, so the newest
// one (e.g. "New project" opened from "Hire") wins regardless of mount order, and the chat panel behind it — whose
// listener checks `defaultPrevented` — stays open.
const stack: { current: () => void }[] = [];

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || stack.length === 0) return;
  e.preventDefault();
  stack[stack.length - 1]!.current();
}

/** While `active`, Esc calls `onEscape` if this is the most recently opened dialog. */
export function useEscapeToClose(onEscape: () => void, active = true): void {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    if (stack.length === 0) window.addEventListener('keydown', onKey, true);
    stack.push(entry);
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      if (stack.length === 0) window.removeEventListener('keydown', onKey, true);
    };
  }, [active]);
}
