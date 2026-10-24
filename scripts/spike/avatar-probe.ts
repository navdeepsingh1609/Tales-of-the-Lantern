import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';

const ENDPOINT = 'https://api.boson.ai/v1/videos/stream';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 8;
export const AVATAR_MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const DOCS = [
  'https://docs.boson.ai/api-reference/videos/create-a-video-streaming.md',
  'https://docs.boson.ai/api-reference/videos/create-a-video.md',
  'https://docs.boson.ai/models/higgs-avatar/input-options.md',
  'https://docs.boson.ai/models/higgs-avatar/streaming-video.md',
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
  'invalid_image_format',
  'payload_too_large',
  'audio_too_long',
  'empty_input',
  'input_too_long',
  'invalid_size',
  'model_not_found',
  'all_replicas_busy',
]);
const VIDEO_ID_RE = /^video_[a-f0-9]{24}$/i;

export type AvatarProbeOutcome = 'PASS' | 'PARTIAL' | 'FAIL';
export interface AvatarProbeEvidence {
  outcome: AvatarProbeOutcome;
  status?: number;
  reason?:
    | 'invalid_image'
    | 'image_too_large'
    | 'invalid_wav'
    | 'audio_too_long'
    | 'http_error'
    | 'empty_stream'
    | 'stream_error'
    | 'byte_limit'
    | 'invalid_mp4';
  errorType?: string;
  errorCode?: string;
  referenceImageBytes: number;
  audioBytes: number;
  audioDurationSeconds?: number;
  videoBytes: number;
  firstByteMs: number | null;
  totalMs: number | null;
  savedPath?: 'avatar-probe.mp4';
  videoId?: string;
  docs: string[];
}
export interface ProbeAvatarOptions {
  apiKey: string;
  outputDirectory: string;
  referenceImagePath: string;
  audioPath: string;
  fetchImpl?: typeof fetch;
}

/** Parse RIFF/WAVE chunks, validating bounds and deriving duration from data bytes / byte rate. */
export function parseWavDuration(bytes: Uint8Array): number {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    b.length < 12 ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WAVE'
  )
    throw new Error('invalid_wav');
  const riffEnd = b.readUInt32LE(4) + 8;
  if (riffEnd > b.length || riffEnd < 12) throw new Error('invalid_wav');
  let offset = 12;
  let byteRate: number | undefined;
  let dataBytes = 0;
  let gotFmt = false;
  while (offset + 8 <= riffEnd) {
    const id = b.toString('ascii', offset, offset + 4);
    const length = b.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > riffEnd || end > b.length) throw new Error('invalid_wav');
    if (id === 'fmt ') {
      if (length < 16) throw new Error('invalid_wav');
      const format = b.readUInt16LE(start);
      const channels = b.readUInt16LE(start + 2);
      byteRate = b.readUInt32LE(start + 8);
      if ((format !== 1 && format !== 3 && format !== 0xfffe) || channels < 1 || byteRate < 1)
        throw new Error('invalid_wav');
      gotFmt = true;
    } else if (id === 'data') dataBytes += length;
    offset = end + (length & 1);
  }
  if (offset !== riffEnd || !gotFmt || !byteRate || dataBytes < 1) throw new Error('invalid_wav');
  return dataBytes / byteRate;
}

function imageType(bytes: Buffer): boolean {
  return (
    (bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP')
  );
}

/** Check sequential ISO-BMFF boxes and require ftyp, moof, and mdat. */
export function hasPlausibleFmp4(bytes: Uint8Array): boolean {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Set<string>();
  let offset = 0;
  while (offset + 8 <= b.length) {
    let size = b.readUInt32BE(offset);
    const type = b.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > b.length) return false;
      const large = b.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(large);
      header = 16;
    } else if (size === 0) size = b.length - offset;
    if (size < header || offset + size > b.length || !/^[ -~]{4}$/.test(type)) return false;
    found.add(type);
    offset += size;
  }
  return offset === b.length && found.has('ftyp') && found.has('moof') && found.has('mdat');
}

function safeErrorFields(body: unknown): Pick<AvatarProbeEvidence, 'errorType' | 'errorCode'> {
  if (!body || typeof body !== 'object') return {};
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return {};
  const record = error as { type?: unknown; code?: unknown };
  const errorType =
    typeof record.type === 'string' && ALLOWED_TYPES.has(record.type) ? record.type : undefined;
  const errorCode =
    typeof record.code === 'string' && ALLOWED_CODES.has(record.code) ? record.code : undefined;
  return { ...(errorType ? { errorType } : {}), ...(errorCode ? { errorCode } : {}) };
}

async function saveEvidence(
  directory: string,
  evidence: AvatarProbeEvidence,
): Promise<AvatarProbeEvidence> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, 'avatar-probe.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  return evidence;
}

/** Make one explicitly invoked, bounded Avatar stream request. No environment reads or retries. */
export async function probeAvatar({
  apiKey,
  outputDirectory,
  referenceImagePath,
  audioPath,
  fetchImpl = fetch,
}: ProbeAvatarOptions): Promise<AvatarProbeEvidence> {
  const base: AvatarProbeEvidence = {
    outcome: 'FAIL',
    referenceImageBytes: 0,
    audioBytes: 0,
    videoBytes: 0,
    firstByteMs: null,
    totalMs: null,
    docs: DOCS,
  };
  let image: Buffer;
  let audio: Buffer;
  try {
    [image, audio] = await Promise.all([readFile(referenceImagePath), readFile(audioPath)]);
  } catch {
    return saveEvidence(outputDirectory, { ...base, reason: 'invalid_image' });
  }
  const imageBytes = image.byteLength;
  const audioBytes = audio.byteLength;
  const initial = { ...base, referenceImageBytes: imageBytes, audioBytes };
  if (imageBytes > MAX_IMAGE_BYTES)
    return saveEvidence(outputDirectory, { ...initial, reason: 'image_too_large' });
  if (!imageType(image))
    return saveEvidence(outputDirectory, { ...initial, reason: 'invalid_image' });
  let duration: number;
  try {
    duration = parseWavDuration(audio);
  } catch {
    return saveEvidence(outputDirectory, { ...initial, reason: 'invalid_wav' });
  }
  const validated = { ...initial, audioDurationSeconds: duration };
  if (duration > MAX_AUDIO_SECONDS)
    return saveEvidence(outputDirectory, { ...validated, reason: 'audio_too_long' });

  const controller = new AbortController();
  const started = performance.now();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let file: ReturnType<typeof createWriteStream> | undefined;
  let videoBytes = 0;
  let firstByteMs: number | null = null;
  const mp4Parts: Buffer[] = [];
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'higgs-avatar',
        size: '480x640',
        ref_image: image.toString('base64'),
        input: audio.toString('base64'),
      }),
    });
    const videoIdHeader = response.headers.get('X-Video-Id');
    const videoId =
      videoIdHeader && VIDEO_ID_RE.test(videoIdHeader) ? { videoId: videoIdHeader } : {};
    if (response.status !== 200) {
      let fields: Pick<AvatarProbeEvidence, 'errorType' | 'errorCode'> = {};
      try {
        fields = safeErrorFields(await response.json());
      } catch {
        /* omit untrusted response body */
      }
      return await saveEvidence(outputDirectory, {
        ...validated,
        status: response.status,
        reason: 'http_error',
        totalMs: performance.now() - started,
        ...fields,
      });
    }
    if (!response.body)
      return await saveEvidence(outputDirectory, {
        ...validated,
        status: response.status,
        reason: 'empty_stream',
        totalMs: performance.now() - started,
        ...videoId,
      });
    await mkdir(outputDirectory, { recursive: true });
    file = createWriteStream(join(outputDirectory, 'avatar-probe.mp4'), { flags: 'w' });
    file.on('error', () => controller.abort());
    const reader = response.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (firstByteMs === null) firstByteMs = performance.now() - started;
      if (videoBytes + value.byteLength > AVATAR_MAX_VIDEO_BYTES) {
        await reader.cancel().catch(() => undefined);
        file.end();
        await once(file, 'close');
        return await saveEvidence(outputDirectory, {
          ...validated,
          outcome: 'PARTIAL',
          status: response.status,
          reason: 'byte_limit',
          videoBytes,
          firstByteMs,
          totalMs: performance.now() - started,
          savedPath: 'avatar-probe.mp4',
          ...videoId,
        });
      }
      const chunk = Buffer.from(value);
      mp4Parts.push(chunk);
      videoBytes += chunk.length;
      if (!file.write(chunk)) await once(file, 'drain');
    }
    file.end();
    await once(file, 'close');
    const common = {
      ...validated,
      status: response.status,
      videoBytes,
      firstByteMs,
      totalMs: performance.now() - started,
      savedPath: 'avatar-probe.mp4' as const,
      ...videoId,
    };
    if (videoBytes === 0)
      return await saveEvidence(outputDirectory, {
        ...common,
        outcome: 'FAIL',
        reason: 'empty_stream',
      });
    if (!hasPlausibleFmp4(Buffer.concat(mp4Parts, videoBytes)))
      return await saveEvidence(outputDirectory, {
        ...common,
        outcome: 'FAIL',
        reason: 'invalid_mp4',
      });
    return await saveEvidence(outputDirectory, { ...common, outcome: 'PASS' });
  } catch {
    if (file && !file.closed) {
      file.destroy();
      await once(file, 'close').catch(() => undefined);
    }
    const partial = videoBytes > 0;
    return await saveEvidence(outputDirectory, {
      ...validated,
      outcome: partial ? 'PARTIAL' : 'FAIL',
      reason: 'stream_error',
      videoBytes,
      firstByteMs,
      totalMs: performance.now() - started,
      ...(partial ? { savedPath: 'avatar-probe.mp4' as const } : {}),
    });
  } finally {
    clearTimeout(timeout);
  }
}
