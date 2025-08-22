import { logger } from '@/utils/logger.js';
import { ProfileInitStateManager } from '@/utils/profileInitStateManager.js';
import { profileInitMonitor } from '@/utils/profileInitMonitor.js';
import RandomHelpers from '@/utils/randomHelpers.js';
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

      // Decrypt just-in-time: prefer plaintext if present, otherwise decrypt ciphertext
      await this.linkedInService.login(
        state.searchName,
        state.searchPassword,
        state.recursionCount > 0,
        state.credentialsCiphertext,
        'profile-init'
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
          ally: masterIndex.metadata.totalAllies || 0,
          incoming: masterIndex.metadata.totalIncoming || 0,
          outgoing: masterIndex.metadata.totalOutgoing || 0
        };
      }

      // Process each connection type
      const connectionTypes = ['ally', 'outgoing', 'incoming'];
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
          totalAllies: connectionCounts.ally || connectionCounts.allies,
          totalIncoming: connectionCounts.incoming,
          totalOutgoing: connectionCounts.outgoing,
          batchSize: this.batchSize
        },
        files: {
          allyConnections: [],
          incomingConnections: [],
          outgoingConnections: []
        },
        processingState: {
          currentList: 'ally',
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
   * Process connections for a specific type (ally, incoming, outgoing)
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
        // Handle regular connections (ally)
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
          const connectionType = batchData.connectionType || connectionStatus || 'ally';
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
   * @param {string} connectionType - Type of connection (ally, incoming, outgoing)
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
        // Capture screenshots for required pages per status
        logger.debug(`Capturing screenshot for connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId,
          tempDir
        });

        screenshotResult = await this.captureProfileScreenshot(connectionProfileId, tempDir, connectionType);

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

        // Use central edge manager to create edge for this connection
        databaseResult = await this.dynamoDBService.upsertEdgeStatus(connectionProfileId, connectionType);

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
  async captureProfileScreenshot(profileId, tempDir, status = 'ally') {
    try {
      logger.info(`Capturing profile screenshot for: ${profileId}`);

      // Use existing LinkedInContactService method
      const result = await this.linkedInContactService.takeScreenShotAndUploadToS3(profileId, tempDir, status);

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
        ally: 0,
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

        counts.ally = allConnectionsCount || 0;
        logger.info(`Found ${counts.ally} total ally connections`);

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
   * @param {string} connectionType - Type of connections (ally)
   * @param {Object} masterIndex - Master index for file management
   * @returns {Promise<Array>} Array of connection profile IDs
   */
  async _getConnectionList(connectionType, masterIndex, state) {
    try {
      logger.info(`Getting ${connectionType} connection list from LinkedIn`);

      // Navigate directly to the connections page
      const connectionsUrl = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';
      await this.puppeteer.goto(connectionsUrl);
      await RandomHelpers.randomDelay(1500, 2500);

      // Use puppeteerService.extractLinks to gather all profile IDs with autoscroll
      const profileIds = await this.puppeteer.extractLinks(null, {
        autoScroll: true,
        maxScrolls: 10,
        timeoutMs: 15000
      });

      logger.info(`Extracted ${profileIds.length} ${connectionType} connection profile IDs`);

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

  // Removed custom link collection in favor of puppeteerService.extractLinks

  /**
   * Load existing links from saved files for healing recovery
   * @param {string} connectionType - Type of connections (ally, incoming, outgoing)
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
   * @param {string} connectionType - Type of connections (ally, incoming, outgoing)
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
    try {
      logger.info('Getting sent and received invites from LinkedIn');

      // Received invitations (default invitation manager)
      const receivedUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/';
      await this.puppeteer.goto(receivedUrl);
      await RandomHelpers.randomDelay(1500, 2500);
      const receivedIds = await this.puppeteer.extractLinks(null, {
        autoScroll: true,
        maxScrolls: 10,
        timeoutMs: 15000
      });

      // Sent invitations
      const sentUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/sent/';
      await this.puppeteer.goto(sentUrl);
      await RandomHelpers.randomDelay(1500, 2500);
      const sentIds = await this.puppeteer.extractLinks(null, {
        autoScroll: true,
        maxScrolls: 10,
        timeoutMs: 15000
      });

      const receivedInvitations = receivedIds.map(id => ({ profileId: id, status: 'incoming' }));
      const sentInvitations = sentIds.map(id => ({ profileId: id, status: 'outgoing' }));

      const result = {
        received: receivedInvitations,
        sent: sentInvitations,
        totalReceived: receivedInvitations.length,
        totalSent: sentInvitations.length,
        totalInvitations: receivedInvitations.length + sentInvitations.length
      };

      logger.info('Collected invitations summary:', {
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
  // Removed custom invitation link collection and scrolling helpers in favor of puppeteerService.extractLinks

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