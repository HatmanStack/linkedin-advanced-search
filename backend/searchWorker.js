// searchWorker.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { logger } from './utils/logger.js';
import SearchController from './controllers/searchController.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    logger.error('Usage: node searchWorker.js <state-json>');
    process.exit(1);
  }

  const statePath = args[0];
  let state;
  try {
    state = JSON.parse(await fs.readFile(statePath, 'utf8'));
  } catch (e) {
    logger.error(`Could not read state file: ${statePath}`, e);
    process.exit(1);
  }

  try {
    const controller = new SearchController();
    logger.info('Worker started with state:', { statePath, ...state });
    const results = await controller.performSearchFromState(state);
    logger.info(`Worker job finished: ${results?.length ?? 'unknown'} results`);
    // Optionally, cleanup the state file
    await fs.unlink(statePath);
    process.exit(0);
  } catch (e) {
    logger.error('Background worker failed:', e);
    process.exit(2);
  }
}

main();