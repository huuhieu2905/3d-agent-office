import type { WebSocket } from 'ws';
import type { ClientMessage, ServerMessage } from '../../shared/protocol';
import type { Logger } from '../log';

// Fan-out of server→client messages and per-client conversation watches (contracts/local-api.md).

export interface WatchHandler {
  /** Start pushing steps for a conversation to the given client. Returns an unsubscribe function. */
  (conversationId: string, push: (msg: ServerMessage) => void): () => void;
}

interface Client {
  socket: WebSocket;
  watches: Map<string, () => void>;
}

export class WsHub {
  private clients = new Set<Client>();
  private onConnectHandlers: ((send: (m: ServerMessage) => void) => void | Promise<void>)[] = [];
  private watchHandler: WatchHandler | null = null;

  constructor(private readonly log: Logger) {}

  /** Called for every new client, e.g. to send `connection` + `employees.snapshot`. */
  onClientConnect(handler: (send: (m: ServerMessage) => void) => void | Promise<void>): void {
    this.onConnectHandlers.push(handler);
  }

  setWatchHandler(handler: WatchHandler): void {
    this.watchHandler = handler;
  }

  get size(): number {
    return this.clients.size;
  }

  add(socket: WebSocket): void {
    const client: Client = { socket, watches: new Map() };
    this.clients.add(client);
    const send = (m: ServerMessage) => this.sendTo(client, m);

    socket.on('message', (raw: Buffer) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return;
      }
      const id = msg?.payload?.conversationId;
      if (typeof id !== 'string' || id.length > 100) return;
      if (msg.type === 'watch' && !client.watches.has(id) && this.watchHandler) {
        client.watches.set(id, this.watchHandler(id, send));
      } else if (msg.type === 'unwatch') {
        client.watches.get(id)?.();
        client.watches.delete(id);
      }
    });
    socket.on('close', () => {
      for (const stop of client.watches.values()) stop();
      this.clients.delete(client);
    });
    socket.on('error', () => socket.close());

    for (const h of this.onConnectHandlers) {
      Promise.resolve(h(send)).catch((err) => this.log.warn({ err }, 'ws connect handler failed'));
    }
  }

  broadcast(m: ServerMessage): void {
    for (const c of this.clients) this.sendTo(c, m);
  }

  private sendTo(c: Client, m: ServerMessage): void {
    if (c.socket.readyState === c.socket.OPEN) c.socket.send(JSON.stringify(m));
  }

  closeAll(): void {
    for (const c of this.clients) c.socket.close();
  }
}
