import type { RpcTransport } from '../rpc-client';

/** Return the first port that answers a cheap read RPC over HTTPS+JSON (the App's JSON API port). */
export async function probeApiPort(
  transport: RpcTransport,
  ports: number[],
  csrfToken: string,
): Promise<number | null> {
  for (const port of ports) {
    try {
      await transport.call({ port, csrfToken }, 'GetAllWorkflows', {}, 3_000);
      return port;
    } catch {
      // gRPC-only port or not ready yet; try the next one.
    }
  }
  return null;
}
