import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSpikePlan, parseSpikeArgs } from './plan.ts';

const root = resolve(import.meta.dirname, '../..');

async function localPreflight() {
  const nodeVersion = process.versions.node;
  const [major = 0, minor = 0, patch = 0] = nodeVersion.split('.').map(Number);
  const nodeMeetsMinimum =
    major > 22 || (major === 22 && (minor > 18 || (minor === 18 && patch >= 0)));
  const budget = JSON.parse(await readFile(resolve(root, 'config/budget.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const scene = JSON.parse(
    await readFile(resolve(root, 'content/scenes/lighthouse.json'), 'utf8'),
  ) as { actors?: unknown[]; lines?: unknown[] };
  const ignored = (path: string) => {
    try {
      execFileSync('git', ['check-ignore', '-q', path], { cwd: root, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  const tracked = (path: string) => {
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', path], { cwd: root, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  return {
    mode: 'local-only-capability-check',
    networkCallsMade: 0,
    node: { version: nodeVersion, minimum: '22.18.0', meetsMinimum: nodeMeetsMinimum },
    budgetPolicy: {
      currency: budget.currency,
      projectCeiling: budget.projectCeiling,
      demoReserve: budget.demoReserve,
      developmentCeiling: budget.developmentCeiling,
      paidCallsEnabled: budget.paidCallsEnabled,
      policyOnly: true,
    },
    fixture: {
      path: 'content/scenes/lighthouse.json',
      validJson: true,
      actorCount: scene.actors?.length ?? null,
      lineCount: scene.lines?.length ?? null,
      schemaValidated: false,
    },
    secretHandling: {
      envFileRead: false,
      envIgnored: ignored('.env'),
      envTracked: tracked('.env'),
      envLocalIgnored: ignored('.env.local'),
      envLocalTracked: tracked('.env.local'),
    },
    limitations: [
      'Budget config describes policy and does not enforce provider or server spending.',
      'Fixture was parsed as JSON only; the shared scene schema was not imported or validated.',
      'No .env contents were read.',
    ],
  };
}

async function main() {
  const mode = parseSpikeArgs(process.argv.slice(2));
  if (mode === 'check') {
    const evidence = await localPreflight();
    const path = resolve(root, 'spike-results/local-preflight.json');
    await mkdir(resolve(root, 'spike-results'), { recursive: true });
    await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(
      `${JSON.stringify({ ...evidence, evidenceFile: 'spike-results/local-preflight.json' }, null, 2)}\n`,
    );
    return;
  }
  process.stdout.write(
    `${JSON.stringify({ plan: createSpikePlan(), localEvidence: await localPreflight() }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Spike failed'}\n`);
  process.exitCode = 1;
});
