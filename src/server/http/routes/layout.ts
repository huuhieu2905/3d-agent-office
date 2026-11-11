import type { FastifyPluginAsync } from 'fastify';
import { layoutPutSchema, profilePatchSchema } from '../../../shared/schemas';
import { isLayoutV1, migrateV1toV2 } from '../../../shared/layout-migrate';
import { insideFloor, minFloorSize, validateLayout } from '../../../shared/layout-validation';
import type { OfficeLayout, OfficeLayoutV1 } from '../../../shared/domain';
import { findSeat } from '../../../shared/nav-core';
import { prunePictures } from '../../services/pictures';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T101: save the office layout (validated) and move employees between desks (FR-051/FR-052).

const ID = /^[A-Za-z0-9-]{1,100}$/;

export const layoutRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { services } = deps;

  app.put('/api/layout', async (req, reply) => {
    const parsed = layoutPutSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 400, 'BAD_REQUEST', 'Invalid layout format');
    // L2-2: { layout, seating? } or a bare layout; v1 bodies are migrated before validation.
    const raw = ('layout' in parsed.data ? parsed.data.layout : parsed.data) as OfficeLayout | OfficeLayoutV1;
    const layout: OfficeLayout = isLayoutV1(raw) ? migrateV1toV2(raw) : raw;
    const seating = 'layout' in parsed.data ? (parsed.data.seating ?? {}) : {};
    const meetingSeating = 'layout' in parsed.data ? (parsed.data.meetingSeating ?? {}) : {};
    // L2-2: shrinking the office below its furniture is its own error, with the items in the way.
    const saved = await services.layout.get();
    const shrank = layout.floor.width < saved.floor.width || layout.floor.depth < saved.floor.depth;
    const blockers = shrank ? layout.items.filter((i) => !insideFloor(layout, i)).map((i) => i.id) : [];
    if (blockers.length) {
      const m = minFloorSize(layout);
      return reply.code(422).send({ error: { code: 'FLOOR_TOO_SMALL', message: 'The office is smaller than the area its items occupy' }, blockers, min: { width: m.width, depth: m.depth } });
    }
    const v = validateLayout(layout);
    if (!v.ok) {
      return reply.code(422).send({
        error: { code: 'INVALID_LAYOUT', message: Object.values(v.reasons)[0] ?? 'Invalid layout' },
        invalidItems: v.invalidItems,
        reasons: v.reasons,
      });
    }
    // Seating must point at desks of this layout, one employee per desk, known conversations only.
    const deskIds = new Set(layout.items.filter((i) => i.type === 'desk').map((i) => i.id));
    const badSeats = Object.entries(seating)
      .filter(([id, desk], i, all) => {
        if (!ID.test(id) || !services.employees.conversation(id)) return true;
        if (desk === null) return false;
        return !deskIds.has(desk) || all.findIndex(([, d]) => d === desk) !== i;
      })
      .map(([id]) => id);
    // 007 L7-1: meeting seats must be `<meeting table of this layout>#<n>` in range, one employee per seat.
    const badMeeting = Object.entries(meetingSeating)
      .filter(([id, seat], i, all) => {
        if (!ID.test(id) || !services.employees.conversation(id)) return true;
        if (seat === null) return false;
        return !seat.includes('#') || !findSeat(layout, seat) || all.findIndex(([, s]) => s === seat) !== i;
      })
      .map(([id]) => id);
    if (badSeats.length || badMeeting.length) {
      return reply.code(422).send({ error: { code: 'INVALID_SEATING', message: 'Invalid seating' }, conversationIds: [...badSeats, ...badMeeting] });
    }
    await services.layout.save(layout);
    if (Object.keys(seating).length) await services.profiles.setSeats(seating);
    if (Object.keys(meetingSeating).length) await services.profiles.setMeetingSeats(meetingSeating);
    // 007 FR-018: pictures no saved frame uses any more are deleted.
    await prunePictures(services.dataDir, layout, deps.log);
    // Employees whose desk disappeared go back to the lobby; others keep their seats.
    void services.employees.refresh();
    return { layout, seating, meetingSeating };
  });

  app.put<{ Params: { conversationId: string } }>('/api/employees/:conversationId/profile', async (req, reply) => {
    if (!ID.test(req.params.conversationId)) return sendError(reply, 400, 'BAD_REQUEST', 'bad id');
    const body = profilePatchSchema.safeParse(req.body);
    if (!body.success) return sendError(reply, 400, 'BAD_REQUEST', 'invalid profile');
    // L2-3: only conversations the App knows about have a profile to change.
    if (!services.employees.conversation(req.params.conversationId)) return sendError(reply, 404, 'NOT_FOUND', 'Conversation not found');
    if (body.data.deskId) {
      const layout = await services.layout.get();
      if (!layout.items.some((i) => i.id === body.data.deskId && i.type === 'desk')) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Desk not found');
      }
    }
    const p = await services.profiles.update(req.params.conversationId, body.data);
    void services.employees.refresh();
    return p;
  });
};
