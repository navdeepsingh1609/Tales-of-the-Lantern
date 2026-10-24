import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const TTS_PROBE_INPUT =
  '<|emotion:amusement|><|sfx:laughter|>Haha, the storm is coming. Count the waves with me.';
export const TTS_MAX_PCM_BYTES = 8 * 48_000;
const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const ENDPOINT = 'https://api.boson.ai/v1/audio/speech';

export type TtsProbeOutcome = 'PASS' | 'PARTIAL' | 'FAIL';
export interface TtsProbeEvidence {
  outcome: TtsProbeOutcome;
  model: 'higgs-tts-3';
  voice: 'jake';
  responseFormat: 'pcm';
  streamed: true;
  status?: number;
  pcmBytes: number;
  firstAudioMs: number | null;
  audioDurationMs: number | null;
  totalMs?: number;
  errorType?: string;
  errorCode?: string;
  reason?: 'http_error' | 'empty_audio' | 'invalid_pcm' | 'stream_error' | 'byte_limit';
  wavFile?: 'tts-probe.wav';
  docs: string[];
}
export interface ProbeTtsOptions {
  apiKey: string;
  outputDirectory: string;
  fetchImpl?: typeof fetch;
}

const DOCS = [
  'https://docs.boson.ai/api-reference/audio/create-a-speech.md',
  'https://docs.boson.ai/models/higgs-tts/overview.md',
  'https://docs.boson.ai/api-reference/errors.md',
];
const ALLOWED_TYPES = new Set([
  'authentication_error',
  'invalid_request_error',
  'rate_limit_error',
  'insufficient_quota',
  'api_error',
]);
const ALLOWED_CODES = new Set([
  'invalid_api_key',
  'no_billing_account',
  'insufficient_quota',
  'monthly_cap_reached',
  'contract_ended',
  'input_too_long',
  'invalid_field_value',
  'timestamps_streaming_unsupported',
]);

/** Build a RIFF/WAVE header around signed 16-bit, 24 kHz mono PCM. */
export function pcm16Mono24kToWav(pcm: Uint8Array): Buffer {
  if (pcm.byteLength % 2 !== 0) throw new RangeError('PCM byte length must be even');
  const header = Buffer.alloc(44);
  const dataLength = pcm.byteLength;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE((SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8, 28);
  header.writeUInt16LE((CHANNELS * BITS_PER_SAMPLE) / 8, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, Buffer.from(pcm)]);
}

function safeErrorFields(body: unknown): Pick<TtsProbeEvidence, 'errorType' | 'errorCode'> {
  if (!body || typeof body !== 'object') return {};
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return {};
  const record = error as { type?: unknown; code?: unknown };
  const type =
    typeof record.type === 'string' && ALLOWED_TYPES.has(record.type) ? record.type : undefined;
  const code =
    typeof record.code === 'string' && ALLOWED_CODES.has(record.code) ? record.code : undefined;
  return { ...(type ? { errorType: type } : {}), ...(code ? { errorCode: code } : {}) };
}

async function saveEvidence(
  directory: string,
  evidence: TtsProbeEvidence,
): Promise<TtsProbeEvidence> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'tts-probe.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  return evidence;
}

/** One bounded, non-retrying live request. The caller owns authorization and invocation. */
export async function probeTts({
  apiKey,
  outputDirectory,
  fetchImpl = fetch,
}: ProbeTtsOptions): Promise<TtsProbeEvidence> {
  const controller = new AbortController();
  const started = performance.now();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const base = {
    model: 'higgs-tts-3' as const,
    voice: 'jake' as const,
    responseFormat: 'pcm' as const,
    streamed: true as const,
    pcmBytes: 0,
    firstAudioMs: null,
    audioDurationMs: null,
    docs: DOCS,
  };
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: base.model,
        voice: base.voice,
        input: TTS_PROBE_INPUT,
        response_format: 'pcm',
        stream: true,
      }),
    });
    if (response.status !== 200) {
      let fields: Pick<TtsProbeEvidence, 'errorType' | 'errorCode'> = {};
      try {
        fields = safeErrorFields(await response.json());
      } catch {
        /* omit undocumented or malformed body data */
      }
      return await saveEvidence(outputDirectory, {
        ...base,
        outcome: 'FAIL',
        status: response.status,
        reason: 'http_error',
        ...fields,
      });
    }
    if (!response.body)
      return await saveEvidence(outputDirectory, {
        ...base,
        outcome: 'FAIL',
        status: response.status,
        reason: 'empty_audio',
      });
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteCount = 0;
    let firstAudioMs: number | null = null;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        if (firstAudioMs === null) firstAudioMs = performance.now() - started;
        if (byteCount + value.byteLength > TTS_MAX_PCM_BYTES) {
          await reader.cancel().catch(() => undefined);
          return await saveEvidence(outputDirectory, {
            ...base,
            outcome: 'PARTIAL',
            status: response.status,
            pcmBytes: byteCount,
            firstAudioMs,
            reason: 'byte_limit',
          });
        }
        chunks.push(value);
        byteCount += value.byteLength;
      }
    } catch {
      return await saveEvidence(outputDirectory, {
        ...base,
        outcome: 'FAIL',
        status: response.status,
        pcmBytes: byteCount,
        firstAudioMs,
        reason: 'stream_error',
      });
    }
    const pcm = Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
      byteCount,
    );
    const durationMs = (byteCount / ((SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8)) * 1000;
    if (byteCount === 0)
      return await saveEvidence(outputDirectory, {
        ...base,
        outcome: 'FAIL',
        status: response.status,
        pcmBytes: 0,
        firstAudioMs,
        audioDurationMs: durationMs,
        reason: 'empty_audio',
      });
    if (byteCount % 2 !== 0)
      return await saveEvidence(outputDirectory, {
        ...base,
        outcome: 'FAIL',
        status: response.status,
        pcmBytes: byteCount,
        firstAudioMs,
        audioDurationMs: durationMs,
        reason: 'invalid_pcm',
      });
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, 'tts-probe.wav'), pcm16Mono24kToWav(pcm));
    return await saveEvidence(outputDirectory, {
      ...base,
      outcome: 'PASS',
      status: response.status,
      pcmBytes: byteCount,
      firstAudioMs,
      audioDurationMs: durationMs,
      totalMs: performance.now() - started,
      wavFile: 'tts-probe.wav',
    });
  } catch {
    return await saveEvidence(outputDirectory, {
      ...base,
      outcome: 'FAIL',
      reason: 'stream_error',
    });
  } finally {
    clearTimeout(timeout);
  }
}
