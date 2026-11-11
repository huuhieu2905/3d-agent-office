import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { AppNotSupportedError, AppRejectedError, AppUnavailableError } from '../../app-adapter/index';
import { subtreeIds } from '../../services/employees';
import { computeVisualState } from '../../services/visual-state';
import { newConversationSchema, userInputSchema } from '../../../shared/schemas';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T064 (contracts/local-api.md). Agent-changing calls live ONLY here (FR-030, check-guards (c)).

const ID = /^[A-Za-z0-9-]{1,100}$/;
/** 004 data-model §3: states that block deleting a conversation. */
const BUSY = new Set(['working', 'thinking', 'waiting_for_boss']);

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
  if (err instanceof AppNotSupportedError) return sendError(reply, 501, 'NOT_SUPPORTED', err.message);
  throw err;
}

export const conversationRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { adapter, services, log } = deps;

  app.get<{ Params: { id: string }; Querystring: { from?: string } }>('/api/conversations/:id/steps', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    try {
      return await adapter.getSteps(req.params.id, Math.max(0, Number(req.query.from ?? 0) || 0));
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/messages', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    const body = userInputSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'invalid message');
    try {
      await adapter.sendMessage(req.params.id, body.data);
      void services.usage.sentViaOffice();
      void services.employees.refresh();
      return reply.code(202).send({});
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post('/api/conversations', async (req, reply) => {
    const body = newConversationSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'invalid conversation');
    try {
      const { deskId, ...input } = body.data;
      const res = await adapter.startConversation(input);
      if (deskId) await services.profiles.update(res.conversationId, { deskId });
      void services.usage.sentViaOffice();
      void services.employees.refresh();
      return reply.code(201).send(res);
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/cancel', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    try {
      await adapter.cancel(req.params.id);
      void services.employees.refresh();
      return reply.code(202).send({});
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/api/models', async (_req, reply) => {
    try {
      return await adapter.getModels();
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get('/api/usage', async () => ({ weeks: await services.usage.weeks() }));

  // 004 US2 (L4-1): delete a conversation — and, as the App does, all its subagents. Only after the user
  // confirmed it in the UI; refused while any conversation of the tree is busy (FR-015, re-read from the
  // App right now). Logs carry ids and outcome codes only (Constitution III).
  app.delete<{ Params: { id: string } }>('/api/conversations/:id', async (req, reply) => {
    const { id } = req.params;
    if (!ID.test(id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    if (adapter.getConnection().kind !== 'connected') return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
    try {
      const all = await adapter.listConversations();
      if (!all.some((c) => c.id === id)) return sendError(reply, 404, 'NOT_FOUND', 'conversation not found');
      const tree = subtreeIds(id, all);
      const connection = adapter.getConnection();
      for (const cid of tree) {
        const conv = all.find((c) => c.id === cid)!;
        const last = (await adapter.getSteps(cid)).at(-1) ?? null;
        const visualState = computeVisualState(conv, last, connection);
        if (BUSY.has(visualState) || conv.runStatus === 'CANCELING') {
          log.info({ id, busyId: cid, code: 'AGENT_BUSY' }, 'delete refused');
          return reply.code(409).send({ error: { code: 'AGENT_BUSY', message: 'Agent is busy — stop it first', busyId: cid, visualState } });
        }
      }
      await adapter.deleteConversation(id);
      for (const cid of tree) await services.profiles.update(cid, { deskId: null, meetingSeatId: null });
      void services.employees.refresh();
      log.info({ id, removed: tree.length, code: 'OK' }, 'conversation deleted');
      return reply.code(200).send({ removed: tree });
    } catch (err) {
      if (err instanceof AppRejectedError) {
        log.info({ id, code: 'APP_REJECTED' }, 'delete refused by the App');
        return sendError(reply, 502, 'APP_REJECTED', 'Antigravity App did not delete this conversation');
      }
      return fail(reply, err);
    }
  });
};
