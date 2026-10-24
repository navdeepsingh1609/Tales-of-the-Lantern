import Fastify, { type FastifyInstance } from 'fastify';
import { registerSpikeMedia } from './routes/spike-media.js';
import { registerPerformanceRoutes } from './routes/performance.js';
import { registerRealtimeSecret } from './routes/realtime-secret.js';
import { registerScriptGenerator } from './routes/script-generator.js';

export function buildApp(
  options: {
    logger?: boolean;
    apiKey?: string;
    performanceEnabled?: boolean;
    realtimeEnabled?: boolean;
  } = {},
): FastifyInstance {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers.boson_api_key',
                'req.headers["x-boson-api-key"]',
              ],
              censor: '[REDACTED]',
            },
          },
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'cut-server',
    generationEnabled: Boolean(options.apiKey && options.performanceEnabled),
  }));

  registerSpikeMedia(app);
  registerPerformanceRoutes(app, {
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    enabled: options.performanceEnabled === true,
  });
  registerRealtimeSecret(app, {
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    enabled: options.realtimeEnabled === true,
  });
  registerScriptGenerator(app);

  return app;
}
