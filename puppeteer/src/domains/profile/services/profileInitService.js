import { logger } from '../../shared/utils/logger.js';
import { ProfileInitStateManager } from '../utils/profileInitStateManager.js';
import { profileInitMonitor } from '../utils/profileInitMonitor.js';
import RandomHelpers from '../../shared/utils/randomHelpers.js';
import LinkedInErrorHandler from '../utils/linkedinErrorHandler.js';
import fs from 'fs/promises';
import path from 'path';


export class ProfileInitService {
  constructor(puppeteerService, linkedInService, linkedInContactService, dynamoDBService) {
    this.puppeteer = puppeteerService;
    this.linkedInService = linkedInService;
    this.linkedInContactService = linkedInContactService;
    this.dynamoDBService = dynamoDBService;
    this.batchSize = 100;
  }

  
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

      this.dynamoDBService.setAuthToken(state.jwtToken);

      await this.linkedInService.login(
        state.searchName,
        state.searchPassword,
        state.recursionCount > 0,
        state.credentialsCiphertext,
        'profile-init'
      );

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
      const errorDetails = LinkedInErrorHandler.categorizeError(error);

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


  async processConnectionLists(state) {
    try {
      logger.info('Starting connection list processing');

      ProfileInitStateManager.validateState(state);

      let masterIndexFile = state.masterIndexFile;
      if (!masterIndexFile) {
        masterIndexFile = await this._createMasterIndexFile(state);

        state.masterIndexFile = masterIndexFile;
      }

      const masterIndex = await this._loadMasterIndex(masterIndexFile);

      if (masterIndex.metadata) {
        state.totalConnections = {
          ally: masterIndex.metadata.totalAllies || 0,
          incoming: masterIndex.metadata.totalIncoming || 0,
          outgoing: masterIndex.metadata.totalOutgoing || 0
        };
      }

      const connectionTypes = ['ally', 'outgoing', 'incoming'];
      const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        connectionTypes: {},
        progressSummary: ProfileInitStateManager.getProgressSummary(state)
      };

      const processedInThisRun = new Set();

      for (const connectionType of connectionTypes) {
        if (processedInThisRun.has(connectionType)) {
          logger.info(`Skipping ${connectionType} connections - already processed in this run`);
          continue;
        }


        if (state.currentProcessingList && state.currentProcessingList !== connectionType) {
          logger.info(`Skipping ${connectionType} connections - resuming from ${state.currentProcessingList}`);
          continue;
        }

        logger.info(`Processing ${connectionType} connections`);

        processedInThisRun.add(connectionType);

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

          state = ProfileInitStateManager.updateBatchProgress(state, {
            currentProcessingList: connectionType,
            completedBatches: masterIndex.processingState.completedBatches
          });

          await this._updateMasterIndex(masterIndexFile, masterIndex);

        } catch (error) {
          logger.error(`Failed to process ${connectionType} connections:`, error);

          state.lastError = {
            connectionType,
            message: error.message,
            timestamp: new Date().toISOString()
          };

          throw error;
        }
      }

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

  
  async _createMasterIndexFile(state) {
    try {
      const timestamp = Date.now();
      const masterIndexFile = path.join('data', `profile-init-index-${timestamp}.json`);

      const connectionCounts = { ally: 0, incoming: 0, outgoing: 0 };

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

  
  async _loadMasterIndex(masterIndexFile) {
    try {
      const content = await fs.readFile(masterIndexFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load master index from ${masterIndexFile}:`, error);
      throw error;
    }
  }

  
  async _updateMasterIndex(masterIndexFile, masterIndex) {
    try {
      await fs.writeFile(masterIndexFile, JSON.stringify(masterIndex, null, 2));
      logger.debug(`Updated master index file: ${masterIndexFile}`);
    } catch (error) {
      logger.error('Failed to update master index:', error);
      throw error;
    }
  }

  
  async _processConnectionType(connectionType, masterIndex, state) {
    try {
      logger.info(`Processing ${connectionType} connections`);

      const result = {
        processed: 0,
        skipped: 0,
        errors: 0,
        batches: []
      };

      let connections;

      connections = await this.linkedInService.getConnections({
        caller: 'profileinit',
        connectionType: connectionType,
        loadAll: true,
        maxScrolls: 15,
        timeoutMs: 20000
      });

      if (!connections || connections.length === 0) {
        logger.info(`No ${connectionType} connections found`);
        return result;
      }

      const batchFiles = await this._createBatchFiles(connectionType, connections, masterIndex);

      for (let batchIndex = 0; batchIndex < batchFiles.length; batchIndex++) {
        if (state.completedBatches && state.completedBatches.includes(batchIndex)) {
          logger.info(`Skipping completed batch ${batchIndex} for ${connectionType}`);
          continue;
        }

        if (state.currentBatch && batchIndex < state.currentBatch) {
          continue;
        }

        logger.info(`Processing batch ${batchIndex} for ${connectionType}`);
        const batchResult = await this._processBatch(batchFiles[batchIndex], state);

        result.processed += batchResult.processed;
        result.skipped += batchResult.skipped;
        result.errors += batchResult.errors;
        result.batches.push(batchResult);

        masterIndex.processingState.currentList = connectionType;
        masterIndex.processingState.currentBatch = batchIndex;
        masterIndex.processingState.completedBatches.push(batchIndex);

        await RandomHelpers.randomDelay(2000, 5000);
      }

      logger.info(`Completed processing ${connectionType} connections:`, result);
      return result;

    } catch (error) {
      logger.error(`Failed to process ${connectionType} connections:`, error);
      throw error;
    }
  }

  
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

      for (let i = 19; i < batchData.connections.length; i++) {
        if (state.currentIndex && i < state.currentIndex) {
          logger.debug(`Skipping connection at index ${i} - resuming from index ${state.currentIndex}`, {
            requestId,
            batchNumber: batchData.batchNumber,
            skipIndex: i,
            resumeIndex: state.currentIndex
          });
          continue;
        }

        let connectionProfileId = batchData.connections[i];
        let connectionStatus = batchData.connectionType;

        try {
          state.currentIndex = i;

          logger.debug(`Processing connection ${i + 1}/${batchData.connections.length}`, {
            requestId,
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            profileId: connectionProfileId,
            status: connectionStatus
          });
          const edgeExists = await this.dynamoDBService.checkEdgeExists(connectionProfileId);

          if (edgeExists) {

            logger.debug(`Skipping ${connectionProfileId}: Edge already exists`);

            result.skipped++;
            result.connections.push({
              profileId: connectionProfileId,
              action: 'skipped',
              reason: 'Edge already exists',
              index: i,
            });

            profileInitMonitor.recordConnection(requestId, connectionProfileId, 'skipped', {
              batchNumber: batchData.batchNumber,
              connectionIndex: i,
              reason: 'Edge already exists'
            });

            continue;
          }


          await this._processConnection(connectionProfileId, state, connectionStatus);


          result.processed++;
          result.connections.push({
            profileId: connectionProfileId,
            action: 'processed',
            index: i,
          });

          profileInitMonitor.recordConnection(requestId, connectionProfileId, 'processed', {
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            batchProgress: `${i + 1}/${batchData.connections.length}`
          });

          logger.debug(`Successfully processed connection ${connectionProfileId} at index ${i}`, {
            requestId,
            profileId: connectionProfileId,
            connectionIndex: i,
            batchProgress: `${i + 1}/${batchData.connections.length}`
          });

        } catch (error) {
          const errorDetails = LinkedInErrorHandler.categorizeError(error);

          logger.error(`Failed to process connection ${connectionProfileId} at index ${i}`, {
            requestId,
            profileId: connectionProfileId,
            connectionIndex: i,
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
          });

          profileInitMonitor.recordConnection(requestId, connectionProfileId, 'error', {
            batchNumber: batchData.batchNumber,
            connectionIndex: i,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category,
            isConnectionLevel: errorDetails.skipConnection || false
          });

          if (this._isConnectionLevelError(error)) {
            logger.warn(`Connection-level error for ${connectionProfileId}, continuing with next connection`, {
              requestId,
              profileId: connectionProfileId,
              errorType: errorDetails.type,
              continuingBatch: true
            });
            continue;
          }

          logger.error(`Serious error encountered, failing batch`, {
            requestId,
            batchNumber: batchData.batchNumber,
            profileId: connectionProfileId,
            errorType: errorDetails.type,
            errorCategory: errorDetails.category
          });

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

  
  async _processConnection(connectionProfileId, state, connectionType) {
    const requestId = state.requestId || 'unknown';
    const startTime = Date.now();

    try {
      logger.debug(`Processing connection: ${connectionProfileId}`, {
        requestId,
        profileId: connectionProfileId,
        currentBatch: state.currentBatch,
        currentIndex: state.currentIndex
      });

      let screenshotResult = null;
      let databaseResult = null;

      try {
        logger.debug(`Capturing screenshot for connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId
        });

        screenshotResult = await this.captureProfileScreenshot(connectionProfileId, connectionType);

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

        logger.debug(`Creating database entry for connection: ${connectionProfileId}`, {
          requestId,
          profileId: connectionProfileId
        });

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
        const errorDetails = LinkedInErrorHandler.categorizeError(processingError);

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

      logger.error(`Connection processing failed for ${connectionProfileId}`, {
        requestId,
        profileId: connectionProfileId,
        totalDuration,
        message: error.message,
        stack: error.stack,
        currentState: {
          batch: state.currentBatch,
          index: state.currentIndex,
          processingList: state.currentProcessingList
        }
      });

      throw error;

    }
  }


  async captureProfileScreenshot(profileId, status = 'ally') {
    try {
      logger.info(`Capturing profile screenshot for: ${profileId}`);

      const result = await this.linkedInContactService.takeScreenShotAndUploadToS3(profileId, status);

      logger.info(`Profile screenshot captured successfully for: ${profileId}`);
      return result;

    } catch (error) {
      logger.error(`Failed to capture profile screenshot for ${profileId}:`, error);
      throw error;
    }
  }


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

    const healingState = ProfileInitStateManager.createListCreationHealingState(
      state,
      connectionType,
      expansionAttempt,
      currentFileIndex,
      masterIndex,
      `List creation failed: ${error.message}`
    );

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

    throw new Error(`LIST_CREATION_HEALING_NEEDED:${JSON.stringify(healingState)}`);
  }

  
  async _saveLinksToFile(links, connectionType, fileIndex, masterIndex) {
    try {
      const timestamp = Date.now();
      const fileName = `${connectionType}-connections-${fileIndex}-${timestamp}.json`;
      const filePath = path.join('data', fileName);

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

      await fs.mkdir('data', { recursive: true });

      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));

      const connectionKey = `${connectionType}Connections`;
      if (!masterIndex.files[connectionKey]) {
        masterIndex.files[connectionKey] = [];
      }

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

  
  async _collectVisibleLinks(page, allLinks) {
    try {
      const newLinks = await page.evaluate(() => {
        const links = new Set();

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
              const cleanHref = href.split('?')[0].replace(/\/$/, '');
              if (cleanHref.match(/\/in\/[^\/]+$/)) {
                links.add(cleanHref);
              }
            }
          }
        }

        return Array.from(links);
      });

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

  
  async _handleAuthenticationError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 3)) {
      logger.warn('Authentication error - will trigger healing', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries
      });
      return true;
    }

    logger.error('Authentication failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  
  async _handleNetworkError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 5)) {
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

      logger.warn('Network error - will retry with backoff', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries,
        backoffDelay
      });

      await RandomHelpers.randomDelay(backoffDelay, backoffDelay + 1000);
      return true;
    }

    logger.error('Network error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  
  async _handleLinkedInError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 2)) {
      const backoffDelay = Math.min(5000 * Math.pow(2, retryCount), 60000);

      logger.warn('LinkedIn error - will retry with extended backoff', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries,
        backoffDelay
      });

      await RandomHelpers.randomDelay(backoffDelay, backoffDelay + 5000);
      return true;
    }

    logger.error('LinkedIn error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  
  async _handleBrowserError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    if (retryCount < (errorDetails.maxRetries || 3)) {
      logger.warn('Browser error - will trigger healing with fresh browser instance', {
        requestId,
        retryCount,
        maxRetries: errorDetails.maxRetries
      });
      return true;
    }

    logger.error('Browser error failed after maximum retries', {
      requestId,
      retryCount,
      maxRetries: errorDetails.maxRetries
    });
    return false;
  }

  
  async _handleDatabaseError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    logger.error('Database error - not retryable', {
      requestId,
      message: error.message,
      context
    });

    return false;
  }

  
  async _handleConnectionError(error, context, retryCount, errorDetails) {
    const requestId = context.requestId || 'unknown';

    logger.warn('Connection-level error - will skip this connection', {
      requestId,
      profileId: context.profileId,
      message: error.message
    });

    return false;
  }

}

export default ProfileInitService;