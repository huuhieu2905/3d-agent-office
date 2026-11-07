import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { AppNotSupportedError, AppUnavailableError } from '../../app-adapter/index';
import { newConversationSchema, userInputSchema } from '../../../shared/schemas';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T064 (contracts/local-api.md). Agent-changing calls live ONLY here (FR-030, check-guards (c)).

const ID = /^[A-Za-z0-9-]{1,100}$/;

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
  if (err instanceof AppNotSupportedError) return sendError(reply, 501, 'NOT_SUPPORTED', err.message);
  throw err;
}

export const conversationRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { adapter, services } = deps;

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
};
