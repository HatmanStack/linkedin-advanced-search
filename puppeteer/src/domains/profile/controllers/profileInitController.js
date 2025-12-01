import { logger } from '../../../shared/utils/logger.js';
import { initializeLinkedInServices, cleanupLinkedInServices } from '../../../shared/utils/serviceFactory.js';
import { validateLinkedInCredentials } from '../../../shared/utils/credentialValidator.js';
import ProfileInitService from '../services/profileInitService.js';
import { HealingManager } from '../../automation/utils/healingManager.js';
import { ProfileInitStateManager } from '../utils/profileInitStateManager.js';
import { profileInitMonitor } from '../utils/profileInitMonitor.js';

export class ProfileInitController {
  async performProfileInit(req, res, opts = {}) {
    const requestId = this._generateRequestId();
    const startTime = Date.now();

    this._logRequestDetails(req, requestId);

    try {
      const jwtToken = this._extractJwtToken(req);
      if (!jwtToken) {
        logger.warn('Profile initialization request rejected: Missing JWT token', { requestId });
        return res.status(401).json({
          error: 'Missing or invalid Authorization header',
          requestId
        });
      }

      const validationResult = this._validateRequest(req.body, jwtToken);
      if (!validationResult.isValid) {
        logger.warn('Profile initialization request validation failed', {
          requestId,
          error: validationResult.error,
          statusCode: validationResult.statusCode
        });
        return res.status(validationResult.statusCode).json({
          error: validationResult.error,
          message: validationResult.message,
          requestId
        });
      }

      const searchName = null;
      const searchPassword = null;
      const credentialsCiphertext = req.body.linkedinCredentialsCiphertext;

      logger.info('Starting LinkedIn profile initialization request', {
        requestId,
        username: searchName ? '[REDACTED]' : 'not provided',
        hasPassword: !!searchPassword,
        recursionCount: opts.recursionCount || 0,
        healPhase: opts.healPhase || null
      });

      const state = ProfileInitStateManager.buildInitialState({
        searchName,
        searchPassword,
        credentialsCiphertext,
        jwtToken,
        requestId,
        ...opts
      });

      profileInitMonitor.startRequest(requestId, {
        username: searchName ? '[REDACTED]' : 'not provided',
        recursionCount: opts.recursionCount || 0,
        healPhase: opts.healPhase,
        isResuming: ProfileInitStateManager.isResumingState(state)
      });

      const result = await this.performProfileInitFromState(state);

      if (result === undefined) {
        const healingDuration = Date.now() - startTime;
        logger.info('Profile initialization triggered healing process', {
          requestId,
          healingDuration,
          recursionCount: state.recursionCount
        });

        profileInitMonitor.recordHealing(requestId, {
          recursionCount: state.recursionCount,
          healPhase: state.healPhase,
          healReason: state.healReason
        });

        return res.status(202).json({
          status: 'healing',
          message: 'Worker process started for healing/recovery.',
          requestId,
          healingInfo: {
            phase: state.healPhase,
            reason: state.healReason,
            recursionCount: state.recursionCount
          }
        });
      }

      const totalDuration = Date.now() - startTime;
      logger.info('Profile initialization completed successfully', {
        requestId,
        totalDuration,
        processedConnections: result.data?.processed || 0,
        skippedConnections: result.data?.skipped || 0,
        errorCount: result.data?.errors || 0
      });

      profileInitMonitor.recordSuccess(requestId, result);

      res.json(this._buildSuccessResponse(result, requestId));

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      const errorDetails = this._categorizeError(error);

      logger.error('Profile initialization failed with unhandled error', {
        requestId,
        totalDuration,
        errorType: errorDetails.type,
        errorCategory: errorDetails.category,
        message: error.message,
        stack: error.stack,
        isRecoverable: errorDetails.isRecoverable
      });

      if (error.context) {
        logger.error('Error context details', {
          requestId,
          context: error.context
        });
      }

      profileInitMonitor.recordFailure(requestId, error, errorDetails);

      res.status(500).json(this._buildErrorResponse(error, requestId, errorDetails));
    }
  }

  async performProfileInitFromState(state) {
    const services = await this._initializeServices();

    try {
      

      const profileData = await this._processUserProfile(services, state);

      return this._buildProfileInitResult(profileData);

    } catch (error) {
      logger.error('Profile initialization failed:', error);
      throw error;
    } finally {
      await this._cleanupServices(services);
    }
  }

  async _initializeServices() {
    return await initializeLinkedInServices();
  }


  async _processUserProfile(services, state) {
    logger.info('Processing user profile initialization...');

    try {
      const profileInitService = new ProfileInitService(
        services.puppeteerService,
        services.linkedInService,
        services.linkedInContactService,
        services.dynamoDBService
      );

      services.dynamoDBService.setAuthToken(state.jwtToken);

      const result = await profileInitService.initializeUserProfile(state);

      logger.info('Profile initialization processing completed successfully');
      return result;

    } catch (error) {
      logger.error('Profile initialization processing failed:', error);

      if (this._shouldTriggerHealing(error)) {
        await this._handleProfileInitHealing(state);
        return undefined;
      }

      throw error;
    }
  }

  async _handleProfileInitHealing(state, errorMessage = 'Profile initialization failed') {
    const requestId = state.requestId || 'unknown';
    const recursionCount = (state.recursionCount || 0) + 1;

    if (errorMessage.includes('LIST_CREATION_HEALING_NEEDED')) {
      try {
        const healingDataMatch = errorMessage.match(/LIST_CREATION_HEALING_NEEDED:(.+)$/);
        if (healingDataMatch) {
          const healingState = JSON.parse(healingDataMatch[1]);

          logger.warn('List creation failed. Initiating list creation healing restart.', {
            requestId,
            connectionType: healingState.listCreationState?.connectionType,
            expansionAttempt: healingState.listCreationState?.expansionAttempt,
            currentFileIndex: healingState.listCreationState?.currentFileIndex,
            recursionCount: healingState.recursionCount
          });

          await this._initiateHealing(healingState);
          return;
        }
      } catch (parseError) {
        logger.warn('Failed to parse list creation healing data, falling back to standard healing', {
          requestId,
          parseError: parseError.message
        });
      }
    }

    logger.warn('Profile initialization failed. Initiating self-healing restart.', {
      requestId,
      recursionCount,
      errorMessage,
      currentState: {
        processingList: state.currentProcessingList,
        batch: state.currentBatch,
        index: state.currentIndex,
        masterIndexFile: state.masterIndexFile
      }
    });

    logger.info('Restarting with fresh Puppeteer instance...', {
      requestId,
      recursionCount
    });

    const healingState = ProfileInitStateManager.createHealingState(
      state,
      'profile-init',
      errorMessage,
      {
        recursionCount,
        timestamp: new Date().toISOString()
      }
    );

    logger.info('Created healing state for profile initialization', {
      requestId,
      healingState: {
        recursionCount: healingState.recursionCount,
        healPhase: healingState.healPhase,
        healReason: healingState.healReason,
        currentProcessingList: healingState.currentProcessingList,
        currentBatch: healingState.currentBatch,
        currentIndex: healingState.currentIndex,
        masterIndexFile: healingState.masterIndexFile
      }
    });

    await this._initiateHealing(healingState);
  }

  
  _shouldTriggerHealing(error) {
    const recoverableErrors = [
      /login.*failed/i,
      /authentication.*failed/i,
      /network.*error/i,
      /timeout/i,
      /connection.*reset/i,
      /captcha/i,
      /checkpoint/i,
      /rate.*limit/i,
      /linkedin.*error/i,
      /puppeteer.*error/i,
      /navigation.*failed/i,
      /LIST_CREATION_HEALING_NEEDED/i
    ];

    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('LIST_CREATION_HEALING_NEEDED')) {
      logger.info(`List creation healing needed: ${errorMessage}`);
      return true;
    }

    const isRecoverable = recoverableErrors.some(pattern => pattern.test(errorMessage));

    if (isRecoverable) {
      logger.info(`Error is recoverable, will trigger healing: ${errorMessage}`);
      return true;
    }

    logger.info(`Error is not recoverable, will not trigger healing: ${errorMessage}`);
    return false;
  }

  async _initiateHealing(healingParams) {
    const healingManager = new HealingManager();
    await healingManager.healAndRestart(healingParams);
  }

  async _cleanupServices(services) {
    logger.info('Cleaning up services for profile initialization:', !!services?.puppeteerService);
    await cleanupLinkedInServices(services);
    logger.info('Closed browser for profile initialization!');
  }

  _validateRequest(body, jwtToken) {
    const { searchName, searchPassword, linkedinCredentialsCiphertext, linkedinCredentials } = body;

    logger.info('Profile init request body received:', {
      searchName,
      hasPassword: !!searchPassword,
      hasJwtToken: !!jwtToken
    });

    return validateLinkedInCredentials({
      searchName,
      searchPassword,
      linkedinCredentialsCiphertext,
      linkedinCredentials,
      jwtToken,
      actionType: 'profile initialization'
    });
  }

 
  _logRequestDetails(req, requestId) {
    logger.info('Profile init request details:', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'no body',
      timestamp: new Date().toISOString()
    });
  }

  
  _generateRequestId() {
    return `profile-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  
  _categorizeError(error) {
    const errorMessage = error.message || error.toString();
    const errorStack = error.stack || '';

    if (/login.*failed|authentication.*failed|invalid.*credentials|unauthorized/i.test(errorMessage)) {
      return {
        type: 'AuthenticationError',
        category: 'authentication',
        isRecoverable: true,
        severity: 'high',
        userMessage: 'LinkedIn authentication failed. Please check your credentials.'
      };
    }

    if (/network.*error|connection.*reset|timeout|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(errorMessage)) {
      return {
        type: 'NetworkError',
        category: 'network',
        isRecoverable: true,
        severity: 'medium',
        userMessage: 'Network connection issue. The system will retry automatically.'
      };
    }

    if (/captcha|checkpoint|rate.*limit|linkedin.*error|too.*many.*requests/i.test(errorMessage)) {
      return {
        type: 'LinkedInError',
        category: 'linkedin',
        isRecoverable: true,
        severity: 'high',
        userMessage: 'LinkedIn has imposed restrictions. The system will retry with delays.'
      };
    }

    if (/dynamodb|database|aws.*error|ValidationException|ResourceNotFoundException/i.test(errorMessage)) {
      return {
        type: 'DatabaseError',
        category: 'database',
        isRecoverable: false,
        severity: 'high',
        userMessage: 'Database operation failed. Please try again later.'
      };
    }

    if (/puppeteer|browser|page.*crashed|navigation.*failed|target.*closed/i.test(errorMessage)) {
      return {
        type: 'BrowserError',
        category: 'browser',
        isRecoverable: true,
        severity: 'medium',
        userMessage: 'Browser automation issue. The system will restart and retry.'
      };
    }

    if (/validation|invalid.*input|missing.*required|bad.*request/i.test(errorMessage)) {
      return {
        type: 'ValidationError',
        category: 'validation',
        isRecoverable: false,
        severity: 'low',
        userMessage: 'Invalid input provided. Please check your request data.'
      };
    }

    if (/ENOENT|EACCES|EMFILE|file.*not.*found|permission.*denied/i.test(errorMessage)) {
      return {
        type: 'FileSystemError',
        category: 'filesystem',
        isRecoverable: false,
        severity: 'medium',
        userMessage: 'File system error occurred. Please contact support.'
      };
    }

    return {
      type: 'UnknownError',
      category: 'unknown',
      isRecoverable: false,
      severity: 'high',
      userMessage: 'An unexpected error occurred. Please try again later.'
    };
  }

  _extractJwtToken(req) {
    const authHeader = req.headers.authorization;
    return authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;
  }

  _buildSuccessResponse(result, requestId) {
    return {
      status: 'success',
      data: result,
      requestId,
      timestamp: new Date().toISOString()
    };
  }

  _buildErrorResponse(error, requestId, errorDetails) {
    const response = {
      error: 'Internal server error during profile initialization',
      message: errorDetails?.userMessage || error.message,
      requestId,
      errorType: errorDetails?.type || 'UnknownError',
      timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development') {
      response.technicalDetails = {
        originalMessage: error.message,
        stack: error.stack,
        category: errorDetails?.category,
        severity: errorDetails?.severity,
        isRecoverable: errorDetails?.isRecoverable
      };
    }

    return response;
  }

  _buildProfileInitResult(profileData) {
    return {
      profileData,
      stats: {
        initializationTime: new Date().toISOString()
      }
    };
  }
}

export default ProfileInitController;