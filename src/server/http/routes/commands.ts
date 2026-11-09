import type { FastifyPluginAsync } from 'fastify';
import { AppNotSupportedError, AppRejectedError, AppUnavailableError, QuestionNotPendingError } from '../../app-adapter/index';
import { permissionDecisionSchema, questionAnswerSchema, validateAnswer } from '../../../shared/schemas';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T083 + quota route (T090). Answering a permission is an agent-changing call → lives in routes (FR-030).

const ID = /^[A-Za-z0-9-]{1,100}$/;
const REQ = /^[A-Za-z0-9-]{1,100}:\d{1,6}:[A-Za-z]{1,40}$/;

export const commandRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { adapter, services } = deps;
  const unavailable = (reply: Parameters<typeof sendError>[0], err: unknown) => {
    if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
    if (err instanceof AppNotSupportedError) return sendError(reply, 501, 'NOT_SUPPORTED', err.message);
    throw err;
  };

  app.get<{ Querystring: { model?: string } }>('/api/commands', async (req, reply) => {
    const model = req.query.model;
    if (!model || model.length > 200) return sendError(reply, 400, 'BAD_REQUEST', 'model is required');
    try {
      return await adapter.getSlashCommands(model);
    } catch (err) {
      return unavailable(reply, err);
    }
  });

  app.get<{ Params: { id: string }; Querystring: { q?: string } }>('/api/conversations/:id/mentions', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    try {
      return await services.mentions.suggest(req.params.id, (req.query.q ?? '').slice(0, 200));
    } catch (err) {
      return unavailable(reply, err);
    }
  });

  app.post<{ Params: { id: string; requestId: string } }>('/api/conversations/:id/permissions/:requestId', async (req, reply) => {
    if (!ID.test(req.params.id) || !REQ.test(req.params.requestId)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    const body = permissionDecisionSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'decision must be allow or deny');
    try {
      await adapter.answerPermission(req.params.id, req.params.requestId, body.data.decision);
      void services.employees.refresh();
      return reply.code(202).send({});
    } catch (err) {
      return unavailable(reply, err);
    }
  });

  // Spec 003 L3-1: answering an agent's question is user-initiated (FR-011) and validated first (data-model §5).
  app.post<{ Params: { id: string; requestId: string } }>('/api/conversations/:id/questions/:requestId', async (req, reply) => {
    if (!ID.test(req.params.id) || !REQ.test(req.params.requestId) || !req.params.requestId.endsWith(':askQuestion')) {
      return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    }
    const body = questionAnswerSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'answers are malformed');
    try {
      const stepIndex = Number(req.params.requestId.split(':')[1]);
      const step = (await adapter.getSteps(req.params.id)).find((s) => s.index === stepIndex);
      if (!step?.question || step.question.requestId !== req.params.requestId) return sendError(reply, 409, 'QUESTION_NOT_PENDING', 'question not found');
      if (step.question.state !== 'waiting') return sendError(reply, 409, 'QUESTION_NOT_PENDING', 'question already answered');
      const invalid = validateAnswer(step.question, body.data);
      if (invalid) return sendError(reply, 400, 'BAD_REQUEST', invalid);
      await adapter.answerQuestion(req.params.id, req.params.requestId, body.data);
      void services.employees.refresh();
      return reply.code(202).send({});
    } catch (err) {
      if (err instanceof QuestionNotPendingError) return sendError(reply, 409, 'QUESTION_NOT_PENDING', 'question already answered');
      if (err instanceof AppRejectedError) return sendError(reply, 422, 'APP_REJECTED', 'Antigravity App did not accept this answer');
      return unavailable(reply, err);
    }
  });

  app.get('/api/quota', async (_req, reply) => {
    const q = services.quota.get() ?? (await services.quota.refresh());
    if (!q) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
    return q;
  });
};
