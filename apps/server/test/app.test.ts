import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('server app', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports health without implying generation is available', async () => {
    app = buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'cut-server',
      generationEnabled: false,
    });
  });

  it('returns 404 for unimplemented routes', async () => {
    app = buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/not-implemented' });

    expect(response.statusCode).toBe(404);
  });
});
