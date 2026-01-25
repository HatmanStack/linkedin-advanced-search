/**
 * Profile Initialization Healing Worker
 *
 * This worker script is spawned by HealingManager to resume a profile
 * initialization operation after a browser crash or other failure. It reads
 * the healing state from a JSON file, decrypts the credentials, and resumes
 * profile processing.
 *
 * Usage: node profileInitWorker.js <state-file-path>
 */

import fs from 'fs/promises';
import { decryptSealboxB64Tag } from '#utils/crypto.js';
import { logger } from '#utils/logger.js';

async function main() {
  const stateFile = process.argv[2];

  if (!stateFile) {
    logger.error('No state file provided');
    process.exit(1);
  }

  logger.info('Profile init healing worker started', { stateFile });

  try {
    // Read and parse state file
    const stateJson = await fs.readFile(stateFile, 'utf8');
    const state = JSON.parse(stateJson);

    logger.info('Loaded healing state', {
      requestId: state.requestId,
      currentBatch: state.currentBatch,
      currentIndex: state.currentIndex,
      recursionCount: state.recursionCount,
      healPhase: state.healPhase
    });

    // Decrypt credentials
    if (state.searchPassword) {
      const decrypted = await decryptSealboxB64Tag(state.searchPassword);
      if (!decrypted) {
        logger.error('Failed to decrypt searchPassword');
        process.exit(1);
      }
      state.searchPassword = decrypted;
    }

    if (state.jwtToken) {
      const decrypted = await decryptSealboxB64Tag(state.jwtToken);
      if (!decrypted) {
        logger.error('Failed to decrypt jwtToken');
        process.exit(1);
      }
      state.jwtToken = decrypted;
    }

    logger.info('Credentials decrypted successfully');

    // Clean up state file after reading
    try {
      await fs.unlink(stateFile);
      logger.info('State file cleaned up', { stateFile });
    } catch (err) {
      logger.warn('Failed to clean up state file', { error: err.message });
    }

    // TODO: Implement actual profile init resumption logic
    // This would involve:
    // 1. Initialize browser with the decrypted credentials
    // 2. Load the current processing list from state.currentProcessingList
    // 3. Resume from state.currentBatch and state.currentIndex
    // 4. Continue processing profiles

    logger.info('Profile init healing worker completed (implementation pending)', {
      currentBatch: state.currentBatch,
      currentIndex: state.currentIndex,
      requestId: state.requestId
    });

  } catch (err) {
    logger.error('Profile init healing worker failed', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error('Unhandled error in profile init worker', { error: err.message });
  process.exit(1);
});
