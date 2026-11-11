import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { AppUnavailableError } from '../../app-adapter/index';
import { OFFICE_LIMIT, type ProjectConversations } from '../../../shared/domain';
import { joinSchema } from '../../../shared/schemas';
import { OfficeFullError } from '../../services/employees';
import { sendError } from '../security';
import type { RouteDeps } from './index';

const ID = /^[A-Za-z0-9-]{1,100}$/;

/** 009 contracts/api.md: 409 OFFICE_FULL, shared with POST /api/conversations. */
export function officeFull(reply: FastifyReply, err: OfficeFullError) {
  return reply.code(409).send({ error: { code: 'OFFICE_FULL', message: 'The office is full', members: err.members, limit: OFFICE_LIMIT } });
}

export const employeeRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { adapter, services, log } = deps;

  app.get('/api/employees', async () => services.employees.snapshot());

  app.get('/api/layout', async () => services.layout.get());

  app.get('/api/projects', async (_req, reply) => {
    try {
      return await adapter.listProjects();
    } catch (err) {
      if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
      throw err;
    }
  });

  // 009 US1/US5: the project's top-level conversations, read from the App now (SC-002).
  app.get<{ Params: { id: string } }>('/api/projects/:id/conversations', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    try {
      const all = await adapter.listConversations();
      const conversations = [];
      for (const c of all) {
        if (c.projectId !== req.params.id || c.parentId || c.stepCount <= 0) continue;
        const inOffice = await services.employees.isMemberNow(c.id);
        conversations.push({ id: c.id, title: c.title, lastActivityAt: c.lastActivityAt, runStatus: c.runStatus, inOffice });
      }
      conversations.sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
      const body: ProjectConversations = { members: await services.employees.memberCount(), limit: OFFICE_LIMIT, conversations };
      return body;
    } catch (err) {
      if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
      throw err;
    }
  });

  // 009 US1: hire an existing conversation. Nothing is sent to the App (FR-006).
  app.post<{ Params: { id: string } }>('/api/conversations/:id/join', async (req, reply) => {
    const { id } = req.params;
    const body = joinSchema.safeParse(req.body ?? {});
    if (!ID.test(id) || !body.success) return sendError(reply, 400, 'BAD_REQUEST', 'bad request');
    try {
      const conv = (await adapter.listConversations()).find((c) => c.id === id);
      if (!conv) return sendError(reply, 404, 'NOT_FOUND', 'conversation not found');
      if (conv.parentId) return sendError(reply, 400, 'BAD_REQUEST', 'subagents cannot be hired directly');
      const res = await services.employees.admit(async () => ({ conversationId: id }), { deskId: body.data.deskId, existingId: id });
      log.info({ id, alreadyMember: res.alreadyMember, evictedId: res.evicted?.conversationId ?? null, code: 'OK' }, 'conversation joined the office');
      return res;
    } catch (err) {
      if (err instanceof OfficeFullError) {
        log.info({ id, code: 'OFFICE_FULL' }, 'join refused');
        return officeFull(reply, err);
      }
      if (err instanceof AppUnavailableError) return sendError(reply, 503, 'APP_UNAVAILABLE', 'Antigravity App is not connected');
      throw err;
    }
  });

  // 009 US4: leave the office; the App conversation is untouched (SC-006).
  app.post<{ Params: { id: string } }>('/api/conversations/:id/leave', async (req, reply) => {
    if (!ID.test(req.params.id)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    await services.profiles.setMember(req.params.id, false);
    void services.employees.refresh();
    log.info({ id: req.params.id, code: 'OK' }, 'conversation left the office');
    return {};
  });
};
