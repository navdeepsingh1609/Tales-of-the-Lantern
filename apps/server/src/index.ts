import { buildApp } from './app.js';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 8787;
const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath)) loadEnvFile(envPath);
const policy = JSON.parse(
  readFileSync(new URL('../../../config/budget.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const apiKey = process.env.BOSON_API_KEY;
const app = buildApp({
  ...(apiKey ? { apiKey } : {}),
  performanceEnabled:
    policy.providerSpendControlsConfirmed === true && policy.castPreparationEnabled === true,
  realtimeEnabled:
    policy.providerSpendControlsConfirmed === true && policy.microphoneEnabled === true,
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error, 'Server failed to start');
  process.exitCode = 1;
  await app.close();
}

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, 'Shutting down');
  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error(error, 'Server shutdown failed');
    process.exitCode = 1;
  }
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
