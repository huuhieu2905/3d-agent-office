import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import { PICTURE_ID_RE } from '../../../shared/schemas';
import { picturesDir } from '../../services/pictures';
import { sendError } from '../security';
import type { RouteDeps } from './index';

// 007 US5 (contracts/local-api.md L7-2, L7-3): pictures the user hangs in frames. The browser has already
// resized and re-encoded them (no EXIF); here we only check the bytes, store them in the local data folder
// and serve them back, behind the session token like every /api route. Nothing leaves the machine.

const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
const CONTENT_TYPE = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const;

/** Do the first bytes match the declared image type? */
export function magicMatches(ext: 'webp' | 'jpg' | 'png', b: Buffer): boolean {
  if (ext === 'jpg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'png') return b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
}

export const pictureRoutes: FastifyPluginAsync<RouteDeps> = async (app, deps) => {
  // Read lazily: some route tests register a partial `services` without a data folder.
  const dir = () => picturesDir(deps.services.dataDir);
  app.addContentTypeParser(Object.keys(TYPES), { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  app.post('/api/pictures', async (req, reply) => {
    const ext = TYPES[(req.headers['content-type'] ?? '').split(';')[0]!.trim() as keyof typeof TYPES];
    const body = req.body;
    // JSON and plain text have their own parsers, so an unsupported type reaches here: refuse it as 415.
    if (!ext) return sendError(reply, 415, 'BAD_REQUEST', 'Choose a PNG, JPEG or WebP image');
    if (!Buffer.isBuffer(body) || !magicMatches(ext, body)) return sendError(reply, 400, 'BAD_REQUEST', 'The file is not a supported image');
    const id = `${randomBytes(16).toString('hex')}.${ext}`;
    await mkdir(dir(), { recursive: true, mode: 0o700 });
    await writeFile(join(dir(), id), body, { mode: 0o600 });
    return reply.code(201).send({ id });
  });

  app.get<{ Params: { id: string } }>('/api/pictures/:id', async (req, reply) => {
    const { id } = req.params;
    if (!PICTURE_ID_RE.test(id)) return sendError(reply, 400, 'BAD_REQUEST', 'Bad picture id');
    let bytes: Buffer;
    try {
      bytes = await readFile(join(dir(), id));
    } catch {
      return sendError(reply, 404, 'NOT_FOUND', 'Picture not found');
    }
    const ext = id.slice(id.lastIndexOf('.') + 1) as keyof typeof CONTENT_TYPE;
    return reply
      .header('content-type', CONTENT_TYPE[ext])
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(bytes);
  });
};
