import type { FastifyPluginAsync } from 'fastify';
import { CITIES, type City } from '../../../shared/domain';
import { settingsSchema } from '../../../shared/schemas';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// T105/T106: settings (FR-053/060/064/065) and weather for the chosen city (FR-063).

export const settingsRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  const { services } = deps;

  app.get('/api/settings', async () => services.settings.get());

  app.put('/api/settings', async (req, reply) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return sendError(reply, 400, 'BAD_REQUEST', 'Cài đặt không hợp lệ');
    await services.settings.save(parsed.data);
    return parsed.data;
  });

  app.get<{ Querystring: { city?: string } }>('/api/weather', async (req, reply) => {
    const city = req.query.city as City;
    if (!CITIES.includes(city)) return sendError(reply, 400, 'BAD_REQUEST', 'Thành phố không hỗ trợ');
    return services.weather.get(city);
  });
};
