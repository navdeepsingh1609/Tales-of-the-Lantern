import { loadEnvFile } from 'node:process';
import { open, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENDPOINT = 'https://api.boson.ai/v1/videos/stream';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 90_000;
const ACTORS = ['group', 'odile', 'rocco', 'pim'] as const;
const SCENES = ['lighthouse', 'tavern', 'observatory'] as const;
const ERROR_CODES = new Set([
  'invalid_image_format',
  'payload_too_large',
  'audio_too_long',
  'empty_input',
  'invalid_size',
  'model_not_found',
]);
type Actor = (typeof ACTORS)[number];
type Scene = (typeof SCENES)[number];
type Evidence = {
  actor: Actor;
  scene: Scene;
  input: 'silent-pcm-wav';
  inputDurationSeconds: 3;
  requestCount: 0 | 1;
  httpStatus: number | null;
  contentType: 'video/mp4' | 'application/octet-stream' | 'other' | null;
  videoBytes: number;
  requestDurationMs: number | null;
  result: 'pass' | 'http_error' | 'network_error' | 'empty_stream' | 'byte_limit' | 'invalid_fmp4';
  errorCode?: string;
  videoFile?: string;
};

function parseArgs(args: string[]): { actor: Actor; scene: Scene; run: boolean } {
  let actor: string | undefined;
  let scene: string | undefined;
  let run = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--actor') actor = args[++i];
    else if (arg === '--scene') scene = args[++i];
    else if (arg === '--run') run = true;
    else throw new Error('invalid_arguments');
  }
  if (!ACTORS.some((value) => value === actor) || !SCENES.some((value) => value === scene))
    throw new Error('invalid_arguments');
  return { actor: actor as Actor, scene: scene as Scene, run };
}

/** Three seconds of mono PCM16 silence at 24 kHz. */
export function makeSilentWav(): Buffer {
  const sampleRate = 24_000;
  const channels = 1;
  const bitsPerSample = 16;
  const dataSize = sampleRate * channels * (bitsPerSample / 8) * 3;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  wav.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}

export function isPlausibleFmp4(bytes: Uint8Array): boolean {
  const input = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const boxes = new Set<string>();
  let offset = 0;
  while (offset + 8 <= input.length) {
    let size = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > input.length) return false;
      const largeSize = input.readBigUInt64BE(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(largeSize);
      header = 16;
    } else if (size === 0) size = input.length - offset;
    if (size < header || size > input.length - offset || !/^[ -~]{4}$/.test(type)) return false;
    boxes.add(type);
    offset += size;
  }
  return offset === input.length && boxes.has('ftyp') && boxes.has('moof') && boxes.has('mdat');
}

function safeContentType(value: string | null): Evidence['contentType'] {
  if (!value) return null;
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase();
  if (normalized === 'video/mp4') return 'video/mp4';
  if (normalized === 'application/octet-stream') return 'application/octet-stream';
  return 'other';
}

async function saveEvidence(path: string, evidence: Evidence): Promise<void> {
  await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}

async function main(): Promise<void> {
  const { actor, scene, run } = parseArgs(process.argv.slice(2));
  const outputDirectory = resolve(ROOT, '.cache', 'idle', scene, actor);
  const storyboardScene = scene === 'lighthouse' ? 'gull-point' : scene;
  const referenceImage =
    actor === 'group'
      ? resolve(ROOT, 'content', 'storyboard', storyboardScene, 'listening-v1.png')
      : resolve(ROOT, 'content', 'characters', actor, `avatar-${scene}-landscape-v1.png`);
  const wavPath = resolve(outputDirectory, 'silent-3s.wav');
  const videoPath = resolve(outputDirectory, 'idle.mp4');
  const evidencePath = resolve(outputDirectory, 'evidence.json');
  const markerPath = resolve(outputDirectory, '.request-started');
  const plan = {
    actor,
    scene,
    model: 'higgs-avatar',
    referenceImage:
      actor === 'group'
        ? `content/storyboard/${storyboardScene}/listening-v1.png`
        : `content/characters/${actor}/avatar-${scene}-landscape-v1.png`,
    input: '3-second mono 24 kHz PCM16 silent WAV',
    endpoint: ENDPOINT,
    size: '640x480',
    requests: run ? 1 : 0,
    output: `.cache/idle/${scene}/${actor}`,
    mode: run ? 'explicit-run' : 'offline-plan-only',
  };
  if (!run) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  try {
    await stat(videoPath);
    console.log(JSON.stringify({ ...plan, mode: 'existing-video-reused', requests: 0 }, null, 2));
    return;
  } catch {
    /* no prior successful result */
  }
  try {
    await stat(markerPath);
    throw new Error('already_attempted');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT')
      throw error;
    if (error instanceof Error && error.message === 'already_attempted') throw error;
  }

  await mkdir(outputDirectory, { recursive: true });
  const image = await readFile(referenceImage);
  if (
    image.byteLength > 10 * 1024 * 1024 ||
    !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('invalid_reference_image');
  const wav = makeSilentWav();
  await writeFile(wavPath, wav, { mode: 0o600 });

  loadEnvFile(resolve(ROOT, '.env'));
  const apiKey = process.env.BOSON_API_KEY;
  if (!apiKey || !/^bai-\S+$/.test(apiKey)) throw new Error('missing_key');

  // Create the single-use marker before network access. Any failure requires review, never retry.
  const marker = await open(markerPath, 'wx', 0o600);
  await marker.writeFile('One Avatar request started; do not retry automatically.\n');
  await marker.close();

  const evidence: Evidence = {
    actor,
    scene,
    input: 'silent-pcm-wav',
    inputDurationSeconds: 3,
    requestCount: 1,
    httpStatus: null,
    contentType: null,
    videoBytes: 0,
    requestDurationMs: null,
    result: 'network_error',
  };
  const abort = new AbortController();
  const startedAt = performance.now();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const form = new FormData();
    form.set('model', 'higgs-avatar');
    form.set('size', '640x480');
    form.set(
      'ref_image',
      new Blob([new Uint8Array(image)]),
      actor === 'group' ? 'listening-v1.png' : `avatar-${scene}-landscape-v1.png`,
    );
    form.set('input', new Blob([new Uint8Array(wav)]), 'silent-3s.wav');
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: abort.signal,
    });
    evidence.requestDurationMs = Math.round(performance.now() - startedAt);
    evidence.httpStatus = response.status;
    evidence.contentType = safeContentType(response.headers.get('content-type'));
    if (!response.ok) {
      evidence.result = 'http_error';
      try {
        const body: unknown = await response.json();
        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          body.error &&
          typeof body.error === 'object' &&
          'code' in body.error &&
          typeof body.error.code === 'string' &&
          ERROR_CODES.has(body.error.code)
        )
          evidence.errorCode = body.error.code;
      } catch {
        /* provider response text is intentionally not persisted */
      }
      await saveEvidence(evidencePath, evidence);
      console.log(JSON.stringify({ ...plan, ...evidence }, null, 2));
      return;
    }
    if (!response.body) {
      evidence.result = 'empty_stream';
      await saveEvidence(evidencePath, evidence);
      console.log(JSON.stringify({ ...plan, ...evidence }, null, 2));
      return;
    }
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (evidence.videoBytes + value.byteLength > MAX_VIDEO_BYTES) {
        await reader.cancel().catch(() => undefined);
        evidence.result = 'byte_limit';
        break;
      }
      const chunk = Buffer.from(value);
      chunks.push(chunk);
      evidence.videoBytes += chunk.length;
    }
    evidence.requestDurationMs = Math.round(performance.now() - startedAt);
    if (evidence.result === 'byte_limit') {
      await saveEvidence(evidencePath, evidence);
      console.log(JSON.stringify({ ...plan, ...evidence }, null, 2));
      return;
    }
    const video = Buffer.concat(chunks, evidence.videoBytes);
    if (video.length === 0) evidence.result = 'empty_stream';
    else if (!isPlausibleFmp4(video)) evidence.result = 'invalid_fmp4';
    else {
      await writeFile(videoPath, video, { mode: 0o600 });
      evidence.result = 'pass';
      evidence.videoFile = `idle.mp4`;
    }
    await saveEvidence(evidencePath, evidence);
    console.log(JSON.stringify({ ...plan, ...evidence }, null, 2));
  } catch {
    evidence.requestDurationMs = Math.round(performance.now() - startedAt);
    await saveEvidence(evidencePath, evidence);
    console.error('Idle probe failed. Sanitized evidence was saved; do not retry without review.');
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

main().catch(() => {
  console.error('Idle probe stopped; inspect the local inputs and marker before any retry.');
  process.exitCode = 1;
});
