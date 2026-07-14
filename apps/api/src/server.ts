import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { buildApp } from './app';
import { parseEnv } from './config/env';

loadDotEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
loadDotEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

const start = async (): Promise<void> => {
  const env = parseEnv();
  const app = await buildApp({ env });

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutting down API');
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  await app.listen({ host: env.HOST, port: env.PORT });
};

start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
