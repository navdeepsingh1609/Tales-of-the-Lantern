import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerPerformanceRoutes } from '../src/routes/performance.js';

const dirs: string[] = [];
const localHeaders = { origin: 'http://localhost:5173', host: 'localhost:5173' };
function wavFixture(): Response {
  const wav = Buffer.alloc(46);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(38, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(22050, 24);
  wav.writeUInt32LE(22050, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(2, 40);
  return new Response(wav, { status: 200 });
}
function fmp4Fixture(): Response {
  const box = (name: string) => {
    const bytes = Buffer.alloc(8);
    bytes.writeUInt32BE(8, 0);
    bytes.write(name, 4, 'ascii');
    return bytes;
  };
  return new Response(Buffer.concat([box('ftyp'), box('moof'), box('mdat')]), { status: 200 });
}
async function setup(options: Parameters<typeof registerPerformanceRoutes>[1] = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'cut-performance-'));
  dirs.push(directory);
  const app = Fastify();
  registerPerformanceRoutes(app, {
    directory,
    assetDirectory: join(directory, 'assets'),
    ...options,
  });
  return app;
}
async function startJob(app: Awaited<ReturnType<typeof setup>>, payload: Record<string, unknown>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload,
    });
    if (response.statusCode === 202) return response.json().id as string;
    if (response.statusCode !== 409) {
      expect(response.statusCode).toBe(202);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('performance job did not start after the active job released its slot');
}
async function waitForJob(app: Awaited<ReturnType<typeof setup>>, id: string) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const response = await app.inject(`/api/performance/job/${id}`);
    if (response.statusCode !== 200) throw new Error('performance job could not be read');
    const state = response.json();
    if (state.status !== 'preparing') return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('performance job did not finish');
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('performance route safety', () => {
  it('reports a real provider quota refusal without a local budget error or provider payload', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private upstream detail', { status: 429 }));
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const id = await startJob(app, { lines: [{ actor: 'odile', text: 'A new line.', tags: [] }] });
    const state = await waitForJob(app, id);
    expect(state.status).toBe('error');
    expect(state.error).toBe('provider_quota_exceeded');
    expect(JSON.stringify(state)).not.toContain('private upstream detail');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('serves authored scene offline and never calls a provider on GET', async () => {
    const fetchImpl = vi.fn();
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const response = await app.inject({ method: 'GET', url: '/api/performance/scene' });
    expect(response.statusCode).toBe(200);
    expect(response.json().lines).toHaveLength(8);
    expect(fetchImpl).not.toHaveBeenCalled();
    const latest = await app.inject({ method: 'GET', url: '/api/performance/latest' });
    expect(latest.statusCode).toBe(200);
    expect(latest.json()).toEqual({ lines: [] });
    await app.close();
  });

  it('rejects generation when disabled and rejects extra request fields', async () => {
    const fetchImpl = vi.fn();
    const app = await setup({ apiKey: 'test', fetchImpl });
    const disabled = await app.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload: {},
    });
    expect(disabled.statusCode).toBe(503);
    await app.close();
    const enabled = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const invalid = await enabled.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload: { language: 'en', extra: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    await enabled.close();
  });

  it('validates custom lines and keeps generation disabled without spending', async () => {
    const fetchImpl = vi.fn();
    const disabled = await setup({ apiKey: 'test', fetchImpl });
    const denied = await disabled.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload: { lines: [{ actor: 'odile', text: 'Hello' }] },
    });
    expect(denied.statusCode).toBe(503);
    await disabled.close();

    const enabled = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const invalidBodies = [
      { lines: [{ actor: 'unknown', text: 'Hello' }] },
      { lines: [{ actor: 'odile', text: 'Hello', tags: ['emotion:made_up'] }] },
      { lines: [{ actor: 'odile', text: 'Hello', tags: Array(5).fill('emotion:amusement') }] },
      { lineIds: ['unknown'] },
      { lineIds: ['l1', 'l1'] },
      { lineIds: ['l1'], lines: [{ actor: 'odile', text: 'Custom line' }] },
      { lines: Array.from({ length: 5 }, () => ({ actor: 'odile', text: 'x'.repeat(220) })) },
      {
        lines: [
          {
            actor: 'odile',
            text: 'x'.repeat(220),
            tags: [
              'emotion:amusement',
              'emotion:determination',
              'emotion:contemplation',
              'emotion:affection',
            ],
          },
        ],
      },
    ];
    for (const payload of invalidBodies) {
      const response = await enabled.inject({
        method: 'POST',
        url: '/api/performance/prepare',
        headers: localHeaders,
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    await enabled.close();
  });

  it('prepares custom lines with actor voices and reuses their cache', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => wavFixture());
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const lines = [
      { actor: 'odile', text: 'The tide is turning.', tags: ['emotion:determination'] },
      { actor: 'rocco', text: 'Then we move now.' },
    ];
    const prepare = async () => {
      const id = await startJob(app, { lines });
      return waitForJob(app, id);
    };

    const first = await prepare();
    expect(first.status).toBe('ready');
    expect(first.lines.map((line: { voice: string }) => line.voice)).toEqual(['eleanor', 'jake']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const latest = await app.inject({ method: 'GET', url: '/api/performance/latest' });
    expect(latest.json().lines).toHaveLength(2);
    expect(
      latest
        .json()
        .lines.every(
          (line: { audioUrl: string; videoUrl?: string }) =>
            /^\/api\/performance\/media\/[a-f0-9]{64}\/audio$/.test(line.audioUrl) &&
            (!line.videoUrl ||
              /^\/api\/performance\/media\/[a-f0-9]{64}\/video$/.test(line.videoUrl)),
        ),
    ).toBe(true);
    const calls = fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(calls.map((call) => [call.voice, call.language, call.input])).toEqual([
      ['eleanor', 'eng', '<|emotion:determination|>The tide is turning.'],
      ['jake', 'eng', 'Then we move now.'],
    ]);
    const second = await prepare();
    expect(second.lines.every((line: { cached: boolean }) => line.cached)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('keeps directed one-line takes out of latest snapshots and rejects non-persisted batches', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => wavFixture());
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const lines = [{ actor: 'odile', text: 'Original scene line.' }];
    const firstId = await startJob(app, { lines });
    expect((await waitForJob(app, firstId)).status).toBe('ready');
    const before = (await app.inject('/api/performance/latest')).json();
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload: {
        lines: [...lines, { actor: 'rocco', text: 'Extra line.' }],
        persistSnapshot: false,
      },
    });
    expect(invalid.statusCode).toBe(400);
    const directedId = await startJob(app, {
      lines: [{ actor: 'odile', text: 'Original scene line.', tags: ['emotion:determination'] }],
      avatars: false,
      persistSnapshot: false,
    });
    expect((await waitForJob(app, directedId)).status).toBe('ready');
    expect((await app.inject('/api/performance/latest')).json()).toEqual(before);
    await app.close();
  });

  it('rejects invalid reference sets and keeps TTS cached across reference variants', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = init?.body;
      if (body instanceof FormData) {
        calls.push('avatar');
        throw new Error('offline');
      }
      calls.push('tts');
      return wavFixture();
    });
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const directory = dirs[dirs.length - 1]!;
    const actorDir = join(directory, 'assets', 'odile');
    await mkdir(actorDir, { recursive: true });
    await writeFile(join(actorDir, 'avatar-v2.png'), Buffer.from('portrait fixture'));
    await writeFile(join(actorDir, 'avatar-scene-v1.png'), Buffer.from('scene fixture'));
    const lines = [{ actor: 'odile', text: 'Shared line.' }];
    const prepare = async (referenceSet: string) => {
      const id = await startJob(app, { lines, avatars: true, referenceSet });
      return waitForJob(app, id);
    };
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/performance/prepare',
      headers: localHeaders,
      payload: { referenceSet: 'landscape' },
    });
    expect(invalid.statusCode).toBe(400);
    await prepare('portrait');
    await prepare('scene');
    expect(calls.filter((call) => call === 'tts')).toHaveLength(1);
    expect(fetchImpl.mock.calls.filter(([, init]) => init?.body instanceof FormData)).toHaveLength(
      2,
    );
    await app.close();
  });

  it('uses native landscape scene refs, preserves audio cache, and isolates latest snapshots by scene', async () => {
    const providerCalls: Array<{
      kind: string;
      size?: string | undefined;
      filename?: string | undefined;
    }> = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      if (init?.body instanceof FormData) {
        providerCalls.push({
          kind: 'avatar',
          size: init.body.get('size')?.toString(),
          filename: (init.body.get('ref_image') as File | null)?.name,
        });
        return fmp4Fixture();
      }
      providerCalls.push({ kind: 'tts' });
      return wavFixture();
    });
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const directory = dirs[dirs.length - 1]!;
    for (const actor of ['odile']) {
      const actorDir = join(directory, 'assets', actor);
      await mkdir(actorDir, { recursive: true });
      await writeFile(join(actorDir, 'avatar-v2.png'), Buffer.from('portrait ref'));
      await writeFile(
        join(actorDir, 'avatar-lighthouse-landscape-v1.png'),
        Buffer.from('lighthouse ref'),
      );
      await writeFile(join(actorDir, 'avatar-tavern-landscape-v1.png'), Buffer.from('tavern ref'));
      await writeFile(
        join(actorDir, 'avatar-observatory-landscape-v1.png'),
        Buffer.from('observatory ref'),
      );
    }
    const lines = [{ actor: 'odile', text: 'Same audio across framing.' }];
    const prepare = async (
      sceneId: 'lighthouse' | 'tavern' | 'observatory',
      framing: 'portrait' | 'landscape',
    ) => {
      const id = await startJob(app, { lines, sceneId, framing, avatars: true });
      return waitForJob(app, id);
    };
    const portrait = await prepare('lighthouse', 'portrait');
    const lighthouse = await prepare('lighthouse', 'landscape');
    const tavern = await prepare('tavern', 'landscape');
    const observatory = await prepare('observatory', 'landscape');
    expect(portrait.status).toBe('ready');
    expect(lighthouse.status).toBe('ready');
    expect(providerCalls.filter((call) => call.kind === 'tts')).toHaveLength(1);
    expect(providerCalls.filter((call) => call.size === '640x480')).toHaveLength(3);
    expect(
      providerCalls.find((call) => call.filename === 'avatar-tavern-landscape-v1.png'),
    ).toBeTruthy();
    expect(
      (await app.inject('/api/performance/latest?sceneId=lighthouse')).json().lines[0].videoUrl,
    ).toBeTruthy();
    expect((await app.inject('/api/performance/latest?sceneId=tavern')).json().lines).toHaveLength(
      1,
    );
    expect(
      (await app.inject('/api/performance/latest?sceneId=observatory')).json().lines,
    ).toHaveLength(1);
    expect(tavern.lines[0].audioUrl).toBe(observatory.lines[0].audioUrl);
    await app.close();
  });

  it('ignores corrupt or exhausted historical ledgers and leaves them unchanged', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => wavFixture());
    const app = await setup({ apiKey: 'test', enabled: true, fetchImpl });
    const directory = dirs[dirs.length - 1]!;
    const historicalLedgers = [
      '{corrupt',
      JSON.stringify({ entries: [{ at: Date.now(), cents: 99_999 }] }),
    ];
    for (const [index, historical] of historicalLedgers.entries()) {
      const path = join(directory, 'budget.json');
      await writeFile(path, historical);
      const id = await startJob(app, {
        lines: [{ actor: 'odile', text: `Historical ledger ignored ${index}.` }],
      });
      expect((await waitForJob(app, id)).status).toBe('ready');
      expect(await readFile(path, 'utf8')).toBe(historical);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it('does not expose a provider key or allow arbitrary media paths', async () => {
    const app = await setup({ apiKey: 'secret-value' });
    const missing = await app.inject({
      method: 'GET',
      url: '/api/performance/media/../../secret/audio',
    });
    expect(missing.statusCode).toBeGreaterThanOrEqual(400);
    expect(missing.body).not.toContain('secret-value');
    await app.close();
  });
});
