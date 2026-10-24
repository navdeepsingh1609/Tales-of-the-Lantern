import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { registerRealtimeSecret } from '../src/routes/realtime-secret.js';

describe('Realtime client secret route', () => {
  let app: FastifyInstance | undefined;
  let directory: string | undefined;
  const start = async (options: Parameters<typeof registerRealtimeSecret>[1] = {}) => {
    directory = await mkdtemp(join(tmpdir(), 'cut-realtime-'));
    app = Fastify({ logger: false });
    registerRealtimeSecret(app, options);
    return app;
  };
  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });
  const request = async (server: FastifyInstance, payload: object = {}) =>
    await server.inject({
      method: 'POST',
      url: '/api/realtime/secret',
      payload,
      headers: { origin: 'http://localhost:5173', host: '127.0.0.1:8787' },
    });
  const secretResponse = (value = 'bai-eph-fixture', expiresAt = 1_900_000_000) =>
    new Response(
      JSON.stringify({
        object: 'realtime.client_secret',
        value,
        expires_at: expiresAt,
        session: { id: 'ignored', object: 'realtime.session' },
        ignored: 'data',
      }),
      { status: 200 },
    );

  it('rejects foreign or missing origins before any provider call', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const server = await start({ enabled: true, apiKey: 'server-only', fetchImpl });
    const response = await server.inject({
      method: 'POST',
      url: '/api/realtime/secret',
      payload: {},
      headers: { origin: 'https://evil.example', host: 'localhost:8787' },
    });
    expect(response.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is disabled by default and validates the exact empty object before calling upstream', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const server = await start({ fetchImpl });
    expect((await request(server)).statusCode).toBe(503);
    expect((await request(server, { expires_after: { seconds: 120 } })).statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns only ephemeral credentials and reports provider-managed spend controls', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(secretResponse());
    const server = await start({ enabled: true, apiKey: 'private-server-key', fetchImpl });
    const response = await request(server);
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      value: 'bai-eph-fixture',
      expires_at: 1_900_000_000,
      maxSessionSeconds: 120,
    });
    expect(response.body).not.toContain('private-server-key');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.boson.ai/v1/realtime/client_secrets');
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      expires_after: { seconds: 120 },
    });
    expect(await server.inject('/api/realtime/status').then((result) => result.json())).toEqual({
      enabled: true,
      maxSessionSeconds: 120,
      spendControls: 'provider',
    });
  });

  it('allows repeated sessions without consulting or modifying historical ledger files', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => secretResponse());
    const server = await start({ enabled: true, apiKey: 'key', fetchImpl });
    const historicalPath = join(directory!, 'legacy-ledger.json');
    const historicalContent = JSON.stringify({ count: 4, reservedCents: 400, lastReservedAt: 1 });
    await writeFile(historicalPath, historicalContent);
    for (let index = 0; index < 6; index++) expect((await request(server)).statusCode).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(await readFile(historicalPath, 'utf8')).toBe(historicalContent);
  });

  it('keeps only one in-flight mint at a time', async () => {
    let finish!: (response: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    const server = await start({ enabled: true, apiKey: 'key', fetchImpl });
    const first = request(server);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const second = await request(server);
    expect(second.statusCode).toBe(429);
    expect(second.json()).toEqual({ error: 'realtime_busy' });
    finish(secretResponse());
    expect((await first).statusCode).toBe(200);
  });

  it('preserves provider quota errors and never returns provider error text', async () => {
    const quotaServer = await start({
      enabled: true,
      apiKey: 'key',
      fetchImpl: vi.fn(async () => new Response('quota details', { status: 429 })),
    });
    const quota = await request(quotaServer);
    expect(quota.statusCode).toBe(429);
    expect(quota.json()).toEqual({ error: 'provider_quota_exceeded' });
    await quotaServer.close();

    app = Fastify({ logger: false });
    registerRealtimeSecret(app, {
      enabled: true,
      apiKey: 'key',
      fetchImpl: vi.fn().mockRejectedValue(new Error('provider bai-eph-secret')),
    });
    const failure = await request(app);
    expect(failure.statusCode).toBe(502);
    expect(failure.body).not.toContain('secret');
  });
});
