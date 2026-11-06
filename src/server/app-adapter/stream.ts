import { Agent, request } from 'node:https';
import type { RpcTarget } from './rpc-client';

// Connect server-streaming over HTTPS+JSON (StreamAgentStateUpdates, spike T028(b)).
// Frames are 5-byte prefixed: flags (1 byte) + big-endian length (4 bytes) + JSON.

const SERVICE = 'exa.language_server_pb.LanguageServerService';
const agent = new Agent({ rejectUnauthorized: false, keepAlive: true });

export interface StreamHandle {
  close(): void;
}

export function openStream(
  target: RpcTarget,
  method: string,
  body: unknown,
  onMessage: (msg: Record<string, unknown>) => void,
  onEnd: (err?: Error) => void,
): StreamHandle {
  const json = Buffer.from(JSON.stringify(body));
  const head = Buffer.alloc(5);
  head.writeUInt32BE(json.length, 1);
  let closed = false;
  const req = request(
    {
      host: '127.0.0.1',
      port: target.port,
      method: 'POST',
      path: `/${SERVICE}/${method}`,
      agent,
      headers: {
        'content-type': 'application/connect+json',
        'connect-protocol-version': '1',
        'x-codeium-csrf-token': target.csrfToken,
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return onEnd(new Error(`${method}: HTTP ${res.statusCode}`));
      }
      let buf = Buffer.alloc(0);
      res.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 5) {
          const flags = buf[0]!;
          const len = buf.readUInt32BE(1);
          if (buf.length < 5 + len) break;
          const payload = buf.subarray(5, 5 + len).toString('utf8');
          buf = buf.subarray(5 + len);
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(payload) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (flags & 0x02) {
            // end-of-stream frame; may carry an error
            const err = msg.error as { message?: string } | undefined;
            onEnd(err ? new Error(err.message ?? 'stream error') : undefined);
            return;
          }
          if (msg.error) {
            onEnd(new Error(String((msg.error as { message?: string }).message ?? 'stream error')));
            return;
          }
          onMessage(msg);
        }
      });
      res.on('end', () => !closed && onEnd());
      res.on('error', (e) => !closed && onEnd(e));
    },
  );
  req.on('error', (e) => !closed && onEnd(e));
  req.end(Buffer.concat([head, json]));
  return {
    close() {
      closed = true;
      req.destroy();
    },
  };
}
