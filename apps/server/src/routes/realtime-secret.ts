import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const MAX_SESSION_SECONDS = 120;
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
const EmptyRequest = z.object({}).strict();
const UpstreamSchema = z.object({
  object: z.literal('realtime.client_secret'),
  value: z.string().startsWith('bai-eph-').min(9),
  expires_at: z.number().int().positive(),
  session: z.object({ id: z.string(), object: z.literal('realtime.session') }).passthrough(),
});

export interface RealtimeSecretOptions {
  apiKey?: string;
  enabled?: boolean;
  fetchImpl?: typeof fetch;
}

/** Local ephemeral credential minting. Provider usage limits control spend; sessions expire after two minutes. */
export function registerRealtimeSecret(
  app: FastifyInstance,
  options: RealtimeSecretOptions = {},
): void {
  const enabled = options.enabled === true && Boolean(options.apiKey);
  const fetcher = options.fetchImpl ?? fetch;
  let busy = false;

  app.get('/api/realtime/status', async () => ({
    enabled,
    maxSessionSeconds: MAX_SESSION_SECONDS,
    spendControls: 'provider',
  }));

  app.post('/api/realtime/secret', async (request, reply) => {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (
      !origin ||
      !ALLOWED_ORIGINS.has(origin) ||
      !host ||
      !ALLOWED_HOSTS.has(host.toLowerCase())
    ) {
      return reply.code(403).send({ error: 'forbidden_origin' });
    }
    if (!EmptyRequest.safeParse(request.body).success)
      return reply.code(400).send({ error: 'invalid_request' });
    if (!enabled) return reply.code(503).send({ error: 'realtime_disabled' });
    if (busy) return reply.code(429).send({ error: 'realtime_busy' });
    busy = true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetcher('https://api.boson.ai/v1/realtime/client_secrets', {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expires_after: { seconds: MAX_SESSION_SECONDS } }),
          signal: controller.signal,
        });
      } catch {
        return reply.code(502).send({ error: 'provider_unavailable' });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        if (response.status === 429)
          return reply.code(429).send({ error: 'provider_quota_exceeded' });
        if (response.status === 401) return reply.code(502).send({ error: 'provider_key_refused' });
        return reply.code(502).send({ error: 'provider_request_failed' });
      }
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        return reply.code(502).send({ error: 'provider_response_invalid' });
      }
      const result = UpstreamSchema.safeParse(json);
      if (!result.success) return reply.code(502).send({ error: 'provider_response_invalid' });
      return reply.header('Cache-Control', 'no-store').code(200).send({
        value: result.data.value,
        expires_at: result.data.expires_at,
        maxSessionSeconds: MAX_SESSION_SECONDS,
      });
    } finally {
      busy = false;
    }
  });
}
