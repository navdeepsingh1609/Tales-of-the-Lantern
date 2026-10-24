import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const SCENES = ['lighthouse', 'tavern', 'observatory', 'cyberpunk', 'noir'] as const;
const EMOTIONS = [
  'contentment',
  'amusement',
  'whispering',
  'anger',
  'enthusiasm',
  'determination',
  'relief',
  'confusion',
  'longing',
  'fear',
  'sadness',
  'contemplation',
  'interrupted',
  'neutral',
] as const;
const RequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(500),
    scene: z.enum(SCENES).optional(),
  })
  .strict();
const ResultSchema = z
  .object({
    scene: z.enum(SCENES),
    lines: z
      .array(
        z
          .object({
            actor: z.enum(['odile', 'rocco', 'pim']),
            text: z.string().min(1).max(220),
            emotion: z.enum(EMOTIONS),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.lines.reduce((sum, line) => sum + line.text.length, 0) > 1000) {
      ctx.addIssue({ code: 'custom', message: 'combined script text is too long' });
    }
  });
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

export interface ScriptGeneratorOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export function registerScriptGenerator(
  app: FastifyInstance,
  options: ScriptGeneratorOptions = {},
): void {
  const fetcher = options.fetchImpl ?? fetch;
  let active = false;
  const requestTimes: number[] = [];

  app.get('/api/script/status', async () => ({
    configured: Boolean(options.apiKey ?? process.env.GROQ_API_KEY),
  }));

  app.post('/api/script/generate', async (request, reply) => {
    const origin = request.headers.origin;
    const host = request.headers.host?.toLowerCase();
    if (!origin || !ALLOWED_ORIGINS.has(origin) || !host || !ALLOWED_HOSTS.has(host)) {
      return reply.code(403).send({ error: 'forbidden_origin' });
    }
    const parsed = RequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_request' });

    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) return reply.code(503).send({ error: 'script_generation_unavailable' });
    if (active) return reply.code(409).send({ error: 'script_generation_busy' });

    const now = Date.now();
    while (requestTimes.length && requestTimes[0]! <= now - 60 * 60 * 1000) requestTimes.shift();
    if (requestTimes.length >= 6)
      return reply.code(429).send({ error: 'script_generation_rate_limited' });
    requestTimes.push(now);
    active = true;

    const { prompt, scene: requestedScene } = parsed.data;
    const systemPrompt = `You are an interactive theatre director. Write an improv scene inspired by the user's prompt. Return only JSON with this exact shape: {"scene":"lighthouse|tavern|observatory|cyberpunk|noir","lines":[{"actor":"odile|rocco|pim","text":"spoken line","emotion":"contentment|amusement|whispering|anger|enthusiasm|determination|relief|confusion|longing|fear|sadness|contemplation|interrupted|neutral"}]}. Use 1-6 lines, each text 1-220 characters, combined text at most 1000 characters. Use actors odile, rocco, and pim. No title, ids, markdown, or extra properties. The requested scene is ${requestedScene ?? 'choose the best fit'}.`;
    try {
      const response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          temperature: 0.75,
          max_tokens: 800,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Write an improv dialogue scene based on this prompt: ${JSON.stringify(prompt)}.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return reply.code(502).send({ error: 'script_generation_failed' });
      const data: unknown = await response.json();
      const envelope = z
        .object({
          choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
        })
        .safeParse(data);
      if (!envelope.success) return reply.code(502).send({ error: 'script_generation_failed' });
      let content: unknown;
      try {
        content = JSON.parse(envelope.data.choices[0]!.message.content);
      } catch {
        return reply.code(502).send({ error: 'script_generation_failed' });
      }
      const result = ResultSchema.safeParse(content);
      if (!result.success) return reply.code(502).send({ error: 'script_generation_failed' });
      return result.data;
    } catch {
      return reply.code(502).send({ error: 'script_generation_failed' });
    } finally {
      active = false;
    }
  });
}
