import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

async function main() {
  const { app } = await createApp();
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Campus Recoverer API listening on port ${config.port} (${config.nodeEnv})`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start API server');
  process.exit(1);
});
