import { logger } from '../utils/logger.js';
import { ProfileInitStateManager } from '../utils/profileInitStateManager.js';
import { profileInitMonitor } from '../utils/profileInitMonitor.js';
import RandomHelpers from '../utils/randomHelpers.js';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class ProfileInitService {
  constructor(puppeteerService, linkedInService, linkedInContactService, dynamoDBService) {
    this.puppeteer = puppeteerService;
    this.linkedInService = linkedInService;
    this.linkedInContactService = linkedInContactService;
    this.dynamoDBService = dynamoDBService;
    this.batchSize = 100; // Default batch size, configurable
  }

  /**
   * Initialize user profile database with LinkedIn data
   * @param {Object} state - Profile initialization state
   * @returns {Promise<Object>} Initialization result
   */
  async initializeUserProfile(state) {
    const requestId = state.requestId || 'unknown';
    const startTime = Date.now();

    try {
      logger.info('Starting profile initialization process', {
        requestId,
        recursionCount: state.recursionCount || 0,
        healPhase: state.healPhase,
        isResuming: ProfileInitStateManager.isResumingState(state),
        currentProcessingList: state.currentProcessingList,
        currentBatch: state.currentBatch,
        currentIndex: state.currentIndex
      });

      // Set auth token for DynamoDB operations
      this.dynamoDBService.setAuthToken(state.jwtToken);

      // Perform LinkedIn login using existing service
      await this._performLinkedInLogin(state);

      // Process connection lists in batches
      const result = await this.processConnectionLists(state);

      const totalDuration = Date.now() - startTime;
      logger.info('Profile initialization completed successfully', {
        requestId,
        totalDuration,
        processed: result.processed,
        skipped: result.skipped,
        errors: result.errors,
        progressSummary: result.progressSummary
      });

      return {
        success: true,
        message: 'Profile database initialized successfully',
        data: result,
        metadata: {
          requestId,
          duration: totalDuration,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const errorDetails = this._categorizeServiceError(error);

      logger.error('Profile initialization failed', {
        requestId,
        totalDuration,
        errorType: errorDetails.type,
        errorCategory: errorDetails.category,
        message: error.message,
        stack: error.stack,
        isRecoverable: errorDetails.isRecoverable,
        currentState: {
          processingList: state.currentProcessingList,
          batch: state.currentBatch,
          index: state.currentIndex,
          recursionCount: state.recursionCount
        }
      });

      // Add context to error for better debugging
      error.context = {
        requestId,
        duration: totalDuration,
        state: {
          processingList: state.currentProcessingList,
          batch: state.currentBatch,
          index: state.currentIndex,
          recursionCount: state.recursionCount
        },
        errorDetails
      };

      throw error;
    }
  }

  /**
   * Perform LinkedIn login using existing LinkedInService patterns
   * @param {Object} state - Profile initialization state
   */
  async _performLinkedInLogin(state) {
    const requestId = state.requestId || 'unknown';
    const startTime = Date.now();

    try {
      logger.info('Performing LinkedIn login for profile initialization', {
        requestId,
        username: state.searchName ? '[REDACTED]' : 'not provided',
        recursionCount: state.recursionCount || 0,
        isHealing: ProfileInitStateManager.isHealingState(state),
        healPhase: state.healPhase
      });

      // Validate state before attempting login
      ProfileInitStateManager.validateState(state);

      // Use existing LinkedInService login method following SearchController pattern
      await this.linkedInService.login(
        state.searchName,
        state.searchPassword,
        state.recursionCount > 0
      );

      const loginDuration = Date.now() - startTime;
      logger.info('LinkedIn login successful for profile initialization', {
        requestId,
        loginDuration,
        recursionCount: state.recursionCount || 0
      });

      // Log healing information if present
      if (ProfileInitStateManager.isHealingState(state)) {
        logger.info('Profile initialization healing context', {
          requestId,
          healPhase: state.healPhase,
          healReason: state.healReason,
          recursionCount: state.recursionCount
        });
      }

    } catch (error) {
      const loginDuration = Date.now() - startTime;
      const errorDetails = this._categorizeServiceError(error);

      logger.error('LinkedIn login failed during profile initialization', {
        requestId,
        loginDuration,
        errorType: errorDetails.type,
        errorCategory: errorDetails.category,
        message: error.message,
        isRecoverable: errorDetails.isRecoverable,
        recursionCount: state.recursionCount || 0,
        username: state.searchName ? '[REDACTED]' : 'not provided'
      });

      // Add context for better error tracking
      const enhancedError = new Error(`LinkedIn authentication failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = {
        requestId,
        duration: loginDuration,
        errorDetails,
        state: {
          recursionCount: state.recursionCount,
          healPhase: state.healPhase,
          healReason: state.healReason
        }
      };

      throw enhancedError;
    }
  }

  /**
   * Process connection lists with batch processing
   * @param {Object} state - Profile initialization state
   * @returns {Promise<Object>} Processing result
   */
  async processConnectionLists(state) {
    try {
      logger.info('Starting connection list processing');

      // Validate state using ProfileInitStateManager
      ProfileInitStateManager.validateState(state);

      // Create master index file if not resuming from healing
      let masterIndexFile = state.masterIndexFile;
      if (!masterIndexFile) {
        masterIndexFile = await this._createMasterIndexFile(state);

        // Update state with master index file path
        state.masterIndexFile = masterIndexFile;
      }

      // Load existing master index or create new one
      const masterIndex = await this._loadMasterIndex(masterIndexFile);

      // Update total connections in state from master index
      if (masterIndex.metadata) {
        state.totalConnections = {
          allies: masterIndex.metadata.totalAllies || 0,
          incoming: masterIndex.metadata.totalIncoming || 0,
          outgoing: masterIndex.metadata.totalOutgoing || 0
        };
      }

      // Process each connection type
      const connectionTypes = ['allies', 'outgoing', 'incoming'];
      const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        connectionTypes: {},
        progressSummary: ProfileInitStateManager.getProgressSummary(state)
      };

      for (const connectionType of connectionTypes) {
        // Skip if we're resuming from a specific list and this isn't it
        if (state.currentProcessingList && state.currentProcessingList !== connectionType) {
          logger.info(`Skipping ${connectionType} connections - resuming from ${state.currentProcessingList}`);
          continue;
        }

        logger.info(`Processing ${connectionType} connections`);

        try {
          const typeResult = await this._processConnectionType(
            connectionType,
            masterIndex,
            state
          );

          results.connectionTypes[connectionType] = typeResult;
          results.processed += typeResult.processed;
          results.skipped += typeResult.skipped;
          results.errors += typeResult.errors;

          // Update state with progress
          state = ProfileInitStateManager.updateBatchProgress(state, {
            currentProcessingList: connectionType,
            completedBatches: masterIndex.processingState.completedBatches
          });

          // Update master index with progress
          await this._updateMasterIndex(masterIndexFile, masterIndex);

        } catch (error) {
          logger.error(`Failed to process ${connectionType} connections:`, error);

          // Update state with error information for potential healing
          state.lastError = {
            connectionType,
            message: error.message,
            timestamp: new Date().toISOString()
          };

          throw error;
        }
      }

      // Update final progress summary
      results.progressSummary = ProfileInitStateManager.getProgressSummary(state);

      logger.info('Connection list processing completed', {
        processed: results.processed,
        skipped: results.skipped,
        errors: results.errors,
        progress: results.progressSummary
      });

      return results;

    } catch (error) {
      logger.error('Connection list processing failed:', error);
      throw error;
    }
  }

  /**
   * Create master index file for tracking connection lists
   * @param {Object} state - Profile initialization state
   * @returns {Promise<string>} Path to master index file
   */
  async _createMasterIndexFile(state) {
    try {
      const timestamp = Date.now();
      const masterIndexFile = path.join('data', `profile-init-index-${timestamp}.json`);

      // Simulate fetching connection counts (in real implementation, this would navigate to LinkedIn)
      const connectionCounts = await this._getConnectionCounts();

      const masterIndex = {
        metadata: {
          capturedAt: new Date().toISOString(),
          totalAllies: connectionCounts.allies,
          totalIncoming: connectionCounts.incoming,
          totalOutgoing: connectionCounts.outgoing,
          batchSize: this.batchSize
        },
        files: {
          alliesConnections: [],
          incomingConnections: [],
          outgoingConnections: []
        },
        processingState: {
          currentList: 'allies',
          currentBatch: 0,
          currentIndex: 0,
          completedBatches: []
        }
      };

      await fs.writeFile(masterIndexFile, JSON.stringify(masterIndex, null, 2));
      logger.info(`Created master index file: ${masterIndexFile}`);

      return masterIndexFile;

    } catch (error) {
      logger.error('Failed to create master index file:', error);
      throw error;
    }
  }

  /**
   * Load master index from file
   * @param {string} masterIndexFile - Path to master index file
   * @returns {Promise<Object>} Master index data
   */
  async _loadMasterIndex(masterIndexFile) {
    try {
      const content = await fs.readFile(masterIndexFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load master index from ${masterIndexFile}:`, error);
      throw error;
    }
  }

  /**
   * Update master index file with current progress
   * @param {string} masterIndexFile - Path to master index file
   * @param {Object} masterIndex - Master index data
   */
  async _updateMasterIndex(masterIndexFile, masterIndex) {
    try {
      await fs.writeFile(masterIndexFile, JSON.stringify(masterIndex, null, 2));
      logger.debug(`Updated master index file: ${masterIndexFile}`);
    } catch (error) {
      logger.error('Failed to update master index:', error);
      throw error;
    }
  }

  /**
   * Process connections for a specific type (allies, incoming, outgoing)
   * @param {string} connectionType - Type of connections to process
   * @param {Object} masterIndex - Master index data
   * @param {Object} state - Profile initialization state
   * @returns {Promise<Object>} Processing result for this type
   */
  async _processConnectionType(connectionType, masterIndex, state) {
    try {
      logger.info(`Processing ${connectionType} connections`);

      const result = {
        processed: 0,
        skipped: 0,
        errors: 0,
        batches: []
      };

      // Get connection list for this type
      let connections;

      if (connectionType === 'incoming' || connectionType === 'outgoing') {
        // Handle invitation collection
        const invitationsData = await this._getSentInvitesList(state);

        if (connectionType === 'incoming') {
          connections = invitationsData.received;
        } else if (connectionType === 'outgoing') {
          connections = invitationsData.sent;
        }

        // Store invitation metadata for batch processing
        result.invitationMetadata = {
          totalReceived: invitationsData.totalReceived,
          totalSent: invitationsData.totalSent,
          totalInvitations: invitationsData.totalInvitations
        };
      } else {
        // Handle regular connections (allies)
        connections = await this._getConnectionList(connectionType, masterIndex, state);
      }

      if (!connections || connections.length === 0) {
        logger.info(`No ${connectionType} connections found`);
        return result;
      }

      // Create batch files
      const batchFiles = await this._createBatchFiles(connectionType, connections, masterIndex);

      // Process each batch
      for (let batchIndex = 0; batchIndex < batchFiles.length; batchIndex++) {
        // Skip completed batches if resuming
        if (state.completedBatches && state.completedBatches.includes(batchIndex)) {
          logger.info(`Skipping completed batch ${batchIndex} for ${connectionType}`);
          continue;
        }

        // Skip if resuming from a later batch
        if (state.currentBatch && batchIndex < state.currentBatch) {
          continue;
        }

        logger.info(`Processing batch ${batchIndex} for ${connectionType}`);
        const batchResult = await this._processBatch(batchFiles[batchIndex], state);

        result.processed += batchResult.processed;
        result.skipped += batchResult.skipped;
        result.errors += batchResult.errors;
        result.batches.push(batchResult);

        // Update progress in master index
        masterIndex.processingState.currentList = connectionType;
        masterIndex.processingState.currentBatch = batchIndex;
        masterIndex.processingState.completedBatches.push(batchIndex);

        // Add random delay between batches to respect LinkedIn rate limits
        await RandomHelpers.randomDelay(2000, 5000);
      }

      logger.info(`Completed processing ${connectionType} connections:`, result);
      return result;

    } catch (error) {
      logger.error(`Failed to process ${connectionType} connections:`, error);
      throw error;
    }
  }

  /**
   * Create batch files for a connection type
   * @param {string} connectionType - Type of connections
   * @param {Array} connections - Array of connection profile IDs
   * @param {Object} masterIndex - Master index data
   * @returns {Promise<Array>} Array of batch file paths
   */
  async _createBatchFiles(connectionType, connections, masterIndex) {
    try {
      const batchFiles = [];
      const totalBatches = Math.ceil(connections.length / this.batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * this.batchSize;
        const endIndex = Math.min(startIndex + this.batchSize, connections.length);
        const batchConnections = connections.slice(startIndex, endIndex);

        const batchFileName = `${connectionType}-connections-batch-${i}.json`;
        const batchFilePath = path.join('data', batchFileName);

        const batchData = {
          batchNumber: i,
          connectionType: connectionType,
          connections: batchConnections,
          batchMetadata: {
            startIndex: startIndex,
            endIndex: endIndex - 1,
            capturedAt: new Date().toISOString()
          }
        };

        await fs.writeFile(batchFilePath, JSON.stringify(batchData, null, 2));
        batchFiles.push(batchFilePath);

        // Update master index with batch file reference
        const connectionKey = `${connectionType}Connections`;
        if (!masterIndex.files[connectionKey]) {
          masterIndex.files[connectionKey] = [];
        }
        masterIndex.files[connectionKey].push(batchFileName);
      }

      logger.info(`Created ${batchFiles.length} batch files for ${connectionType} connections`);
      return batchFiles;

    } catch (error) {
      logger.error(`Failed to create batch files for ${connectionType}:`, error);
      throw error;
    }
  }

  /**
   * Process a single batch file
   * @param {string} batchFilePath - Path to batch file
   * @param {Object} state - Profile initialization state
   * @returns {Promise<Object>} Batch processing result
   */
  async _processBatch(batchFilePath, state) {
    const requestId = state.requestId || 'unknown';
    const startTime = Date.now();
    let batchData = null;

    try {
      logger.info(`Processing batch file: ${batchFilePath}`, {
        requestId,
        batchFilePath,
        currentIndex: state.currentIndex,
        recursionCount: state.recursionCount
      });

      // Load batch data with error handling
      try {
        const batchContent = await fs.readFile(batchFilePath, 'utf8');
        batchData = JSON.parse(batchContent);
      } catch (fileError) {
        logger.error(`Failed to load batch file: ${batchFilePath}`, {
          requestId,
          batchFilePath,
          error: fileError.message
        });
        throw new Error(`Batch file loading failed: ${fileError.message}`);
      }

      const result = {
        batchNumber: batchData.batchNumber,
        batchFilePath,
        processed: 0,
        skipped: 0,
        errors: 0,
        connections: [],
        startTime: new Date().toISOString()
      };

      logger.info(`Starting batch processing`, {
        requestId,
        batchNumber: batchData.batchNumber,
        totalConnections: batchData.connections.length,
        resumingFromIndex: state.currentIndex || 0
      });

      // Process each connection in the batch
      for (let i = 0; i < batchData.connections.length; i++) {
        // Skip if resuming from a specific index
        if (state.currentIndex && i < state.currentIndex) {
          logger.debug(`Skipping connection at index ${i} - resuming from index ${state.currentIndex}`, {
            requestId,
            batchNumber: batchData.batchNumber,
            skipIndex: i,
            resumeIndex: state.currentIndex
          });
          continue;
        }

        const connectionData = batchData.connections[i];
        const connectionStartTime = Date.now();

        // Handle both invitation objects and simple profile ID strings
        let connectionProfileId;
        let connectionStatus = null;

        if (typeof connectionData === 'object' && connectionData.profileId) {
          // This is an invitation object with profileId and status
          connectionProfileId = connectionData.profileId;
          connectionStatus = connectionData.status;
        } else {
          // This is a simple profile ID string
          connectionProfileId = connectionData;
        }

        try {
          // Update current processing index in state for recovery
          state.currentIndex = i;

          logger.debug(`Processing connection ${i + 1}/${batchData.connections.length}`, {
            requestId,
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            profileId: connectionProfileId,
            status: connectionStatus
          });

          // Check if edge already exists to avoid reprocessing
          const edgeExists = await this.checkEdgeExists(connectionProfileId);

          if (edgeExists) {
            const connectionDuration = Date.now() - connectionStartTime;
            logger.debug(`Skipping ${connectionProfileId}: Edge already exists`, {
              requestId,
              profileId: connectionProfileId,
              connectionIndex: i,
              duration: connectionDuration
            });

            result.skipped++;
            result.connections.push({
              profileId: connectionProfileId,
              status: 'skipped',
              reason: 'Edge already exists',
              index: i,
              duration: connectionDuration
            });

            // Record skipped connection in monitoring
            profileInitMonitor.recordConnection(requestId, connectionProfileId, 'skipped', connectionDuration, {
              batchNumber: batchData.batchNumber,
              connectionIndex: i,
              reason: 'Edge already exists'
            });

            continue;
          }

          // Process the connection (create database entry)
          // Extract connection type from batch data or connection status
          const connectionType = batchData.connectionType || connectionStatus || 'allies';
          await this._processConnection(connectionProfileId, state, connectionType);

          const connectionDuration = Date.now() - connectionStartTime;
          result.processed++;
          result.connections.push({
            profileId: connectionProfileId,
            status: 'processed',
            index: i,
            duration: connectionDuration
          });

          // Record successful connection processing in monitoring
          profileInitMonitor.recordConnection(requestId, connectionProfileId, 'processed', connectionDuration, {
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            batchProgress: `${i + 1}/${batchData.connections.length}`
          });

          logger.debug(`Successfully processed connection ${connectionProfileId} at index ${i}`, {
            requestId,
            profileId: connectionProfileId,
            connectionIndex: i,
            duration: connectionDuration,
            batchProgress: `${i + 1}/${batchData.connections.length}`
          });

          // Add delay between connections to respect rate limits
          await RandomHelpers.randomDelay(1000, 3000);

        } catch (error) {
          const connectionDuration = Date.now() - connectionStartTime;
          const errorDetails = this._categorizeServiceError(error);

          logger.error(`Failed to process connection ${connectionProfileId} at index ${i}`, {
            requestId,
            profileId: connectionProfileId,
            connectionIndex: i,
            duration: connectionDuration,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category,
            message: error.message,
            isConnectionLevel: errorDetails.skipConnection || false,
            batchNumber: batchData.batchNumber
          });

          result.errors++;
          result.connections.push({
            profileId: connectionProfileId,
            status: 'error',
            error: error.message,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category,
            index: i,
            duration: connectionDuration
          });

          // Record error connection in monitoring
          profileInitMonitor.recordConnection(requestId, connectionProfileId, 'error', connectionDuration, {
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category,
            isConnectionLevel: errorDetails.skipConnection || false
          });

          // For certain errors, we might want to continue processing other connections
          // rather than failing the entire batch
          if (this._isConnectionLevelError(error)) {
            logger.warn(`Connection-level error for ${connectionProfileId}, continuing with next connection`, {
              requestId,
              profileId: connectionProfileId,
              errorType: errorDetails.type,
              continuingBatch: true
            });
            continue;
          }

          // For more serious errors, we should fail the batch
          logger.error(`Serious error encountered, failing batch`, {
            requestId,
            batchNumber: batchData.batchNumber,
            profileId: connectionProfileId,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category
          });

          // Add batch context to error
          error.context = {
            ...error.context,
            batchNumber: batchData.batchNumber,
            batchFilePath,
            connectionIndex: i,
            totalConnections: batchData.connections.length,
            processedSoFar: result.processed,
            skippedSoFar: result.skipped,
            errorsSoFar: result.errors
          };

          throw error;
        }
      }

      // Reset current index after successful batch completion
      state.currentIndex = 0;

      const batchDuration = Date.now() - startTime;
      result.endTime = new Date().toISOString();
      result.duration = batchDuration;

      logger.info(`Batch processing completed successfully`, {
        requestId,
        batchNumber: result.batchNumber,
        batchDuration,
        processed: result.processed,
        skipped: result.skipped,
        errors: result.errors,
        totalConnections: batchData.connections.length,
        successRate: batchData.connections.length > 0 ?
          ((result.processed / batchData.connections.length) * 100).toFixed(2) + '%' : '0%'
      });

      return result;

    } catch (error) {
      const batchDuration = Date.now() - startTime;

      logger.error(`Failed to process batch ${batchFilePath}`, {
        requestId,
        batchFilePath,
        batchDuration,
        batchNumber: batchData?.batchNumber || 'unknown',
        message: error.message,
        stack: error.stack,
        currentIndex: state.currentIndex,
        recursionCount: state.recursionCount
      });

      // Add batch context to error if not already present
      if (!error.context) {
        error.context = {};
      }

      error.context = {
        ...error.context,
        batchFilePath,
        batchNumber: batchData?.batchNumber || 'unknown',
        batchDuration,
        currentIndex: state.currentIndex,
        recursionCount: state.recursionCount
      };

      throw error;
    }
  }

  /**
   * Determine if an error is connection-specific and shouldn't fail the entire batch
   * @param {Error} error - The error that occurred
   * @returns {boolean} True if this is a connection-level error
   */
  _isConnectionLevelError(error) {
    const connectionLevelErrors = [
      /profile.*not.*found/i,
      /profile.*private/i,
      /profile.*unavailable/i,
      /screenshot.*failed/i,
      /invalid.*profile/i,
      /profile.*deleted/i
    ];

    const errorMessage = error.message || error.toString();
    return connectionLevelErrors.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Process a single connection profile
   * @param {string} connectionProfileId - LinkedIn profile ID
   * @param {Object} state - Profile initialization state
   * @param {string} connectionType - Type of connection (allies, incoming, outgoing)
   */
  async _processConnection(connectionProfileId, state, connectionType) {
    const requestId = state.requestId || 'unknown';
    const startTime = Date.now();
    let tempDir = null;

    try {
      logger.debug(`Processing connection: ${connectionProfileId}`, {
        requestId,
        profileId: connectionProfileId,
        currentBatch: state.currentBatch,
        currentIndex: state.currentIndex
      });

      // Create temporary directory for screenshots
      tempDir = path.join('backend', 'screenshots', `linkedin-screenshots${uuidv4().substring(0, 6)}`);
      await fs.mkdir(tempDir, { recursive: true });

      let screenshotResult = null;
      let databaseResult = null;

      try {
        // Capture profile screenshot using LinkedInContactService patterns
        logger.debug(`Capturing screenshot for connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId,
          tempDir
        });

        screenshotResult = await this.captureProfileScreenshot(connectionProfileId, tempDir);

        if (screenshotResult && screenshotResult.success) {
          logger.debug(`Screenshot captured successfully for ${connectionProfileId}`, {
            requestId,
            profileId: connectionProfileId,
            screenshotPath: screenshotResult.path
          });
        } else {
          logger.warn(`Screenshot capture failed for ${connectionProfileId}`, {
            requestId,
            profileId: connectionProfileId,
            reason: screenshotResult?.message || 'Unknown screenshot error'
          });
        }

        // Create database entry for the connection using existing DynamoDB patterns
        logger.debug(`Creating database entry for connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId
        });

        databaseResult = await this.dynamoDBService.createGoodContactEdges(connectionProfileId, connectionType);

        const processingDuration = Date.now() - startTime;
        logger.debug(`Successfully processed connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId,
          processingDuration,
          screenshotSuccess: screenshotResult?.success || false,
          databaseSuccess: !!databaseResult
        });

      } catch (processingError) {
        const processingDuration = Date.now() - startTime;
        const errorDetails = this._categorizeServiceError(processingError);

        logger.error(`Failed to process connection ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId,
          processingDuration,
          errorType: errorDetails.type,
          errorCategory: errorDetails.category,
          message: processingError.message,
          isConnectionLevel: errorDetails.skipConnection || false,
          currentBatch: state.currentBatch,
          currentIndex: state.currentIndex
        });

        // Add context to the error
        processingError.context = {
          requestId,
          profileId: connectionProfileId,
          duration: processingDuration,
          errorDetails,
          screenshotAttempted: !!screenshotResult,
          screenshotSuccess: screenshotResult?.success || false,
          databaseAttempted: !!databaseResult
        };

        throw processingError;
      }

    } catch (error) {
      const totalDuration = Date.now() - startTime;

      // Log the error with full context
      logger.error(`Connection processing failed for ${connectionProfileId}`, {
        requestId,
        profileId: connectionProfileId,
        totalDuration,
        message: error.message,
        stack: error.stack,
        tempDir,
        currentState: {
          batch: state.currentBatch,
          index: state.currentIndex,
          processingList: state.currentProcessingList
        }
      });

      throw error;

    } finally {
      // Clean up temporary directory with enhanced error handling
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          logger.debug(`Cleaned up temp directory: ${tempDir}`, {
            requestId,
            profileId: connectionProfileId
          });
        } catch (cleanupError) {
          logger.warn(`Failed to cleanup temp directory ${tempDir}`, {
            requestId,
            profileId: connectionProfileId,
            cleanupError: cleanupError.message,
            tempDir
          });

          // Don't throw cleanup errors, just log them
        }
      }
    }
  }

  /**
   * Check if edge exists between user and connection profile
   * The user ID is extracted from the JWT token in the Lambda function
   * @param {string} connectionProfileId - Connection profile ID
   * @returns {Promise<boolean>} True if edge exists
   */
  async checkEdgeExists(connectionProfileId) {
    try {
      return await this.dynamoDBService.checkEdgeExists(connectionProfileId);
    } catch (error) {
      logger.error(`Failed to check edge existence for ${connectionProfileId}:`, error);
      // Return false to allow processing if check fails
      return false;
    }
  }

  /**
   * Capture profile screenshot using existing LinkedInContactService patterns
   * @param {string} profileId - LinkedIn profile ID
   * @param {string} tempDir - Temporary directory for screenshots
   * @returns {Promise<Object>} Screenshot capture result
   */
  async captureProfileScreenshot(profileId, tempDir) {
    try {
      logger.info(`Capturing profile screenshot for: ${profileId}`);

      // Use existing LinkedInContactService method
      const result = await this.linkedInContactService.takeScreenShotAndUploadToS3(profileId, tempDir);

      logger.info(`Profile screenshot captured successfully for: ${profileId}`);
      return result;

    } catch (error) {
      logger.error(`Failed to capture profile screenshot for ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection counts for different types by navigating to LinkedIn
   * @returns {Promise<Object>} Connection counts
   */
  async _getConnectionCounts() {
    try {
      logger.info('Getting connection counts from LinkedIn');

      const counts = {
        allies: 0,
        incoming: 0,
        outgoing: 0
      };

      // Navigate to LinkedIn connections page
      const connectionsUrl = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';
      await this.puppeteer.goto(connectionsUrl);
      await RandomHelpers.randomDelay(3000, 5000);

      try {
        // Extract total connections count from the page
        const allConnectionsCount = await this.puppeteer.getPage().evaluate(() => {
          // Look for connection count indicators on the page
          const countSelectors = [
            '[data-test-id="connections-count"]',
            '.mn-connections__header-count',
            '.mn-connections__header h1',
            'h1[data-test-id="connections-header"]'
          ];

          for (const selector of countSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const text = element.textContent || element.innerText;
              const match = text.match(/(\d+(?:,\d+)*)/);
              if (match) {
                return parseInt(match[1].replace(/,/g, ''));
              }
            }
          }

          // Fallback: count visible connection items
          const connectionItems = document.querySelectorAll('[data-test-id="connection-card"], .mn-connection-card');
          return connectionItems.length;
        });

        counts.allies = allConnectionsCount || 0;
        logger.info(`Found ${counts.allies} total allies connections`);

      } catch (error) {
        logger.warn('Could not extract connection count from page:', error.message);
      }

      // Navigate to pending invitations
      try {
        const pendingUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/';
        await this.puppeteer.goto(pendingUrl);
        await RandomHelpers.randomDelay(2000, 4000);

        const pendingCount = await this.puppeteer.getPage().evaluate(() => {
          const pendingItems = document.querySelectorAll('[data-test-id="invitation-card"], .invitation-card');
          return pendingItems.length;
        });

        counts.incoming = pendingCount || 0;
        logger.info(`Found ${counts.incoming} incoming connections`);

      } catch (error) {
        logger.warn('Could not get pending connections count:', error.message);
      }

      // Navigate to sent invitations
      try {
        const sentUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/sent/';
        await this.puppeteer.goto(sentUrl);
        await RandomHelpers.randomDelay(2000, 4000);

        const sentCount = await this.puppeteer.getPage().evaluate(() => {
          const sentItems = document.querySelectorAll('[data-test-id="sent-invitation-card"], .sent-invitation-card');
          return sentItems.length;
        });

        counts.outgoing = sentCount || 0;
        logger.info(`Found ${counts.outgoing} outgoing connections`);

      } catch (error) {
        logger.warn('Could not get sent connections count:', error.message);
      }

      logger.info('Connection counts retrieved:', counts);
      return counts;

    } catch (error) {
      logger.error('Failed to get connection counts:', error);
      throw error;
    }
  }

  /**
   * Get connection list for a specific type by navigating to LinkedIn and extracting profile IDs
   * @param {string} connectionType - Type of connections (allies)
   * @param {Object} masterIndex - Master index for file management
   * @returns {Promise<Array>} Array of connection profile IDs
   */
  async _getConnectionList(connectionType, masterIndex, state) {
    const timeout = 30000; // 30 second timeout for actions

    try {
      logger.info(`Getting ${connectionType} connection list from LinkedIn`);

      const page = this.puppeteer.getPage();

      // Navigate to connections by clicking the network icon in global nav
      logger.info('Clicking network icon in global navigation');
      const targetPage = page;
      let frame = targetPage.mainFrame();
      frame = frame.childFrames()[0];

      await this.puppeteer.Locator.race([
        frame.locator('#global-nav li:nth-of-type(2) svg'),
        frame.locator('::-p-xpath(//*[@id="global-nav"]/div/nav/ul/li[2]/a/div/div/li-icon/svg)'),
        frame.locator(':scope >>> #global-nav li:nth-of-type(2) svg')
      ]).setTimeout(timeout).click({
        offset: { x: 13, y: 23 }
      });

      // Wait for navigation and page load
      await RandomHelpers.randomDelay(2000, 3000);

      // Click on "Connections" tab
      logger.info('Clicking on Connections tab');
      await this.puppeteer.Locator.race([
        targetPage.locator('div > div > section li:nth-of-type(1) span.c916d854 > span'),
        targetPage.locator('::-p-xpath(//*[@id="workspace"]/div/div/section/div/div/section[1]/div/nav/ul/li[1]/button/span[2]/span)'),
        targetPage.locator(':scope >>> div > div > section li:nth-of-type(1) span.c916d854 > span'),
        targetPage.locator('::-p-text(Connections)')
      ]).setTimeout(timeout).click({
        offset: { x: 82, y: 0 }
      });

      // Wait for connections list to load
      await RandomHelpers.randomDelay(3000, 5000);

      // Collect all connection links with expansion and robust file saving
      const profileIds = await this._collectConnectionLinksWithExpansion(page, timeout, connectionType, masterIndex, state);

      logger.info(`Extracted ${profileIds.length} ${connectionType} connection profile IDs`);

      // Log first few profile IDs for debugging (without exposing sensitive data)
      if (profileIds.length > 0) {
        const sampleIds = profileIds.slice(0, 3).map(id => id.substring(0, 5) + '...');
        logger.debug(`Sample profile IDs: ${sampleIds.join(', ')}`);
      }

      return profileIds;

    } catch (error) {
      logger.error(`Failed to get ${connectionType} connection list:`, error);
      throw error;
    }
  }

  /**
   * Collect connection links with expansion functionality and robust file saving
   * @param {Object} page - Puppeteer page object
   * @param {number} timeout - Timeout for actions
   * @param {string} connectionType - Type of connections (allies, incoming, outgoing)
   * @param {Object} masterIndex - Master index for file management
   * @param {Object} state - Current processing state for healing support
   * @returns {Promise<Array>} Array of unique profile IDs
   */
  async _collectConnectionLinksWithExpansion(page, timeout, connectionType, masterIndex, state) {
    try {
      logger.info(`Starting ${connectionType} connection link collection with expansion and file saving`);

      const allLinks = new Set();
      let expansionAttempts = 0;
      const maxExpansionAttempts = 50; // Prevent infinite expansion
      let currentFileIndex = 0;
      let currentFileLinks = [];

      // Check if we're resuming from a healing state
      const resumeParams = ProfileInitStateManager.getListCreationResumeParams(state);
      if (resumeParams && resumeParams.connectionType === connectionType) {
        logger.info(`Resuming ${connectionType} collection from healing state`, {
          expansionAttempt: resumeParams.expansionAttempt,
          currentFileIndex: resumeParams.currentFileIndex,
          lastSavedFile: resumeParams.lastSavedFile?.fileName
        });
        
        expansionAttempts = resumeParams.expansionAttempt;
        currentFileIndex = resumeParams.currentFileIndex;
        
        // Load existing links from saved files if available
        if (resumeParams.lastSavedFile) {
          try {
            const existingLinks = await this._loadExistingLinksFromFiles(connectionType, masterIndex);
            existingLinks.forEach(link => allLinks.add(link));
            logger.info(`Loaded ${allLinks.size} existing ${connectionType} links from saved files`);
          } catch (loadError) {
            logger.warn(`Failed to load existing ${connectionType} links, starting fresh:`, loadError.message);
          }
        }
      }

      // Initial collection of visible links (or continue from where we left off)
      if (allLinks.size === 0) {
        await this._collectVisibleLinks(page, allLinks);
        logger.info(`Initial ${connectionType} collection: ${allLinks.size} links found`);

        // Save initial collection
        await this._saveLinksToFile(Array.from(allLinks), connectionType, currentFileIndex, masterIndex);
        currentFileLinks = Array.from(allLinks);
      } else {
        // We're resuming, collect current visible links and merge
        const currentVisibleLinks = new Set();
        await this._collectVisibleLinks(page, currentVisibleLinks);
        currentVisibleLinks.forEach(link => allLinks.add(link));
        logger.info(`Resumed ${connectionType} collection: ${allLinks.size} total links (${currentVisibleLinks.size} newly visible)`);
      }

      // Continue expanding and collecting until no more content (button or scroll)
      while (expansionAttempts < maxExpansionAttempts) {
        try {
          // Determine next expansion action: button click or scroll
          const expandAction = await page.evaluate(() => {
            const selectors = [
              'div._6ce2ab68 > button > span',
              'button[aria-label*="Show more"]',
              'button[data-test-id="show-more-connections"]',
              'button:has-text("Show more")',
              '.scaffold-finite-scroll__load-button button'
            ];

            for (const selector of selectors) {
              const button = document.querySelector(selector);
              if (button && button.offsetParent !== null) {
                return 'button';
              }
            }

            // If no button, check whether we can scroll further
            const currentHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop + viewportHeight < currentHeight - 100) {
              return 'scroll';
            }
            return false;
          });

          if (!expandAction) {
            logger.info(`No more content available after ${expansionAttempts} attempts`);
            break;
          }

          if (expandAction === 'button') {
            // Click the expansion button
            logger.debug(`Clicking expansion button (attempt ${expansionAttempts + 1})`);
            await this.puppeteer.Locator.race([
              page.locator('div._6ce2ab68 > button > span'),
              page.locator('::-p-xpath(//*[@id="workspace"]/div/div/main/section/div/div[2]/div/div[40]/button/span)'),
              page.locator(':scope >>> div._6ce2ab68 > button > span')
            ]).setTimeout(timeout).click({
              offset: { x: 212, y: 19.5 }
            });
          } else {
            // Fallback to scrolling to load more
            logger.debug(`Scrolling to load more connections (attempt ${expansionAttempts + 1})`);
            await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
          }

          // Wait for new content to load
          await RandomHelpers.randomDelay(2000, 4000);

          // Collect newly loaded links
          const previousSize = allLinks.size;
          await this._collectVisibleLinks(page, allLinks);
          const newLinksFound = allLinks.size - previousSize;

          logger.debug(`Expansion ${expansionAttempts + 1}: Found ${newLinksFound} new links (total: ${allLinks.size})`);

          // If no new links were found, we might have reached the end
          if (newLinksFound === 0) {
            logger.info(`No new links found after expansion ${expansionAttempts + 1}, stopping`);
            break;
          }

          // Check if we need to create a new file (exceeding 100 links)
          const allLinksArray = Array.from(allLinks);
          if (allLinksArray.length > (currentFileIndex + 1) * this.batchSize) {
            // Save current file and create new one
            await this._saveLinksToFile(currentFileLinks, connectionType, currentFileIndex, masterIndex);

            currentFileIndex++;
            currentFileLinks = allLinksArray.slice(currentFileIndex * this.batchSize);

            logger.info(`Created new file ${currentFileIndex} for ${connectionType} connections (${allLinksArray.length} total links)`);
          } else {
            // Update current file with new links
            currentFileLinks = allLinksArray.slice(currentFileIndex * this.batchSize);
          }

          // Save after every expansion
          await this._saveLinksToFile(currentFileLinks, connectionType, currentFileIndex, masterIndex);

          expansionAttempts++;

        } catch (expansionError) {
          logger.warn(`Error during expansion attempt ${expansionAttempts + 1}:`, expansionError.message);

          // Try to collect any remaining visible links before breaking
          await this._collectVisibleLinks(page, allLinks);

          // Save whatever we have collected
          const finalLinks = Array.from(allLinks);
          await this._saveLinksToFile(finalLinks.slice(currentFileIndex * this.batchSize), connectionType, currentFileIndex, masterIndex);
          break;
        }
      }

      logger.info(`${connectionType} connection link collection completed: ${allLinks.size} unique links found after ${expansionAttempts} expansions`);

      // Convert Set to Array and extract profile IDs
      const profileIds = Array.from(allLinks).map(link => {
        const match = link.match(/\/in\/([^\/\?]+)/);
        if (match && match[1]) {
          return match[1].replace(/\/$/, '').split('?')[0];
        }
        return null;
      }).filter(id => id && id !== 'undefined' && id.length > 0);

      // Remove duplicates using Set
      const uniqueProfileIds = Array.from(new Set(profileIds));

      logger.info(`Extracted ${uniqueProfileIds.length} unique profile IDs from ${allLinks.size} links`);

      return uniqueProfileIds;

    } catch (error) {
      logger.error(`Failed to collect ${connectionType} connection links with expansion:`, error);
      throw error;
    }
  }

  /**
   * Load existing links from saved files for healing recovery
   * @param {string} connectionType - Type of connections (allies, incoming, outgoing)
   * @param {Object} masterIndex - Master index containing file references
   * @returns {Promise<Array>} Array of existing links
   */
  async _loadExistingLinksFromFiles(connectionType, masterIndex) {
    try {
      const connectionKey = `${connectionType}Connections`;
      const fileReferences = masterIndex.files[connectionKey] || [];
      const allLinks = [];

      for (const fileRef of fileReferences) {
        try {
          const filePath = path.join('data', fileRef.fileName || fileRef);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const fileData = JSON.parse(fileContent);
          
          if (fileData.links) {
            allLinks.push(...fileData.links);
          } else if (fileData.invitations) {
            // Handle invitation files
            allLinks.push(...fileData.invitations.map(inv => inv.originalUrl || `/in/${inv.profileId}`));
          }
        } catch (fileError) {
          logger.warn(`Failed to load file ${fileRef.fileName || fileRef}:`, fileError.message);
        }
      }

      logger.info(`Loaded ${allLinks.length} existing ${connectionType} links from ${fileReferences.length} files`);
      return allLinks;

    } catch (error) {
      logger.error(`Failed to load existing ${connectionType} links:`, error);
      throw error;
    }
  }

  /**
   * Determine if an error during list creation should trigger healing
   * @param {Error} error - The error that occurred
   * @returns {boolean} True if healing should be triggered
   */
  _shouldTriggerListCreationHealing(error) {
    const recoverableListCreationErrors = [
      /timeout/i,
      /navigation.*failed/i,
      /element.*not.*found/i,
      /click.*failed/i,
      /network.*error/i,
      /connection.*reset/i,
      /page.*crashed/i,
      /target.*closed/i,
      /puppeteer.*error/i,
      /linkedin.*error/i,
      /captcha/i,
      /checkpoint/i,
      /rate.*limit/i
    ];

    const errorMessage = error.message || error.toString();
    return recoverableListCreationErrors.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Handle healing during list creation
   * @param {Object} state - Current state
   * @param {string} connectionType - Type of connection being collected
   * @param {number} expansionAttempt - Current expansion attempt
   * @param {number} currentFileIndex - Current file index
   * @param {Object} masterIndex - Current master index
   * @param {Error} error - Error that triggered healing
   */
  async _handleListCreationHealing(state, connectionType, expansionAttempt, currentFileIndex, masterIndex, error) {
    const requestId = state.requestId || 'unknown';
    
    logger.warn(`List creation failed for ${connectionType}. Initiating healing.`, {
      requestId,
      connectionType,
      expansionAttempt,
      currentFileIndex,
      errorMessage: error.message,
      recursionCount: state.recursionCount || 0
    });

    // Create list creation healing state
    const healingState = ProfileInitStateManager.createListCreationHealingState(
      state,
      connectionType,
      expansionAttempt,
      currentFileIndex,
      masterIndex,
      `List creation failed: ${error.message}`
    );

    // Update master index with healing state
    await this._updateMasterIndex(state.masterIndexFile, masterIndex);

    logger.info('Created list creation healing state', {
      requestId,
      healingState: {
        healPhase: healingState.healPhase,
        connectionType: healingState.listCreationState.connectionType,
        expansionAttempt: healingState.listCreationState.expansionAttempt,
        currentFileIndex: healingState.listCreationState.currentFileIndex,
        recursionCount: healingState.recursionCount
      }
    });

    // Trigger healing process
    throw new Error(`LIST_CREATION_HEALING_NEEDED:${JSON.stringify(healingState)}`);
  }

  /**
   * Save links to file with proper file management and master index updates
   * @param {Array} links - Array of links to save
   * @param {string} connectionType - Type of connections (allies, incoming, outgoing)
   * @param {number} fileIndex - Current file index
   * @param {Object} masterIndex - Master index for tracking files
   */
  async _saveLinksToFile(links, connectionType, fileIndex, masterIndex) {
    try {
      const timestamp = Date.now();
      const fileName = `${connectionType}-connections-${fileIndex}-${timestamp}.json`;
      const filePath = path.join('data', fileName);

      // Convert links to profile IDs if they're URLs
      const profileIds = links.map(link => {
        if (typeof link === 'string' && link.includes('/in/')) {
          const match = link.match(/\/in\/([^\/\?]+)/);
          return match && match[1] ? match[1].replace(/\/$/, '').split('?')[0] : null;
        }
        return link;
      }).filter(id => id && id !== 'undefined' && id.length > 0);

      const fileData = {
        connectionType: connectionType,
        fileIndex: fileIndex,
        capturedAt: new Date().toISOString(),
        totalLinks: profileIds.length,
        links: profileIds,
        metadata: {
          batchSize: this.batchSize,
          isComplete: profileIds.length < this.batchSize
        }
      };

      // Ensure data directory exists
      await fs.mkdir('data', { recursive: true });

      // Save the file
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));

      // Update master index
      const connectionKey = `${connectionType}Connections`;
      if (!masterIndex.files[connectionKey]) {
        masterIndex.files[connectionKey] = [];
      }

      // Update or add file reference in master index
      const existingFileIndex = masterIndex.files[connectionKey].findIndex(f =>
        f.fileIndex === fileIndex || f.fileName === fileName
      );

      const fileReference = {
        fileName: fileName,
        filePath: filePath,
        fileIndex: fileIndex,
        totalLinks: profileIds.length,
        capturedAt: new Date().toISOString(),
        isComplete: profileIds.length < this.batchSize
      };

      if (existingFileIndex >= 0) {
        masterIndex.files[connectionKey][existingFileIndex] = fileReference;
      } else {
        masterIndex.files[connectionKey].push(fileReference);
      }

      // Update metadata totals
      const totalKey = `total${connectionType.charAt(0).toUpperCase() + connectionType.slice(1)}`;
      const currentTotal = masterIndex.files[connectionKey].reduce((sum, file) => sum + file.totalLinks, 0);
      masterIndex.metadata[totalKey] = currentTotal;

      logger.info(`Saved ${profileIds.length} ${connectionType} links to ${fileName}`, {
        fileIndex,
        totalLinks: profileIds.length,
        filePath,
        isComplete: fileData.metadata.isComplete
      });

      return filePath;

    } catch (error) {
      logger.error(`Failed to save ${connectionType} links to file:`, error);
      throw error;
    }
  }

  /**
   * Collect all visible connection links on the current page
   * @param {Object} page - Puppeteer page object
   * @param {Set} allLinks - Set to store collected links
   */
  async _collectVisibleLinks(page, allLinks) {
    try {
      const newLinks = await page.evaluate(() => {
        const links = new Set();

        // Multiple selectors to find connection profile links
        const selectors = [
          'a[href*="/in/"]',
          '[data-test-id="connection-card"] a[href*="/in/"]',
          '.mn-connection-card a[href*="/in/"]',
          '.connection-card a[href*="/in/"]',
          'a[data-test-id="connection-profile-link"]',
          '.entity-result__title-text a[href*="/in/"]',
          '.search-result__title a[href*="/in/"]'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);

          for (const element of elements) {
            const href = element.getAttribute('href');
            if (href && href.includes('/in/')) {
              // Clean up the URL
              const cleanHref = href.split('?')[0].replace(/\/$/, '');
              if (cleanHref.match(/\/in\/[^\/]+$/)) {
                links.add(cleanHref);
              }
            }
          }
        }

        return Array.from(links);
      });

      // Add new links to the main set
      const initialSize = allLinks.size;
      newLinks.forEach(link => allLinks.add(link));
      const addedCount = allLinks.size - initialSize;

      if (addedCount > 0) {
        logger.debug(`Collected ${addedCount} new links (${newLinks.length} found, ${allLinks.size} total unique)`);
      }

    } catch (error) {
      logger.error('Failed to collect visible links:', error);
      throw error;
    }
  }

  /**
   * Collect sent invites from LinkedIn invitation manager
   * @returns {Promise<Object>} Object containing received and sent invitations with status labels
   */
  async _getSentInvitesList(state) {
    const timeout = 30000; // 30 second timeout for actions

    try {
      logger.info('Getting sent invites list from LinkedIn');

      const page = this.puppeteer.getPage();

      // Navigate to LinkedIn feed first
      logger.info('Navigating to LinkedIn feed');
      await this.puppeteer.goto('https://www.linkedin.com/feed/');
      await RandomHelpers.randomDelay(3000, 5000);

      // Navigate to invitations by clicking the network icon in global nav
      logger.info('Clicking network icon in global navigation for invitations');
      const targetPage = page;
      let frame = targetPage.mainFrame();
      frame = frame.childFrames()[1];

      const promises = [];
      const startWaitingForEvents = () => {
        promises.push(frame.waitForNavigation());
      };

      await this.puppeteer.Locator.race([
        frame.locator('#global-nav li:nth-of-type(2) svg'),
        frame.locator('::-p-xpath(//*[@id="global-nav"]/div/nav/ul/li[2]/a/div/div/li-icon/svg)'),
        frame.locator(':scope >>> #global-nav li:nth-of-type(2) svg')
      ]).setTimeout(timeout).on('action', () => startWaitingForEvents()).click({
        offset: { x: 8, y: 11 }
      });

      await Promise.all(promises);

      // Click on the invitations section
      logger.info('Clicking on invitations section');
      await this.puppeteer.Locator.race([
        targetPage.locator('main > div > div > div > div > div:nth-of-type(1) button > span'),
        targetPage.locator('::-p-xpath(//*[@id="workspace"]/div/div/main/div/div/div/div/div[1]/section/div/div/div/div[1]/button/span)'),
        targetPage.locator(':scope >>> main > div > div > div > div > div:nth-of-type(1) button > span')
      ]).setTimeout(timeout).click({
        delay: 383.90000000037253,
        offset: { x: 34, y: 3 }
      });

      // Wait for invitations page to load
      await RandomHelpers.randomDelay(3000, 5000);

      // Create a temporary master index for invitation collection
      const tempMasterIndex = {
        files: {
          incomingConnections: [],
          outgoingConnections: []
        },
        metadata: {
          totalIncoming: 0,
          totalOutgoing: 0
        }
      };

      // Collect received invitations (default tab)
      logger.info('Collecting received invitations');
      const receivedInvitations = await this._collectInvitationLinksWithRobustSaving(page, 'incoming', tempMasterIndex, state);

      // Navigate to sent invitations tab
      logger.info('Navigating to sent invitations tab');
      await this.puppeteer.Locator.race([
        targetPage.locator('span:nth-of-type(12)'),
        targetPage.locator('::-p-xpath(//*[@data-testid="loader"]/span[12])'),
        targetPage.locator(':scope >>> span:nth-of-type(12)')
      ]).setTimeout(timeout).click({
        offset: { x: 16, y: 10 }
      });

      // Wait for sent invitations to load
      await RandomHelpers.randomDelay(3000, 5000);

      // Collect sent invitations
      logger.info('Collecting sent invitations');
      const sentInvitations = await this._collectInvitationLinksWithRobustSaving(page, 'outgoing', tempMasterIndex, state);

      const result = {
        received: receivedInvitations,
        sent: sentInvitations,
        totalReceived: receivedInvitations.length,
        totalSent: sentInvitations.length,
        totalInvitations: receivedInvitations.length + sentInvitations.length
      };

      logger.info(`Collected invitations summary:`, {
        received: result.totalReceived,
        sent: result.totalSent,
        total: result.totalInvitations
      });

      return result;

    } catch (error) {
      logger.error('Failed to get sent invites list:', error);
      throw error;
    }
  }

  /**
   * Collect invitation links with robust file saving after every expansion
   * @param {Object} page - Puppeteer page object
   * @param {string} status - Status label ('incoming' or 'outgoing')
   * @param {Object} masterIndex - Master index for file management
   * @returns {Promise<Array>} Array of invitation objects with profile IDs and status
   */
  async _collectInvitationLinksWithRobustSaving(page, status, masterIndex, state) {
    return await this._collectInvitationLinksInternal(page, status, masterIndex, true, state);
  }

  /**
   * Internal shared implementation for invitation link collection
   * @param {Object} page
   * @param {string} status
   * @param {Object|null} masterIndex
   * @param {boolean} saveDuringExpansion - whether to persist partial results
   */
  async _collectInvitationLinksInternal(page, status, masterIndex = null, saveDuringExpansion = false, state = null) {
    try {
      logger.info(`Collecting ${status.toLowerCase()} invitation links${saveDuringExpansion ? ' with robust file saving' : ''}`);

      const allLinks = new Set();
      let expansionAttempts = 0;
      const maxExpansionAttempts = 50;
      let currentFileIndex = 0;
      let currentFileLinks = [];

      // Initial collection
      await this._collectVisibleInvitationLinks(page, allLinks);
      logger.info(`Initial ${status.toLowerCase()} collection: ${allLinks.size} links found`);

      if (saveDuringExpansion && masterIndex) {
        const initialInvitations = this._convertLinksToInvitations(Array.from(allLinks), status);
        await this._saveInvitationsToFile(initialInvitations, status, currentFileIndex, masterIndex);
        currentFileLinks = initialInvitations;
      }

      while (expansionAttempts < maxExpansionAttempts) {
        try {
          const hasMoreContent = await page.evaluate(() => {
            const showMoreButton = document.querySelector('button[aria-label*="Show more"], .scaffold-finite-scroll__load-button button, button:has-text("Show more")');
            if (showMoreButton && showMoreButton.offsetParent !== null) return 'button';

            const currentHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop + viewportHeight < currentHeight - 100) return 'scroll';
            return false;
          });

          if (!hasMoreContent) {
            logger.info(`No more content to load for ${status.toLowerCase()} invitations after ${expansionAttempts} attempts`);
            break;
          }

          const previousSize = allLinks.size;
          if (hasMoreContent === 'button') {
            logger.debug(`Clicking show more button for ${status.toLowerCase()} invitations (attempt ${expansionAttempts + 1})`);
            await page.click('button[aria-label*="Show more"], .scaffold-finite-scroll__load-button button');
          } else {
            logger.debug(`Scrolling to load more ${status.toLowerCase()} invitations (attempt ${expansionAttempts + 1})`);
            await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
          }

          await RandomHelpers.randomDelay(2000, 4000);
          await this._collectVisibleInvitationLinks(page, allLinks);
          const newLinksFound = allLinks.size - previousSize;
          logger.debug(`${status} expansion ${expansionAttempts + 1}: Found ${newLinksFound} new links (total: ${allLinks.size})`);
          if (newLinksFound === 0) {
            logger.info(`No new ${status.toLowerCase()} links found after expansion ${expansionAttempts + 1}, stopping`);
            break;
          }

          if (saveDuringExpansion && masterIndex) {
            const allInvitations = this._convertLinksToInvitations(Array.from(allLinks), status);
            if (allInvitations.length > (currentFileIndex + 1) * this.batchSize) {
              await this._saveInvitationsToFile(currentFileLinks, status, currentFileIndex, masterIndex);
              currentFileIndex++;
              currentFileLinks = allInvitations.slice(currentFileIndex * this.batchSize);
              logger.info(`Created new file ${currentFileIndex} for ${status} invitations (${allInvitations.length} total invitations)`);
            } else {
              currentFileLinks = allInvitations.slice(currentFileIndex * this.batchSize);
            }
            await this._saveInvitationsToFile(currentFileLinks, status, currentFileIndex, masterIndex);
          }

          expansionAttempts++;
        } catch (expansionError) {
          logger.warn(`Error during ${status.toLowerCase()} expansion attempt ${expansionAttempts + 1}:`, expansionError.message);
          await this._collectVisibleInvitationLinks(page, allLinks);
          if (saveDuringExpansion && masterIndex) {
            const finalInvitations = this._convertLinksToInvitations(Array.from(allLinks), status);
            await this._saveInvitationsToFile(finalInvitations.slice(currentFileIndex * this.batchSize), status, currentFileIndex, masterIndex);
          }
          break;
        }
      }

      logger.info(`${status} invitation link collection completed: ${allLinks.size} unique links found after ${expansionAttempts} expansions`);
      const invitations = this._convertLinksToInvitations(Array.from(allLinks), status);
      const uniqueInvitations = invitations.filter((invitation, index, self) => index === self.findIndex(inv => inv.profileId === invitation.profileId));
      logger.info(`Extracted ${uniqueInvitations.length} unique ${status.toLowerCase()} invitation profile IDs from ${allLinks.size} links`);
      return uniqueInvitations;
    } catch (error) {
      logger.error(`Failed to collect ${status.toLowerCase()} invitation links:`, error);
      throw error;
    }
  }

  /**
   * Collect invitation links from the current page with expansion
   * @param {Object} page - Puppeteer page object
   * @param {string} status - Status label ('incoming' or 'outgoing')
   * @returns {Promise<Array>} Array of invitation objects with profile IDs and status
   */
  async _collectInvitationLinks(page, status) {
    return await this._collectInvitationLinksInternal(page, status, null, false);
  }

  /**
   * Save invitations to file with proper file management and master index updates
   * @param {Array} invitations - Array of invitation objects to save
   * @param {string} status - Status label ('incoming' or 'outgoing')
   * @param {number} fileIndex - Current file index
   * @param {Object} masterIndex - Master index for tracking files
   */
  async _saveInvitationsToFile(invitations, status, fileIndex, masterIndex) {
    try {
      const timestamp = Date.now();
      const fileName = `${status}-invitations-${fileIndex}-${timestamp}.json`;
      const filePath = path.join('data', fileName);

      const fileData = {
        connectionType: status,
        fileIndex: fileIndex,
        capturedAt: new Date().toISOString(),
        totalInvitations: invitations.length,
        invitations: invitations,
        metadata: {
          batchSize: this.batchSize,
          isComplete: invitations.length < this.batchSize
        }
      };

      // Ensure data directory exists
      await fs.mkdir('data', { recursive: true });

      // Save the file
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));

      // Update master index
      const connectionKey = `${status}Connections`;
      if (!masterIndex.files[connectionKey]) {
        masterIndex.files[connectionKey] = [];
      }

      // Update or add file reference in master index
      const existingFileIndex = masterIndex.files[connectionKey].findIndex(f =>
        f.fileIndex === fileIndex || f.fileName === fileName
      );

      const fileReference = {
        fileName: fileName,
        filePath: filePath,
        fileIndex: fileIndex,
        totalInvitations: invitations.length,
        capturedAt: new Date().toISOString(),
        isComplete: invitations.length < this.batchSize
      };

      if (existingFileIndex >= 0) {
        masterIndex.files[connectionKey][existingFileIndex] = fileReference;
      } else {
        masterIndex.files[connectionKey].push(fileReference);
      }

      // Update metadata totals
      const totalKey = `total${status.charAt(0).toUpperCase() + status.slice(1)}`;
      const currentTotal = masterIndex.files[connectionKey].reduce((sum, file) => sum + file.totalInvitations, 0);
      masterIndex.metadata[totalKey] = currentTotal;

      logger.info(`Saved ${invitations.length} ${status} invitations to ${fileName}`, {
        fileIndex,
        totalInvitations: invitations.length,
        filePath,
        isComplete: fileData.metadata.isComplete
      });

      return filePath;

    } catch (error) {
      logger.error(`Failed to save ${status} invitations to file:`, error);
      throw error;
    }
  }

  /**
   * Convert links to invitation objects with status
   * @param {Array} links - Array of profile links
   * @param {string} status - Status label ('incoming' or 'outgoing')
   * @returns {Array} Array of invitation objects
   */
  _convertLinksToInvitations(links, status) {
    return links.map(link => {
      const match = link.match(/\/in\/([^\/\?]+)/);
      if (match && match[1]) {
        const profileId = match[1].replace(/\/$/, '').split('?')[0];
        return {
          profileId: profileId,
          status: status,
          originalUrl: link
        };
      }
      return null;
    }).filter(invitation => invitation && invitation.profileId && invitation.profileId !== 'undefined' && invitation.profileId.length > 0);
  }

  /**
   * Collect all visible invitation links on the current page
   * @param {Object} page - Puppeteer page object
   * @param {Set} allLinks - Set to store collected links
   */
  async _collectVisibleInvitationLinks(page, allLinks) {
    try {
      const newLinks = await page.evaluate(() => {
        const links = new Set();

        // Multiple selectors to find invitation profile links
        const selectors = [
          'a[href*="/in/"]',
          '[data-test-id="invitation-card"] a[href*="/in/"]',
          '[data-test-id="sent-invitation-card"] a[href*="/in/"]',
          '.invitation-card a[href*="/in/"]',
          '.sent-invitation-card a[href*="/in/"]',
          '.invitation-card__profile-link',
          '.sent-invitation-card__profile-link',
          '.entity-result__title-text a[href*="/in/"]',
          '.artdeco-entity-lockup__title a[href*="/in/"]',
          '.invitation-card__content a[href*="/in/"]'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);

          for (const element of elements) {
            const href = element.getAttribute('href');
            if (href && href.includes('/in/')) {
              // Clean up the URL
              const cleanHref = href.split('?')[0].replace(/\/$/, '');
              if (cleanHref.match(/\/in\/[^\/]+$/)) {
                links.add(cleanHref);
              }
            }
          }
        }

        return Array.from(links);
      });

      // Add new links to the main set
      const initialSize = allLinks.size;
      newLinks.forEach(link => allLinks.add(link));
      const addedCount = allLinks.size - initialSize;

      if (addedCount > 0) {
        logger.debug(`Collected ${addedCount} new invitation links (${newLinks.length} found, ${allLinks.size} total unique)`);
      }

    } catch (error) {
      logger.error('Failed to collect visible invitation links:', error);
      throw error;
    }
  }

  /**
   * Scroll through the page to load all connections
   * LinkedIn uses infinite scroll, so we need to scroll to load all content
   */
  async _scrollToLoadAllConnections() {
    try {
      logger.info('Scrolling to load all connections...');

      let previousHeight = 0;
      let currentHeight = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50; // Prevent infinite scrolling

      do {
        previousHeight = currentHeight;

        // Scroll to bottom of page
        await this.puppeteer.getPage().evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait for content to load
        await RandomHelpers.randomDelay(2000, 4000);

        // Get new height
        currentHeight = await this.puppeteer.getPage().evaluate(() => {
          return document.body.scrollHeight;
        });

        scrollAttempts++;
        logger.debug(`Scroll attempt ${scrollAttempts}: height ${currentHeight}`);

        // Check if we've reached the bottom or max attempts
        if (currentHeight === previousHeight || scrollAttempts >= maxScrollAttempts) {
          break;
        }

      } while (scrollAttempts < maxScrollAttempts);

      logger.info(`Completed scrolling after ${scrollAttempts} attempts`);

      // Scroll back to top for consistency
      await this.puppeteer.getPage().evaluate(() => {
        window.scrollTo(0, 0);
      });

      await RandomHelpers.randomDelay(1000, 2000);

    } catch (error) {
      logger.error('Failed to scroll and load connections:', error);
      throw error;
    }
  }

  /**
   * Categorize service-level errors for better handling and logging
   * @param {Error} error - The error to categorize
   * @returns {Object} Error categorization details
   */
  _categorizeServiceError(error) {
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';

    // Authentication errors
    if (/login.*failed|authentication.*failed|invalid.*credentials|unauthorized|captcha|checkpoint/i.test(errorMessage)) {
      return {
        type: 'AuthenticationError',
        category: 'authentication',
        isRecoverable: true,
        severity: 'high',
        retryable: true,
        maxRetries: 3
      };
    }

    // Network and connectivity errors
    if (/network.*error|connection.*reset|timeout|ECONNRESET|ENOTFOUND|ETIMEDOUT|ERR_NETWORK/i.test(errorMessage)) {
      return {
        type: 'NetworkError',
        category: 'network',
        isRecoverable: true,
        severity: 'medium',
        retryable: true,
        maxRetries: 5
      };
    }

    // LinkedIn rate limiting and restrictions
    if (/rate.*limit|too.*many.*requests|linkedin.*error|blocked|restricted/i.test(errorMessage)) {
      return {
        type: 'LinkedInRateLimitError',
        category: 'linkedin',
        isRecoverable: true,
        severity: 'high',
        retryable: true,
        maxRetries: 2,
        backoffMultiplier: 2
      };
    }

    // Database operation errors
    if (/dynamodb|database|aws.*error|ValidationException|ResourceNotFoundException|ConditionalCheckFailedException/i.test(errorMessage)) {
      return {
        type: 'DatabaseError',
        category: 'database',
        isRecoverable: false,
        severity: 'high',
        retryable: false
      };
    }

    // Browser/Puppeteer errors
    if (/puppeteer|browser|page.*crashed|navigation.*failed|target.*closed|protocol.*error/i.test(errorMessage)) {
      return {
        type: 'BrowserError',
        category: 'browser',
        isRecoverable: true,
        severity: 'medium',
        retryable: true,
        maxRetries: 3
      };
    }

    // File system errors
    if (/ENOENT|EACCES|EMFILE|file.*not.*found|permission.*denied|disk.*full/i.test(errorMessage)) {
      return {
        type: 'FileSystemError',
        category: 'filesystem',
        isRecoverable: false,
        severity: 'medium',
        retryable: false
      };
    }

    // Connection-level errors (profile-specific)
    if (/profile.*not.*found|profile.*private|profile.*unavailable|screenshot.*failed|invalid.*profile/i.test(errorMessage)) {
      return {
        type: 'ConnectionError',
        category: 'connection',
        isRecoverable: false,
        severity: 'low',
        retryable: false,
        skipConnection: true
      };
    }

    // Default categorization
    return {
      type: 'UnknownError',
      category: 'unknown',
      isRecoverable: false,
      severity: 'high',
      retryable: false
    };
  }

  /**
   * Enhanced error handling with retry logic and detailed logging
   * @param {Error} error - The error that occurred
   * @param {Object} context - Error context information
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<boolean>} True if error was handled and should retry
   */
  async _handleServiceError(error, context = {}, retryCount = 0) {
    const errorDetails = this._categorizeServiceError(error);
    const requestId = context.requestId || 'unknown';

    logger.error('Service error occurred', {
      requestId,
      errorType: errorDetails.type,
      errorCategory: errorDetails.category,
      severity: errorDetails.severity,
      isRecoverable: errorDetails.isRecoverable,
      retryable: errorDetails.retryable,
      retryCount,
      maxRetries: errorDetails.maxRetries || 0,
      message: error.message,
      context
    });

    // Handle specific error types
    switch (errorDetails.category) {
      case 'authentication':
        return await this._handleAuthenticationError(error, context, retryCount, errorDetails);

      case 'network':
        return await this._handleNetworkError(error, context, retryCount, errorDetails);

      case 'linkedin':
        return await this._handleLinkedInError(error, context, retryCount, errorDetails);

      case 'browser':
        return await this._handleBrowserError(error, context, retryCount, errorDetails);

      case 'database':
        return await this._handleDatabaseError(error, context, retryCount, errorDetails);

      case 'connection':
        return await this._handleConnectionError(error, context, retryCount, errorDetails);

      default:
        logger.error('Unhandled error type', {
          requestId,
          errorType: errorDetails.type,
          message: error.message
        });
        return false;
    }
  }

  /**
   * Handle authentication-related errors
   */
  async _handleAuthenticationError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 3)) {
      logger.warn('Authentication error - will trigger healing', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries
      });
      return true; // Trigger healing
    }

    logger.error('Authentication failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  /**
   * Handle network-related errors
   */
  async _handleNetworkError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 5)) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s

      logger.warn('Network error - will retry with backoff', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries,
        backoffDelay
      });

      await RandomHelpers.randomDelay(backoffDelay, backoffDelay + 1000);
      return true; // Trigger healing
    }

    logger.error('Network error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  /**
   * Handle LinkedIn-specific errors
   */
  async _handleLinkedInError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 2)) {
      const backoffDelay = Math.min(5000 * Math.pow(2, retryCount), 60000); // Longer backoff for LinkedIn

      logger.warn('LinkedIn error - will retry with extended backoff', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries,
        backoffDelay
      });

      await RandomHelpers.randomDelay(backoffDelay, backoffDelay + 5000);
      return true; // Trigger healing
    }

    logger.error('LinkedIn error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  /**
   * Handle browser-related errors
   */
  async _handleBrowserError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 3)) {
      logger.warn('Browser error - will trigger healing with fresh browser instance', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries
      });
      return true; // Trigger healing
    }

    logger.error('Browser error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  /**
   * Handle database-related errors
   */
  async _handleDatabaseError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    logger.error('Database error - not retryable', {
      requestId,
      message: error.message,
      context
    });

    // Database errors are typically not recoverable through healing
    return false;
  }

  /**
   * Handle connection-level errors (profile-specific)
   */
  async _handleConnectionError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    logger.warn('Connection-level error - will skip this connection', {
      requestId,
      profileId: context.profileId,
      message: error.message
    });

    // Connection errors should not fail the entire process
    return false; // Don't trigger healing, just skip this connection
  }

}

export default ProfileInitService;