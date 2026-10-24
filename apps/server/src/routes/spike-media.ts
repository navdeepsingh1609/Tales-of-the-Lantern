import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const DEFAULT_DIRECTORY = fileURLToPath(
  new URL('../../../../spike-results/live/', import.meta.url),
);
const MEDIA = {
  audio: { file: 'tts-probe.wav', type: 'audio/wav' },
  video: { file: 'avatar-probe.mp4', type: 'video/mp4' },
} as const;
const EVIDENCE_FILES = {
  'tts-probe.json': 'tts',
  'avatar-probe.json': 'avatar',
  'realtime-probe.json': 'realtime',
} as const;
type MediaKind = keyof typeof MEDIA;

function parseRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (value === undefined) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match || value.includes(',')) return 'invalid';
  const start = Number(match[1]);
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2]);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= size ||
    requestedEnd < start
  )
    return 'invalid';
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export interface SpikeMediaOptions {
  directory?: string;
}

/** Register read-only access to locally generated spike artifacts; performs no provider requests. */
export function registerSpikeMedia(app: FastifyInstance, options: SpikeMediaOptions = {}): void {
  const directory = options.directory ?? DEFAULT_DIRECTORY;

  app.get<{ Params: { kind: string } }>('/api/spike-media/:kind', async (request, reply) => {
    const kind = request.params.kind;
    if (!Object.hasOwn(MEDIA, kind)) return reply.code(404).send({ error: 'not_found' });
    const media = MEDIA[kind as MediaKind];
    const path = join(directory, media.file);
    let size: number;
    try {
      const fileInfo = await stat(path);
      if (!fileInfo.isFile()) return reply.code(404).send({ error: 'not_found' });
      size = fileInfo.size;
    } catch {
      return reply.code(404).send({ error: 'not_found' });
    }
    const range = parseRange(request.headers.range, size);
    if (range === 'invalid') {
      return reply
        .code(416)
        .header('Content-Range', `bytes */${size}`)
        .header('Accept-Ranges', 'bytes')
        .send();
    }
    reply.header('Content-Type', media.type).header('Accept-Ranges', 'bytes');
    if (range) {
      const length = range.end - range.start + 1;
      return reply
        .code(206)
        .header('Content-Length', String(length))
        .header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
        .send(createReadStream(path, { start: range.start, end: range.end }));
    }
    return reply.code(200).header('Content-Length', String(size)).send(createReadStream(path));
  });

  app.get('/api/spike-evidence', async (_request, reply) => {
    const evidence: Record<string, unknown> = {};
    for (const [filename, key] of Object.entries(EVIDENCE_FILES)) {
      try {
        const info = await stat(join(directory, basename(filename)));
        if (!info.isFile()) continue;
        const value: unknown = JSON.parse(
          await readFile(join(directory, basename(filename)), 'utf8'),
        );
        evidence[key] = value;
      } catch {
        // Missing or malformed evidence is omitted; filesystem details are never exposed.
      }
    }
    return reply.code(200).send(evidence);
  });
}
