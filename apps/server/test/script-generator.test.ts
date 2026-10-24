import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerScriptGenerator } from '../src/routes/script-generator.js';

const headers = { origin: 'http://localhost:5173', host: 'localhost:5173' };
const valid = {
  scene: 'noir',
  lines: [
    { actor: 'rocco', text: 'The fog has a way of hiding trouble.', emotion: 'contemplation' },
  ],
};
function response(content: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    { status },
  );
}
function appWith(apiKey?: string, fetchImpl?: typeof fetch) {
  const app = Fastify({ logger: false });
  registerScriptGenerator(app, {
    ...(apiKey !== undefined ? { apiKey } : {}),
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  return app;
}

describe('script generator', () => {
  it('reports configuration without exposing a key and refuses missing credentials', async () => {
    const app = appWith('');
    const status = await app.inject('/api/script/status');
    expect(status.json()).toEqual({ configured: false });
    const result = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      headers,
      payload: { prompt: 'A storm' },
    });
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('GROQ_API_KEY');
    await app.close();
  });

  it('requires the expected local origin and host before calling Groq', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) => response(valid));
    const app = appWith('test-key', fetchImpl);
    const result = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      headers: { host: 'localhost:9999', origin: 'http://localhost:5173' },
      payload: { prompt: 'A storm' },
    });
    expect(result.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
    await app.close();
  });

  it('sends one bounded provider request and returns only the validated response contract', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) => response(valid));
    const app = appWith('test-key', fetchImpl);
    const result = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      headers,
      payload: { prompt: 'A storm' },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual(valid);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect((init?.signal as AbortSignal).aborted).toBe(false);
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(init?.redirect).toBe('error');
    await app.close();
  });

  it('rejects malformed requests and provider output without leaking provider data', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) =>
      response({ ...valid, lines: [{ ...valid.lines[0], actor: 'captain' }] }),
    );
    const app = appWith('test-key', fetchImpl);
    const invalidRequest = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      headers,
      payload: { prompt: 'x'.repeat(501) },
    });
    expect(invalidRequest.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    const invalidOutput = await app.inject({
      method: 'POST',
      url: '/api/script/generate',
      headers,
      payload: { prompt: 'A storm' },
    });
    expect(invalidOutput.statusCode).toBe(502);
    expect(invalidOutput.json()).toEqual({ error: 'script_generation_failed' });
    await app.close();
  });

  it('rejects excess lines, overlong text, and aggregate text above 1000 characters', async () => {
    for (const lines of [
      Array.from({ length: 7 }, () => valid.lines[0]),
      [{ ...valid.lines[0], text: 'x'.repeat(221) }],
      Array.from({ length: 5 }, () => ({ ...valid.lines[0], text: 'x'.repeat(220) })),
    ]) {
      const app = appWith('test-key', async () => response({ scene: 'noir', lines }));
      const result = await app.inject({
        method: 'POST',
        url: '/api/script/generate',
        headers,
        payload: { prompt: 'A storm' },
      });
      expect(result.statusCode).toBe(502);
      await app.close();
    }
  });

  it('allows one active generation and limits each process to six calls per hour', async () => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) => {
      calls += 1;
      return calls === 1 ? pending : response(valid);
    });
    const app = appWith('test-key', fetchImpl);
    const payload = {
      method: 'POST' as const,
      url: '/api/script/generate',
      headers,
      payload: { prompt: 'A storm' },
    };
    const first = app.inject(payload);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const concurrent = await app.inject(payload);
    expect(concurrent.statusCode).toBe(409);
    release(response(valid));
    expect((await first).statusCode).toBe(200);

    for (let count = 1; count < 6; count++) {
      expect((await app.inject(payload)).statusCode).toBe(200);
    }
    const limited = await app.inject(payload);
    expect(limited.statusCode).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    await app.close();
  });
});
