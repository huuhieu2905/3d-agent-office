import open from 'open';
import { createAppAdapter } from './app-adapter/index';
import { createHttpServer } from './http/app';
import { createSessionToken } from './http/security';
import { log, registerSecret } from './log';
import { createServices } from './services/index';
import { WsHub } from './http/ws-hub';

async function main() {
  const sessionToken = createSessionToken();
  registerSecret(sessionToken);

  const adapter = createAppAdapter();
  const hub = new WsHub(log);
  const services = createServices({ adapter, hub, log });
  const server = await createHttpServer({ adapter, log, sessionToken, hub, services });

  adapter.onConnectionChange((s) => {
    server.hub.broadcast({ type: 'connection', payload: s });
    if (s.kind === 'connected') {
      console.log(`Antigravity App ${s.appVersion}: connected`);
      if (!s.versionSupported) {
        // An empty list means no App version is verified on this OS yet (Constitution VI v2.2.0).
        const message = s.verifiedVersions.length
          ? `Antigravity App ${s.appVersion} chưa được kiểm chứng (đã kiểm chứng: ${s.verifiedVersions.join(', ')}). Một số tính năng có thể không hoạt động.`
          : `Antigravity App ${s.appVersion}: hệ điều hành này đang ở giai đoạn thử nghiệm, chưa có phiên bản App nào được kiểm chứng trên đây. Một số tính năng có thể không hoạt động.`;
        console.warn(message);
        server.hub.broadcast({ type: 'warning', payload: { code: 'APP_VERSION_UNSUPPORTED', message } });
      }
    } else if (s.kind === 'searching') {
      console.log('Antigravity App: not running — waiting for it to open…');
    }
  });
  server.hub.onClientConnect((send) => send({ type: 'connection', payload: adapter.getConnection() }));

  await adapter.start();
  await services.start();
  const port = await server.listen();
  const url = `http://127.0.0.1:${port}/#k=${sessionToken}`;
  // The token is printed on purpose so the user can open the page; it is never written to logs.
  console.log(`Agent Office running at ${url}`);
  if (adapter.getConnection().kind !== 'connected') console.log('Antigravity App: not running — waiting for it to open…');
  if (!process.argv.includes('--no-open')) await open(url).catch(() => undefined);

  const shutdown = async () => {
    await services.stop();
    await adapter.stop();
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  console.error(`Agent Office: ${(err as Error).message}`);
  log.error({ err }, 'failed to start');
  process.exit(1);
});
