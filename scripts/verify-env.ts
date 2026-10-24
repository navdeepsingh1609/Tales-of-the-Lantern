// Sources: https://docs.boson.ai/authentication.md
// https://docs.boson.ai/api-reference/audio/create-a-speech.md
// https://docs.boson.ai/api-reference/errors.md
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));

async function main(): Promise<void> {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => flag !== '--offline')) {
    console.error('Usage: pnpm verify:env [--offline]');
    process.exitCode = 1;
    return;
  }

  try {
    if (existsSync(envPath)) loadEnvFile(envPath);
  } catch {
    console.error('FAIL: Cannot load .env. Check its permissions and KEY=value syntax.');
    process.exitCode = 1;
    return;
  }

  const key = process.env.BOSON_API_KEY;
  // Docs promise a bai- prefix, not a fixed length or suffix alphabet.
  // Reject whitespace and obvious placeholders without claiming full validation.
  if (
    !key ||
    !/^bai-\S+$/.test(key) ||
    /[<>"']/.test(key) ||
    /^(?:bai-)?(?:x+|your[-_].*|replace.*|example.*)$/i.test(key)
  ) {
    console.error('FAIL: Set BOSON_API_KEY in .env to your actual bai- key (no spaces).');
    process.exitCode = 1;
    return;
  }

  // Avoid displaying a meaningful fraction of an unexpectedly short value.
  console.log(key.length >= 12 ? `Key present; suffix: …${key.slice(-4)}` : 'Key present.');
  if (flags.includes('--offline')) {
    console.log(
      'PASS: Local key shape only. No API request made; authentication and billing unverified.',
    );
    return;
  }

  console.log(
    'Sending one TTS request ("Hi."). No retries. List-price estimate: $0.000045, before taxes/minimums.',
  );
  const started = performance.now();
  let response: Response;
  try {
    // Fixed trusted origin; never forward the credential across redirects.
    response = await fetch('https://api.boson.ai/v1/audio/speech', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'higgs-tts-3',
        input: 'Hi.',
        voice: 'jake',
        response_format: 'wav',
      }),
    });
  } catch {
    console.error(
      'FAIL: Network, timeout or redirect error. Check connectivity; no automatic retry was made.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`HTTP ${response.status}`);
  if (!response.ok) {
    // Never print arbitrary upstream bodies: they can contain credentials or input.
    const body: unknown = await response.json().catch(() => null);
    const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const type = error && typeof error === 'object' && 'type' in error ? error.type : null;
    const fixes: Record<string, string> = {
      invalid_api_key: 'Replace the missing, malformed or revoked key in .env.',
      no_billing_account: 'Claim credits and activate billing in the Boson workspace.',
      insufficient_quota: 'Credits are exhausted. Check workspace billing.',
      monthly_cap_reached: 'Monthly cap reached. Review the cap in workspace usage.',
      contract_ended: 'Contact your Boson representative about the account contract.',
    };
    if (typeof code === 'string' && Object.hasOwn(fixes, code)) {
      console.error(`FAIL: ${code}. ${fixes[code]}`);
    } else if (response.status === 401) {
      console.error('FAIL: Authentication refused. Check the key in the Boson workspace.');
    } else if (type === 'insufficient_quota') {
      console.error(
        'FAIL: Billing refusal. Check credits and monthly cap; retries will not fix it.',
      );
    } else if (type === 'rate_limit_error') {
      console.error('FAIL: Temporary rate limit. Wait before running again.');
    } else if (response.status === 400 || response.status === 403) {
      console.error(
        'FAIL: Request or model access refused. Check model access and current API docs.',
      );
    } else if (response.status >= 500) {
      console.error('FAIL: Boson service error. Try later.');
    } else {
      console.error('FAIL: Unrecognized API error. Review the documented error reference.');
    }
    process.exitCode = 1;
    return;
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (
    response.status !== 200 ||
    audio.length <= 44 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    console.error('FAIL: Expected HTTP 200 and a nonempty WAV response. No audio saved.');
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS: Received ${audio.length} WAV bytes in ${Math.round(performance.now() - started)} ms. No audio saved.`,
  );
  console.log(
    'Authentication and TTS access work. Balance, spend cap and warning threshold require workspace confirmation.',
  );
}

main().catch(() => {
  console.error(
    'FAIL: Verification could not finish. No raw exception logged to protect credentials.',
  );
  process.exitCode = 1;
});
