import type { ClientMessage, ServerMessage } from '@shared/protocol';
import { getSessionToken } from './client';

// Single WebSocket to the local server with reconnect (backoff ≤ 5 s). Re-sends watches after reconnect;
// the server replies with a fresh `employees.snapshot` on every (re)connect.

type Listener = (m: ServerMessage) => void;

class Socket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private openListeners = new Set<(open: boolean) => void>();
  private watches = new Set<string>();
  private attempt = 0;
  private stopped = false;

  connect(): void {
    this.stopped = false;
    const token = getSessionToken() ?? '';
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?k=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      for (const id of this.watches) this.raw({ type: 'watch', payload: { conversationId: id } });
      for (const l of this.openListeners) l(true);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      for (const l of this.listeners) l(msg);
    };
    ws.onclose = () => {
      for (const l of this.openListeners) l(false);
      if (this.stopped) return;
      const delay = Math.min(5000, 250 * 2 ** this.attempt++);
      setTimeout(() => this.connect(), delay);
    };
  }

  close(): void {
    this.stopped = true;
    this.ws?.close();
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  onOpenChange(l: (open: boolean) => void): () => void {
    this.openListeners.add(l);
    return () => this.openListeners.delete(l);
  }

  watch(conversationId: string): void {
    this.watches.add(conversationId);
    this.raw({ type: 'watch', payload: { conversationId } });
  }

  unwatch(conversationId: string): void {
    this.watches.delete(conversationId);
    this.raw({ type: 'unwatch', payload: { conversationId } });
  }

  private raw(m: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}

export const socket = new Socket();
