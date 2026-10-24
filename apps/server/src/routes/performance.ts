import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ActorSchema, InlineTagTextSchema, SceneSchema, TagsSchema } from '@cut/shared';
import { verifiedDeliveryTags } from '../deliveryMetadata.js';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCENE_PATH = join(ROOT, 'content/scenes/lighthouse.json');
const DEFAULT_CACHE = join(ROOT, '.cache/performance');
const ACTOR_VOICE: Record<string, string> = { odile: 'eleanor', rocco: 'jake', pim: 'chloe' };
const SCENE = SceneSchema.parse(JSON.parse(await readFile(SCENE_PATH, 'utf8')));
for (const line of SCENE.lines) {
  if (
    !TagsSchema.safeParse(line.tags).success ||
    !InlineTagTextSchema.safeParse(line.text).success ||
    line.text.length > 300 ||
    !ACTOR_VOICE[line.actor]
  ) {
    throw new Error(`Invalid authored performance line: ${line.id}`);
  }
}
const CustomLinesSchema = z
  .array(
    z
      .object({
        actor: ActorSchema,
        text: z.string().trim().min(1).max(220).pipe(InlineTagTextSchema),
        tags: TagsSchema.max(4).default([]),
      })
      .strict(),
  )
  .min(1)
  .max(6)
  .superRefine((lines, ctx) => {
    if (lines.reduce((total, line) => total + line.text.length, 0) > 1000) {
      ctx.addIssue({ code: 'custom', message: 'Custom lines exceed 1000 characters' });
    }
    lines.forEach((line, index) => {
      const inputLength =
        line.text.length + line.tags.reduce((total, tag) => total + tag.length + 4, 0);
      if (inputLength > 300) {
        ctx.addIssue({
          code: 'custom',
          message: 'Rendered custom line exceeds 300 characters',
          path: [index],
        });
      }
    });
    const renderedTotal = lines.reduce(
      (total, line) =>
        total +
        line.text.length +
        line.tags.reduce((tagTotal, tag) => tagTotal + tag.length + 4, 0),
      0,
    );
    if (renderedTotal > 1400) {
      ctx.addIssue({ code: 'custom', message: 'Rendered custom lines exceed 1400 characters' });
    }
  });
const RequestSchema = z
  .object({
    language: z.enum(['en', 'es']).default('en'),
    avatars: z.boolean().default(false),
    referenceSet: z.enum(['portrait', 'scene']).default('portrait'),
    sceneId: z.enum(['lighthouse', 'tavern', 'observatory']).default('lighthouse'),
    framing: z.enum(['portrait', 'landscape']).default('portrait'),
    persistSnapshot: z.boolean().default(true),
    lineIds: z.array(z.string().min(1).max(80)).min(1).max(8).optional(),
    lines: CustomLinesSchema.optional(),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (request.lines && request.language !== 'en') {
      ctx.addIssue({ code: 'custom', message: 'Custom lines require English' });
    }
    if (request.framing === 'portrait' && request.sceneId !== 'lighthouse') {
      ctx.addIssue({
        code: 'custom',
        message: 'Portrait framing is available only for lighthouse',
      });
    }
    if (
      request.referenceSet === 'portrait' &&
      request.framing === 'portrait' &&
      request.sceneId !== 'lighthouse'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Portrait reference is available only for lighthouse',
      });
    }
    if (request.lines && request.lineIds) {
      ctx.addIssue({ code: 'custom', message: 'Custom lines cannot be combined with line IDs' });
    }
    if (!request.persistSnapshot && (!request.lines || request.lines.length !== 1)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Non-persisted generation requires exactly one custom line',
      });
    }
    if (request.lineIds) {
      const known = new Set(SCENE.lines.map((line) => line.id));
      if (new Set(request.lineIds).size !== request.lineIds.length) {
        ctx.addIssue({ code: 'custom', message: 'Line IDs must be unique' });
      }
      if (request.lineIds.some((id) => !known.has(id))) {
        ctx.addIssue({ code: 'custom', message: 'Unknown authored line ID' });
      }
    }
  });
const HASH = /^[a-f0-9]{64}$/;
const MEDIA_URL = /^\/api\/performance\/media\/([a-f0-9]{64})\/(audio|video)$/;
const LatestLinesSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            actor: ActorSchema,
            language: z.string().min(1).max(8),
            text: z.string().min(1).max(220),
            tags: TagsSchema.optional(),
            voice: z.string().min(1).max(40),
            audioUrl: z.string().regex(/^\/api\/performance\/media\/[a-f0-9]{64}\/audio$/),
            videoUrl: z
              .string()
              .regex(/^\/api\/performance\/media\/[a-f0-9]{64}\/video$/)
              .optional(),
            mode: z.enum(['avatar', 'audio-only']),
            cached: z.boolean(),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
const MAX_AUDIO = 3 * 1024 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
]);
const ALLOWED_HOSTS = new Set([
  '127.0.0.1:5173',
  'localhost:5173',
  '127.0.0.1:8787',
  'localhost:8787',
]);
type LineResult = {
  tags?: string[];
  id: string;
  actor: string;
  language: string;
  text: string;
  voice: string;
  audioUrl: string;
  videoUrl?: string;
  mode: 'avatar' | 'audio-only';
  cached: boolean;
};
type Job = {
  id: string;
  status: 'preparing' | 'ready' | 'partial' | 'error' | 'cancelled';
  progress: number;
  lines: LineResult[];
  error?: string;
  controller: AbortController;
};
export interface PerformanceOptions {
  apiKey?: string;
  enabled?: boolean;
  directory?: string;
  assetDirectory?: string;
  fetchImpl?: typeof fetch;
}

async function atomicWrite(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, bytes, { flag: 'wx' });
  await rename(temp, path);
}
function validWav(bytes: Buffer): boolean {
  if (
    bytes.length < 44 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WAVE'
  )
    return false;
  let offset = 12;
  let rate = 0;
  let align = 0;
  let dataSize = 0;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (size > bytes.length - start) return false;
    if (id === 'fmt ' && size >= 16) {
      align = bytes.readUInt16LE(start + 12);
      rate = bytes.readUInt32LE(start + 8);
    }
    if (id === 'data') dataSize = size;
    offset = start + size + (size % 2);
  }
  return rate > 0 && align > 0 && dataSize > 0 && dataSize / rate <= 30;
}
function validFmp4(bytes: Buffer): boolean {
  const found = new Set<string>();
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) return false;
      const big = bytes.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(big);
      header = 16;
    }
    if (size === 0) size = bytes.length - offset;
    if (size < header || size > bytes.length - offset) return false;
    found.add(type);
    offset += size;
  }
  return offset === bytes.length && found.has('ftyp') && found.has('moof') && found.has('mdat');
}
function parseRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | null | false {
  if (!value) return null;
  const m = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!m || value.includes(',')) return false;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start < size && end >= start
    ? { start, end: Math.min(end, size - 1) }
    : false;
}
async function limitedBytes(response: Response, cap: number, signal: AbortSignal): Promise<Buffer> {
  if (response.status === 429) throw new Error('provider_quota_exceeded');
  if (response.status === 401) throw new Error('provider_key_refused');
  if (!response.ok || !response.body) throw new Error('provider_request_failed');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        length += value.byteLength;
        if (length > cap) {
          await reader.cancel();
          throw new Error('provider_response_too_large');
        }
        chunks.push(Buffer.from(value));
      }
    }
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
  }
  if (!length) throw new Error('provider_empty_response');
  return Buffer.concat(chunks, length);
}

/** Explicit, bounded generation only. Registration and all GET routes are offline. */
export function registerPerformanceRoutes(
  app: FastifyInstance,
  options: PerformanceOptions = {},
): void {
  const cache = options.directory ?? DEFAULT_CACHE;
  const assets = options.assetDirectory ?? join(ROOT, 'content/characters');
  const fetcher = options.fetchImpl ?? fetch;
  let active: Job | undefined;
  let job: Job | undefined;
  let queue: Promise<void> = Promise.resolve();

  const manifest = async () => {
    const rows: unknown[] = [];
    for (const line of SCENE.lines) {
      const voice = ACTOR_VOICE[line.actor]!;
      const text = line.text;
      const audioHash = createHash('sha256')
        .update(
          JSON.stringify({
            model: 'higgs-tts-3',
            line: line.id,
            text,
            tags: line.tags,
            voice,
            language: line.lang,
          }),
        )
        .digest('hex');
      const audioPath = join(cache, audioHash, 'audio.wav');
      const portraitImage = join(assets, line.actor, 'avatar-v2.png');
      const sceneImage = join(assets, line.actor, 'avatar-scene-v1.png');
      let fingerprint = 'missing';
      try {
        fingerprint = createHash('sha256')
          .update(await readFile(portraitImage))
          .digest('hex');
      } catch {
        /* no avatar asset */
      }
      const hash = createHash('sha256')
        .update(JSON.stringify({ audioHash, avatar: 'higgs-avatar', fingerprint }))
        .digest('hex');
      const dir = join(cache, hash);
      let sceneHash: string | undefined;
      try {
        const sceneFingerprint = createHash('sha256')
          .update(await readFile(sceneImage))
          .digest('hex');
        sceneHash = createHash('sha256')
          .update(
            JSON.stringify({ audioHash, avatar: 'higgs-avatar', fingerprint: sceneFingerprint }),
          )
          .digest('hex');
      } catch {
        /* no scene reference */
      }
      let audio = false;
      let video = false;
      try {
        audio = (await stat(audioPath)).size > 0;
      } catch {
        /* cache miss */
      }
      try {
        video = (await stat(join(dir, 'video.mp4'))).size > 0;
      } catch {
        /* cache miss */
      }
      let sceneVideo = false;
      if (sceneHash) {
        try {
          const bytes = await readFile(join(cache, sceneHash, 'video.mp4'));
          sceneVideo = validFmp4(bytes);
        } catch {
          /* no valid scene video cache */
        }
      }
      rows.push({
        id: line.id,
        actor: line.actor,
        voice,
        audioHash,
        avatarHash: sceneVideo ? sceneHash : hash,
        audio,
        video: sceneVideo || video,
        mode: sceneVideo || video ? 'avatar' : 'audio-only',
      });
    }
    return rows;
  };

  app.get('/api/performance/scene', async () => ({
    id: SCENE.id,
    title: SCENE.title,
    actors: SCENE.actors,
    lines: SCENE.lines,
    cues: SCENE.cues,
    cache: await manifest(),
  }));
  app.get<{ Querystring: { sceneId?: string } }>('/api/performance/latest', async (request) => {
    const requested = z
      .enum(['lighthouse', 'tavern', 'observatory'])
      .safeParse(request.query.sceneId ?? 'lighthouse');
    if (!requested.success) return { lines: [] };
    const sceneId = requested.data;
    try {
      const path = join(cache, `latest-scene-${sceneId}.json`);
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch (error) {
        if (
          sceneId !== 'lighthouse' ||
          !(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
        )
          throw error;
        raw = await readFile(join(cache, 'latest-scene.json'), 'utf8');
      }
      const parsed = LatestLinesSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || !parsed.data.lines.length) return { lines: [] };
      for (const line of parsed.data.lines) {
        for (const url of [line.audioUrl, ...(line.videoUrl ? [line.videoUrl] : [])]) {
          const match = MEDIA_URL.exec(url);
          if (!match) return { lines: [] };
          const path = join(cache, match[1]!, match[2] === 'audio' ? 'audio.wav' : 'video.mp4');
          if ((await stat(path)).size <= 0) return { lines: [] };
        }
      }
      return {
        lines: parsed.data.lines.map((line) => {
          const tags = verifiedDeliveryTags(line);
          return tags === undefined ? line : { ...line, tags };
        }),
      };
    } catch {
      return { lines: [] };
    }
  });
  app.post('/api/performance/prepare', async (request, reply) => {
    const origin = request.headers.origin;
    const host = request.headers.host?.toLowerCase();
    if (!origin || !ALLOWED_ORIGINS.has(origin) || !host || !ALLOWED_HOSTS.has(host))
      return reply.code(403).send({ error: 'forbidden_origin' });
    if (!options.apiKey || !options.enabled)
      return reply.code(503).send({ error: 'generation_disabled' });
    const parsed = RequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });
    if (active) return reply.code(409).send({ error: 'job_in_progress', id: active.id });
    const language = parsed.data.language;
    const chosen = parsed.data.lines
      ? parsed.data.lines.map((line, index) => ({
          id: `custom-${index + 1}-${createHash('sha256')
            .update(JSON.stringify(line))
            .digest('hex')
            .slice(0, 16)}`,
          actor: line.actor,
          text: line.text,
          tags: line.tags,
          lang: 'en' as const,
        }))
      : SCENE.lines
          .filter((line) => !parsed.data.lineIds || parsed.data.lineIds.includes(line.id))
          .slice(0, 8)
          .map((line) => {
            const text =
              language === 'es' ? (SCENE.variants.es?.[line.id] ?? line.text) : line.text;
            if (text.length > 300 || !InlineTagTextSchema.safeParse(text).success)
              throw new Error('invalid_authored_variant');
            const actualLanguage =
              language === 'es' && !SCENE.variants.es?.[line.id] ? 'en' : language;
            return { ...line, lang: actualLanguage, text };
          });
    const j: Job = {
      id: randomUUID(),
      status: 'preparing',
      progress: 0,
      lines: [],
      controller: new AbortController(),
    };
    active = job = j;
    const run = async () => {
      try {
        if (parsed.data.referenceSet === 'scene' || parsed.data.framing === 'landscape') {
          for (const line of chosen) {
            try {
              await readFile(
                join(
                  assets,
                  line.actor,
                  parsed.data.framing === 'landscape'
                    ? `avatar-${parsed.data.sceneId}-landscape-v1.png`
                    : 'avatar-scene-v1.png',
                ),
              );
            } catch {
              throw new Error('missing_asset');
            }
          }
        }
        for (const line of chosen) {
          if (j.controller.signal.aborted) throw new Error('cancelled');
          const voice = ACTOR_VOICE[line.actor]!;
          const imagePath = join(
            assets,
            line.actor,
            parsed.data.framing === 'landscape'
              ? `avatar-${parsed.data.sceneId}-landscape-v1.png`
              : parsed.data.referenceSet === 'scene'
                ? 'avatar-scene-v1.png'
                : 'avatar-v2.png',
          );
          let image: Buffer | undefined;
          try {
            image = await readFile(imagePath);
          } catch {
            if (parsed.data.referenceSet === 'scene') throw new Error('missing_asset');
          }
          const audioHash = createHash('sha256')
            .update(
              JSON.stringify({
                model: 'higgs-tts-3',
                line: line.id,
                text: line.text,
                tags: line.tags,
                voice,
                language: line.lang,
              }),
            )
            .digest('hex');
          const hashData: Record<string, unknown> = {
            audioHash,
            avatar: 'higgs-avatar',
            fingerprint: image ? createHash('sha256').update(image).digest('hex') : 'missing',
          };
          if (parsed.data.framing === 'landscape') hashData.size = '640x480';
          const hash = createHash('sha256').update(JSON.stringify(hashData)).digest('hex');
          const dir = join(cache, hash);
          const audioDir = join(cache, audioHash);
          await mkdir(dir, { recursive: true });
          await mkdir(audioDir, { recursive: true });
          let hasAudio = false;
          let hasVideo = false;
          try {
            hasAudio = (await stat(join(audioDir, 'audio.wav'))).size > 0;
          } catch {
            /* generate */
          }
          try {
            hasVideo = (await stat(join(dir, 'video.mp4'))).size > 0;
          } catch {
            /* generate */
          }
          const cached = hasAudio && (!parsed.data.avatars || hasVideo);
          if (!hasAudio) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30_000);
            const abort = () => controller.abort();
            j.controller.signal.addEventListener('abort', abort, { once: true });
            try {
              const input = `${line.tags.map((tag) => `<|${tag}|>`).join('')}${line.text}`;
              const response = await fetcher('https://api.boson.ai/v1/audio/speech', {
                method: 'POST',
                redirect: 'error',
                headers: {
                  Authorization: `Bearer ${options.apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'higgs-tts-3',
                  input,
                  voice,
                  response_format: 'wav',
                  stream: false,
                  language: line.lang === 'es' ? 'spa' : 'eng',
                }),
                signal: controller.signal,
              });
              const bytes = await limitedBytes(response, MAX_AUDIO, controller.signal);
              if (!validWav(bytes)) throw new Error('provider_invalid_audio');
              await atomicWrite(join(audioDir, 'audio.wav'), bytes);
              hasAudio = true;
            } finally {
              clearTimeout(timer);
              j.controller.signal.removeEventListener('abort', abort);
            }
          }
          if (parsed.data.avatars && image && !hasVideo) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 90_000);
            const abort = () => controller.abort();
            j.controller.signal.addEventListener('abort', abort, { once: true });
            try {
              const audio = await readFile(join(audioDir, 'audio.wav'));
              const body = new FormData();
              body.set('model', 'higgs-avatar');
              body.set('size', parsed.data.framing === 'landscape' ? '640x480' : '480x640');
              body.set(
                'ref_image',
                new Blob([new Uint8Array(image)]),
                parsed.data.framing === 'landscape'
                  ? `avatar-${parsed.data.sceneId}-landscape-v1.png`
                  : parsed.data.referenceSet === 'scene'
                    ? 'avatar-scene-v1.png'
                    : 'avatar-v2.png',
              );
              body.set('input', new Blob([new Uint8Array(audio)]), 'voice.wav');
              const response = await fetcher('https://api.boson.ai/v1/videos/stream', {
                method: 'POST',
                redirect: 'error',
                headers: { Authorization: `Bearer ${options.apiKey}` },
                body,
                signal: controller.signal,
              });
              const bytes = await limitedBytes(response, MAX_VIDEO, controller.signal);
              if (!validFmp4(bytes)) throw new Error('provider_invalid_video');
              await atomicWrite(join(dir, 'video.mp4'), bytes);
              hasVideo = true;
            } catch {
              /* a real audio clip remains usable when Avatar generation fails */
            } finally {
              clearTimeout(timer);
              j.controller.signal.removeEventListener('abort', abort);
            }
          }
          await atomicWrite(
            join(dir, 'manifest.json'),
            JSON.stringify({ audio: hasAudio, video: hasVideo }),
          );
          j.lines.push({
            tags: line.tags,
            id: line.id,
            actor: line.actor,
            language: line.lang,
            text: line.text,
            voice,
            audioUrl: `/api/performance/media/${audioHash}/audio`,
            ...(hasVideo ? { videoUrl: `/api/performance/media/${hash}/video` } : {}),
            mode: hasVideo ? 'avatar' : 'audio-only',
            cached,
          });
          j.progress++;
        }
        j.status =
          parsed.data.avatars && j.lines.some((l) => l.mode === 'audio-only') ? 'partial' : 'ready';
        if (
          parsed.data.persistSnapshot &&
          parsed.data.lines &&
          ['ready', 'partial'].includes(j.status)
        ) {
          const snapshot = LatestLinesSchema.safeParse({ lines: j.lines });
          if (snapshot.success) {
            try {
              await atomicWrite(
                join(cache, `latest-scene-${parsed.data.sceneId}.json`),
                JSON.stringify(snapshot.data),
              );
            } catch {
              /* persistence is best-effort; completed clips remain available in the job */
            }
          }
        }
      } catch (error) {
        j.status = j.controller.signal.aborted ? 'cancelled' : 'error';
        j.error =
          error instanceof Error &&
          ['missing_asset', 'provider_quota_exceeded', 'provider_key_refused'].includes(
            error.message,
          )
            ? error.message
            : 'generation_failed';
      } finally {
        if (active === j) active = undefined;
      }
    };
    queue = queue.then(run, run);
    return reply.code(202).send({ id: j.id, status: j.status });
  });
  app.get<{ Params: { id: string } }>('/api/performance/job/:id', async (request, reply) => {
    if (!job || request.params.id !== job.id) return reply.code(404).send({ error: 'not_found' });
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      lines: job.lines,
      ...(job.error ? { error: job.error } : {}),
    };
  });
  app.delete<{ Params: { id: string } }>('/api/performance/job/:id', async (request, reply) => {
    const origin = request.headers.origin;
    const host = request.headers.host?.toLowerCase();
    if (!origin || !ALLOWED_ORIGINS.has(origin) || !host || !ALLOWED_HOSTS.has(host))
      return reply.code(403).send({ error: 'forbidden_origin' });
    if (!job || request.params.id !== job.id) return reply.code(404).send({ error: 'not_found' });
    if (active === job) job.controller.abort();
    return reply.code(202).send({ id: job.id, status: 'cancelling' });
  });
  app.get<{ Params: { hash: string; kind: string } }>(
    '/api/performance/media/:hash/:kind',
    async (request, reply) => {
      const { hash, kind } = request.params;
      if (!HASH.test(hash) || (kind !== 'audio' && kind !== 'video'))
        return reply.code(404).send({ error: 'not_found' });
      const path = join(cache, hash, kind === 'audio' ? 'audio.wav' : 'video.mp4');
      let size: number;
      try {
        size = (await stat(path)).size;
        if (!size) return reply.code(404).send({ error: 'not_found' });
      } catch {
        return reply.code(404).send({ error: 'not_found' });
      }
      const range = parseRange(request.headers.range, size);
      if (range === false)
        return reply
          .code(416)
          .header('Content-Range', `bytes */${size}`)
          .header('Accept-Ranges', 'bytes')
          .send();
      reply
        .header('Content-Type', kind === 'audio' ? 'audio/wav' : 'video/mp4')
        .header('Accept-Ranges', 'bytes');
      if (range)
        return reply
          .code(206)
          .header('Content-Length', String(range.end - range.start + 1))
          .header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
          .send(createReadStream(path, range));
      return reply.code(200).header('Content-Length', String(size)).send(createReadStream(path));
    },
  );
}
