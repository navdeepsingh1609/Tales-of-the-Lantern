// Explicit one-time probes only. No automatic calls on install, startup or CI.
import { loadEnvFile } from 'node:process';
import { copyFile, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { SpendGuard } from '../../apps/server/src/guards/spend.ts';
import { probeTts } from './tts-probe.ts';
import { probeAvatar } from './avatar-probe.ts';
import { probeRealtime } from './realtime-probe.ts';

const root = resolve(import.meta.dirname, '../..');
const outputDirectory = resolve(root, 'spike-results/live');
const privateDirectory = resolve(root, 'spike-results/private');
const names = ['tts', 'avatar', 'realtime', 'realtime-confirm', 'realtime-diagnostic'] as const;
type ProbeName = (typeof names)[number];

async function main() {
  const requested = process.argv[2];
  if (process.argv.length !== 3 || !names.some((name) => name === requested)) {
    throw new Error('Choose one explicitly reviewed probe.');
  }
  const probe = requested as ProbeName;
  const policy = JSON.parse(await readFile(resolve(root, 'config/budget.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  if (policy.paidCallsEnabled !== true || policy.providerSpendControlsConfirmed !== true) {
    throw new Error('Paid probes disabled until workspace spend controls are confirmed.');
  }
  if (
    policy.currency !== 'CAD' ||
    policy.projectCeiling !== 30 ||
    policy.developmentCeiling !== 5 ||
    policy.demoReserve !== 25
  ) {
    throw new Error('Budget policy differs from the approved CA$30 plan.');
  }
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  // Atomic per-probe markers prevent repeats, including after a crash or timeout.
  // A failed probe is reviewed rather than blindly retried.
  const marker = await open(resolve(privateDirectory, `${probe}.started`), 'wx', 0o600);
  await marker.writeFile('One-time live probe started; do not automatically repeat.\n');
  await marker.close();
  if (probe === 'realtime-confirm') {
    await copyFile(
      resolve(outputDirectory, 'realtime-probe.json'),
      resolve(outputDirectory, 'realtime-initial.json'),
      constants.COPYFILE_EXCL,
    );
  }
  if (probe === 'realtime-diagnostic') {
    await copyFile(
      resolve(outputDirectory, 'realtime-probe.json'),
      resolve(outputDirectory, 'realtime-named.json'),
      constants.COPYFILE_EXCL,
    );
  }

  const guard = new SpendGuard({
    totalCapCents: 3000,
    developmentMaxCents: 500,
    demoReserveCents: 2500,
    enabled: true,
  });
  const reservations = [
    guard.reserve('development', 150),
    guard.reserve('development', 150),
    guard.reserve('development', 200),
  ];
  if (reservations.some((reservation) => !reservation.accepted))
    throw new Error('Cannot reserve the bounded development batch.');
  await writeFile(
    resolve(privateDirectory, 'batch-reservations.json'),
    JSON.stringify(
      {
        ...guard.snapshot(),
        note: 'CA$5 conservatively reserved for this one-time batch. These are reservations, not confirmed provider charges; do not settle or release until usage is reconciled.',
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  loadEnvFile(resolve(root, '.env'));
  const apiKey = process.env.BOSON_API_KEY;
  if (!apiKey || !/^bai-\S+$/.test(apiKey)) throw new Error('A valid local Boson key is required.');
  await mkdir(outputDirectory, { recursive: true });
  let evidence: unknown;
  if (probe === 'tts') {
    evidence = await probeTts({ apiKey, outputDirectory });
  } else if (probe === 'avatar') {
    const tts = JSON.parse(await readFile(resolve(outputDirectory, 'tts-probe.json'), 'utf8')) as {
      outcome?: unknown;
    };
    if (tts.outcome !== 'PASS')
      throw new Error('Avatar requires the successful saved TTS fixture.');
    evidence = await probeAvatar({
      apiKey,
      outputDirectory,
      referenceImagePath: resolve(root, 'content/characters/rocco/ref.png'),
      audioPath: resolve(outputDirectory, 'tts-probe.wav'),
    });
  } else {
    evidence = await probeRealtime({ apiKey, outputDirectory });
  }
  console.log(JSON.stringify(evidence, null, 2));
  const result = evidence as { outcome?: string; status?: string };
  if (result.outcome === 'FAIL' || result.outcome === 'PARTIAL' || result.status === 'failed')
    process.exitCode = 1;
}

main().catch(() => {
  // Never print raw exceptions: fetch/WS exceptions may contain credentials.
  console.error(
    'Probe stopped. Check sanitized evidence and one-time markers; no automatic retry.',
  );
  process.exitCode = 1;
});
