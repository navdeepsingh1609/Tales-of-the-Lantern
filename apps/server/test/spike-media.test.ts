import Fastify from 'fastify';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registerSpikeMedia } from '../src/routes/spike-media.js';

const directories: string[] = [];
async function fixtures(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'spike-media-'));
  directories.push(directory);
  await writeFile(join(directory, 'tts-probe.wav'), Buffer.from('0123456789'));
  await writeFile(join(directory, 'avatar-probe.mp4'), Buffer.from('video-bytes'));
  await writeFile(join(directory, 'tts-probe.json'), JSON.stringify({ outcome: 'PASS' }));
  return directory;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('spike media review routes', () => {
  it('serves media with correct headers and supports a single byte range', async () => {
    const directory = await fixtures();
    const app = Fastify();
    registerSpikeMedia(app, { directory });
    const full = await app.inject({ method: 'GET', url: '/api/spike-media/audio' });
    expect(full.statusCode).toBe(200);
    expect(full.headers['content-type']).toContain('audio/wav');
    expect(full.headers['content-length']).toBe('10');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.rawPayload.toString()).toBe('0123456789');

    const partial = await app.inject({
      method: 'GET',
      url: '/api/spike-media/audio',
      headers: { range: 'bytes=2-5' },
    });
    expect(partial.statusCode).toBe(206);
    expect(partial.headers['content-range']).toBe('bytes 2-5/10');
    expect(partial.headers['content-length']).toBe('4');
    expect(partial.rawPayload.toString()).toBe('2345');
    const openEnded = await app.inject({
      method: 'GET',
      url: '/api/spike-media/audio',
      headers: { range: 'bytes=8-' },
    });
    expect(openEnded.statusCode).toBe(206);
    expect(openEnded.rawPayload.toString()).toBe('89');
    await app.close();
  });

  it('rejects invalid and out of bounds ranges and unknown kinds', async () => {
    const directory = await fixtures();
    const app = Fastify();
    registerSpikeMedia(app, { directory });
    for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-2', 'bytes=0-1,4-5', 'cats=0-1']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/spike-media/audio',
        headers: { range },
      });
      expect(response.statusCode).toBe(416);
      expect(response.headers['content-range']).toBe('bytes */10');
    }
    expect((await app.inject('/api/spike-media/unknown')).statusCode).toBe(404);
    await app.close();
  });

  it('returns only present allowlisted evidence and prevents path selection', async () => {
    const directory = await fixtures();
    const app = Fastify();
    registerSpikeMedia(app, { directory });
    const result = await app.inject('/api/spike-evidence');
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ tts: { outcome: 'PASS' } });
    expect((await app.inject('/api/spike-evidence/../../package.json')).statusCode).toBe(404);
    expect((await app.inject('/api/spike-media/video')).rawPayload.toString()).toBe('video-bytes');
    await app.close();
  });
});
