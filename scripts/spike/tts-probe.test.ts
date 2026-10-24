import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pcm16Mono24kToWav, probeTts, TTS_MAX_PCM_BYTES } from './tts-probe.ts';

const temporaryDirectories: string[] = [];
async function outputDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'tts-probe-test-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('TTS probe helpers', () => {
  it('writes a valid 44-byte PCM WAV header with correct format and sizes', () => {
    const pcm = Uint8Array.from([1, 2, 3, 4]);
    const wav = pcm16Mono24kToWav(pcm);
    expect(wav.byteLength).toBe(48);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(40);
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(4);
    expect(wav.subarray(44)).toEqual(Buffer.from(pcm));
    expect(() => pcm16Mono24kToWav(new Uint8Array([1]))).toThrow(RangeError);
  });

  it('collects synthetic streamed PCM and records true sample duration', async () => {
    const directory = await outputDirectory();
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe('https://api.boson.ai/v1/audio/speech');
      expect(init?.redirect).toBe('error');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: 'higgs-tts-3',
        voice: 'jake',
        response_format: 'pcm',
        stream: true,
      });
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(240));
            controller.enqueue(new Uint8Array(240));
            controller.close();
          },
        }),
        { status: 200 },
      );
    };
    const result = await probeTts({
      apiKey: 'secret-key-must-never-appear',
      outputDirectory: directory,
      fetchImpl,
    });
    expect(result).toMatchObject({
      outcome: 'PASS',
      pcmBytes: 480,
      audioDurationMs: 10,
      wavFile: 'tts-probe.wav',
    });
    expect(result.firstAudioMs).toEqual(expect.any(Number));
    const wav = await readFile(join(directory, 'tts-probe.wav'));
    expect(wav.byteLength).toBe(524);
    const evidenceText = await readFile(join(directory, 'tts-probe.json'), 'utf8');
    expect(evidenceText).not.toContain('secret-key-must-never-appear');
  });

  it('aborts and marks over-limit streams PARTIAL without writing WAV', async () => {
    const directory = await outputDirectory();
    const fetchImpl: typeof fetch = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(TTS_MAX_PCM_BYTES));
            controller.enqueue(new Uint8Array(2));
            controller.close();
          },
        }),
        { status: 200 },
      );
    const result = await probeTts({
      apiKey: 'no-log-this-secret',
      outputDirectory: directory,
      fetchImpl,
    });
    expect(result).toMatchObject({
      outcome: 'PARTIAL',
      reason: 'byte_limit',
      pcmBytes: TTS_MAX_PCM_BYTES,
    });
    expect(await readFile(join(directory, 'tts-probe.json'), 'utf8')).not.toContain(
      'no-log-this-secret',
    );
    await expect(readFile(join(directory, 'tts-probe.wav'))).rejects.toThrow();
  });

  it('keeps only documented allowlisted error type and code, never provider prose', async () => {
    const directory = await outputDirectory();
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        {
          error: {
            type: 'insufficient_quota',
            code: 'monthly_cap_reached',
            message: 'sensitive body text with no-billing-key-fragment',
          },
        },
        { status: 429, headers: { 'x-private': 'secret-header-value' } },
      );
    const result = await probeTts({
      apiKey: 'secret-api-key',
      outputDirectory: directory,
      fetchImpl,
    });
    expect(result).toMatchObject({
      outcome: 'FAIL',
      reason: 'http_error',
      status: 429,
      errorType: 'insufficient_quota',
      errorCode: 'monthly_cap_reached',
    });
    const evidence = await readFile(join(directory, 'tts-probe.json'), 'utf8');
    for (const privateText of [
      'secret-api-key',
      'sensitive body text',
      'no-billing-key-fragment',
      'secret-header-value',
    ]) {
      expect(evidence).not.toContain(privateText);
    }
  });
});
