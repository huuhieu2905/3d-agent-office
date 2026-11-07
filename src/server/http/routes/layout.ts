import type { FastifyPluginAsync } from 'fastify';
import { officeLayoutSchema, profilePatchSchema } from '../../../shared/schemas';
import { validateLayout } from '../../../shared/layout-validation';
import type { OfficeLayout } from '../../../shared/domain';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T101: save the office layout (validated) and move employees between desks (FR-051/FR-052).

const ID = /^[A-Za-z0-9-]{1,100}$/;

export const layoutRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { services } = deps;

  app.put('/api/layout', async (req, reply) => {
    const parsed = officeLayoutSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 400, 'BAD_REQUEST', 'Bố cục không đúng định dạng');
    const layout = parsed.data as OfficeLayout;
    const v = validateLayout(layout);
    if (!v.ok) {
      return reply.code(422).send({
        error: { code: 'INVALID_LAYOUT', message: Object.values(v.reasons)[0] ?? 'Bố cục không hợp lệ' },
        invalidItems: v.invalidItems,
        reasons: v.reasons,
      });
    }
    await services.layout.save(layout);
    // Employees whose desk disappeared go back to the lobby; others keep their seats.
    void services.employees.refresh();
    return layout;
  });

  app.put<{ Params: { conversationId: string } }>('/api/employees/:conversationId/profile', async (req, reply) => {
    if (!ID.test(req.params.conversationId)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    const body = profilePatchSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'invalid profile');
    if (body.data.deskId) {
      const layout = await services.layout.get();
      if (!layout.items.some((i) => i.id === body.data.deskId && i.type === 'desk')) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Không có bàn này');
      }
    }
    const p = await services.profiles.update(req.params.conversationId, body.data);
    void services.employees.refresh();
    return p;
  });
};
