import fs from 'fs/promises';
import { logger } from './utils/logger.js';
import { ProfileInitController } from './controllers/profileInitController.js';

/**
 * Profile Initialization Worker
 * Handles healing and recovery for profile initialization processes
 */
class ProfileInitWorker {
  constructor() {
    this.controller = new ProfileInitController();
  }

  async run() {
    const stateFile = process.argv[2];
    
    if (!stateFile) {
      logger.error('Profile init worker: No state file provided');
      process.exit(1);
    }

    try {
      logger.info(`Profile init worker starting with state file: ${stateFile}`);
      
      // Load state from file
      const stateContent = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(stateContent);
      
      logger.info('Profile init worker loaded state', {
        requestId: state.requestId,
        recursionCount: state.recursionCount,
        healPhase: state.healPhase,
        healReason: state.healReason,
        currentProcessingList: state.currentProcessingList,
        currentBatch: state.currentBatch,
        currentIndex: state.currentIndex
      });

      // Execute profile initialization from state
      const result = await this.controller.performProfileInitFromState(state);
      
      if (result) {
        logger.info('Profile init worker completed successfully', {
          requestId: state.requestId,
          processed: result.data?.processed || 0,
          skipped: result.data?.skipped || 0,
          errors: result.data?.errors || 0
        });
      } else {
        logger.info('Profile init worker triggered additional healing', {
          requestId: state.requestId
        });
      }

      // Clean up state file
      try {
        await fs.unlink(stateFile);
        logger.debug(`Cleaned up state file: ${stateFile}`);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup state file ${stateFile}:`, cleanupError.message);
      }

    } catch (error) {
      logger.error('Profile init worker failed:', {
        stateFile,
        message: error.message,
        stack: error.stack
      });
      
      process.exit(1);
    }
  }
}

// Run the worker
const worker = new ProfileInitWorker();
worker.run().catch(error => {
  logger.error('Profile init worker crashed:', error);
  process.exit(1);
});