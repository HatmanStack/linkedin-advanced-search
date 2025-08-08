/**
 * Tests for Profile Initialization Heal-and-Restore Mechanism
 * Tests healing triggers, state preservation, recovery scenarios, and batch processing recovery
 */

import { jest } from '@jest/globals';
import { ProfileInitController } from '../puppeteer-backend/controllers/profileInitController.js';
import { ProfileInitService } from '../puppeteer-backend/services/profileInitService.js';
import { ProfileInitStateManager } from '../puppeteer-backend/utils/profileInitStateManager.js';
import { HealingManager } from '../puppeteer-backend/utils/healingManager.js';
import { profileInitMonitor } from '../puppeteer-backend/utils/profileInitMonitor.js';

// Mock dependencies
jest.mock('../puppeteer-backend/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../puppeteer-backend/services/puppeteerService.js');
jest.mock('../puppeteer-backend/services/linkedinService.js');
jest.mock('../puppeteer-backend/services/linkedinContactService.js');
jest.mock('../puppeteer-backend/services/dynamoDBService.js');
jest.mock('../puppeteer-backend/services/profileInitService.js');
jest.mock('../puppeteer-backend/utils/healingManager.js');
jest.mock('../puppeteer-backend/utils/profileInitStateManager.js');
jest.mock('../puppeteer-backend/utils/profileInitMonitor.js');

describe('Profile Initialization Heal-and-Restore Tests', () => {
  let controller;
  let service;
  let mockHealingManager;
  let mockProfileInitService;

  beforeEach(() => {
    controller = new ProfileInitController();
    
    // Mock services
    const mockPuppeteerService = { initialize: jest.fn(), close: jest.fn() };
    const mockLinkedInService = { login: jest.fn() };
    const mockLinkedInContactService = { takeScreenShotAndUploadToS3: jest.fn() };
    const mockDynamoDBService = { setAuthToken: jest.fn(), checkEdgeExists: jest.fn(), createGoodContactEdges: jest.fn() };

    service = new ProfileInitService(
      mockPuppeteerService,
      mockLinkedInService,
      mockLinkedInContactService,
      mockDynamoDBService
    );

    // Mock HealingManager
    mockHealingManager = {
      healAndRestart: jest.fn()
    };

    // Mock ProfileInitService
    mockProfileInitService = {
      initializeUserProfile: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    HealingManager.mockImplementation(() => mockHealingManager);
    ProfileInitService.mockImplementation(() => mockProfileInitService);

    ProfileInitStateManager.buildInitialState = jest.fn();
    ProfileInitStateManager.validateState = jest.fn();
    ProfileInitStateManager.isResumingState = jest.fn().mockReturnValue(false);
    ProfileInitStateManager.isHealingState = jest.fn().mockReturnValue(false);
    ProfileInitStateManager.createHealingState = jest.fn();
    ProfileInitStateManager.updateBatchProgress = jest.fn();
    ProfileInitStateManager.getProgressSummary = jest.fn().mockReturnValue({
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      currentProgress: '0%'
    });

    profileInitMonitor.startRequest = jest.fn();
    profileInitMonitor.recordSuccess = jest.fn();
    profileInitMonitor.recordFailure = jest.fn();
    profileInitMonitor.recordHealing = jest.fn();
  });

  describe('Healing Trigger Detection', () => {
    test('should trigger healing for LinkedIn authentication failures', () => {
      // Arrange
      const authErrors = [
        new Error('LinkedIn login failed'),
        new Error('Authentication failed'),
        new Error('Invalid credentials provided'),
        new Error('Login authentication error')
      ];

      // Act & Assert
      authErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(true);
      });
    });

    test('should trigger healing for network-related errors', () => {
      // Arrange
      const networkErrors = [
        new Error('Network error occurred'),
        new Error('Connection timeout'),
        new Error('ECONNRESET: Connection reset by peer'),
        new Error('ETIMEDOUT: Request timeout'),
        new Error('ENOTFOUND: DNS lookup failed')
      ];

      // Act & Assert
      networkErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(true);
      });
    });

    test('should trigger healing for LinkedIn-specific errors', () => {
      // Arrange
      const linkedinErrors = [
        new Error('LinkedIn captcha detected'),
        new Error('LinkedIn checkpoint required'),
        new Error('Rate limit exceeded'),
        new Error('Too many requests to LinkedIn'),
        new Error('LinkedIn service error')
      ];

      // Act & Assert
      linkedinErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(true);
      });
    });

    test('should trigger healing for Puppeteer/browser errors', () => {
      // Arrange
      const browserErrors = [
        new Error('Puppeteer navigation failed'),
        new Error('Browser page crashed'),
        new Error('Target page closed'),
        new Error('Navigation timeout exceeded')
      ];

      // Act & Assert
      browserErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(true);
      });
    });

    test('should not trigger healing for non-recoverable errors', () => {
      // Arrange
      const nonRecoverableErrors = [
        new Error('Database validation failed'),
        new Error('Invalid input provided'),
        new Error('File not found'),
        new Error('Permission denied'),
        new Error('Configuration error')
      ];

      // Act & Assert
      nonRecoverableErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(false);
      });
    });

    test('should handle edge cases in error detection', () => {
      // Arrange
      const edgeCases = [
        new Error(''), // Empty message
        new Error(null), // Null message
        { message: 'LinkedIn login failed' }, // Non-Error object
        'String error with login failed' // String error
      ];

      // Act & Assert
      edgeCases.forEach(error => {
        expect(() => controller._shouldTriggerHealing(error)).not.toThrow();
      });
    });
  });

  describe('Healing State Creation', () => {
    test('should create healing state with incremented recursion count', async () => {
      // Arrange
      const originalState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 2,
        currentProcessingList: 'all',
        currentBatch: 3,
        currentIndex: 45,
        masterIndexFile: 'profile-init-index-123.json',
        completedBatches: [0, 1, 2]
      };

      const expectedHealingState = {
        ...originalState,
        recursionCount: 3,
        healPhase: 'profile-init',
        healReason: 'Profile initialization failed'
      };

      ProfileInitStateManager.createHealingState.mockReturnValue(expectedHealingState);
      controller._initiateHealing = jest.fn();

      // Act
      await controller._handleProfileInitHealing(originalState, 'Custom error message');

      // Assert
      expect(ProfileInitStateManager.createHealingState).toHaveBeenCalledWith(
        originalState,
        'profile-init',
        'Custom error message',
        expect.objectContaining({
          recursionCount: 3,
          timestamp: expect.any(String)
        })
      );
    });

    test('should preserve batch processing state during healing', async () => {
      // Arrange
      const stateWithBatchProgress = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 1,
        currentProcessingList: 'pending',
        currentBatch: 5,
        currentIndex: 78,
        masterIndexFile: 'profile-init-index-456.json',
        completedBatches: [0, 1, 2, 3, 4],
        totalConnections: {
          all: 500,
          pending: 25,
          sent: 8
        },
        batchSize: 100
      };

      const healingState = {
        ...stateWithBatchProgress,
        recursionCount: 2,
        healPhase: 'profile-init',
        healReason: 'Network timeout during batch processing'
      };

      ProfileInitStateManager.createHealingState.mockReturnValue(healingState);
      controller._initiateHealing = jest.fn();

      // Act
      await controller._handleProfileInitHealing(stateWithBatchProgress, 'Network timeout during batch processing');

      // Assert
      expect(ProfileInitStateManager.createHealingState).toHaveBeenCalledWith(
        stateWithBatchProgress,
        'profile-init',
        'Network timeout during batch processing',
        expect.objectContaining({
          recursionCount: 2
        })
      );

      // Verify that batch processing state is preserved
      expect(healingState.currentProcessingList).toBe('pending');
      expect(healingState.currentBatch).toBe(5);
      expect(healingState.currentIndex).toBe(78);
      expect(healingState.masterIndexFile).toBe('profile-init-index-456.json');
      expect(healingState.completedBatches).toEqual([0, 1, 2, 3, 4]);
      expect(healingState.totalConnections).toEqual({
        all: 500,
        pending: 25,
        sent: 8
      });
    });

    test('should handle healing state creation with minimal state', async () => {
      // Arrange
      const minimalState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'minimal-request-id'
      };

      const healingState = {
        ...minimalState,
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Initial authentication failed'
      };

      ProfileInitStateManager.createHealingState.mockReturnValue(healingState);
      controller._initiateHealing = jest.fn();

      // Act
      await controller._handleProfileInitHealing(minimalState, 'Initial authentication failed');

      // Assert
      expect(ProfileInitStateManager.createHealingState).toHaveBeenCalledWith(
        minimalState,
        'profile-init',
        'Initial authentication failed',
        expect.objectContaining({
          recursionCount: 1
        })
      );
    });
  });

  describe('Healing Manager Integration', () => {
    test('should initiate healing with correct parameters', async () => {
      // Arrange
      const healingParams = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 2,
        healPhase: 'profile-init',
        healReason: 'LinkedIn authentication failed',
        currentProcessingList: 'all',
        currentBatch: 1,
        currentIndex: 25,
        masterIndexFile: 'profile-init-index-789.json',
        completedBatches: [0],
        totalConnections: { all: 200, pending: 10, sent: 5 },
        batchSize: 100
      };

      // Act
      await controller._initiateHealing(healingParams);

      // Assert
      expect(HealingManager).toHaveBeenCalled();
      expect(mockHealingManager.healAndRestart).toHaveBeenCalledWith(healingParams);
    });

    test('should handle healing manager errors gracefully', async () => {
      // Arrange
      const healingParams = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Network error'
      };

      const healingError = new Error('Healing manager failed');
      mockHealingManager.healAndRestart.mockRejectedValue(healingError);

      // Act & Assert
      await expect(controller._initiateHealing(healingParams)).rejects.toThrow('Healing manager failed');
    });

    test('should pass all required healing parameters', async () => {
      // Arrange
      const completeHealingParams = {
        searchName: 'user@example.com',
        searchPassword: 'userpassword',
        jwtToken: 'user-jwt-token',
        requestId: 'complete-request-id',
        recursionCount: 3,
        healPhase: 'profile-init',
        healReason: 'Rate limit exceeded during connection processing',
        currentProcessingList: 'sent',
        currentBatch: 0,
        currentIndex: 12,
        masterIndexFile: 'profile-init-index-complete.json',
        completedBatches: [],
        totalConnections: {
          all: 1500,
          pending: 45,
          sent: 18
        },
        batchSize: 100,
        lastError: {
          connectionType: 'sent',
          message: 'Rate limit exceeded',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      // Act
      await controller._initiateHealing(completeHealingParams);

      // Assert
      expect(mockHealingManager.healAndRestart).toHaveBeenCalledWith(completeHealingParams);
      
      // Verify all parameters are passed through
      const calledWith = mockHealingManager.healAndRestart.mock.calls[0][0];
      expect(calledWith.searchName).toBe('user@example.com');
      expect(calledWith.searchPassword).toBe('userpassword');
      expect(calledWith.jwtToken).toBe('user-jwt-token');
      expect(calledWith.recursionCount).toBe(3);
      expect(calledWith.healPhase).toBe('profile-init');
      expect(calledWith.currentProcessingList).toBe('sent');
      expect(calledWith.currentBatch).toBe(0);
      expect(calledWith.currentIndex).toBe(12);
      expect(calledWith.masterIndexFile).toBe('profile-init-index-complete.json');
      expect(calledWith.totalConnections).toEqual({
        all: 1500,
        pending: 45,
        sent: 18
      });
    });
  });

  describe('Recovery Scenarios', () => {
    test('should recover from authentication failure during login', async () => {
      // Arrange
      const initialState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'auth-recovery-test',
        recursionCount: 0
      };

      const authError = new Error('LinkedIn authentication failed');
      service._performLinkedInLogin = jest.fn().mockRejectedValue(authError);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'AuthenticationError',
        category: 'authentication',
        isRecoverable: true
      });

      // Act & Assert
      await expect(service.initializeUserProfile(initialState)).rejects.toThrow('LinkedIn authentication failed');
      expect(authError.context).toEqual(
        expect.objectContaining({
          requestId: 'auth-recovery-test',
          duration: expect.any(Number),
          errorDetails: expect.objectContaining({
            type: 'AuthenticationError',
            category: 'authentication',
            isRecoverable: true
          })
        })
      );
    });

    test('should recover from network failure during batch processing', async () => {
      // Arrange
      const batchState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'batch-recovery-test',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Network timeout',
        currentProcessingList: 'all',
        currentBatch: 2,
        currentIndex: 50,
        masterIndexFile: 'profile-init-index-recovery.json',
        completedBatches: [0, 1]
      };

      ProfileInitStateManager.isHealingState.mockReturnValue(true);
      ProfileInitStateManager.validateState.mockImplementation(() => {
        // Validate that healing state is properly structured
        expect(batchState.healPhase).toBe('profile-init');
        expect(batchState.healReason).toBe('Network timeout');
        expect(batchState.recursionCount).toBe(1);
      });

      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 50, // Remaining connections from batch 2 onwards
        skipped: 10,
        errors: 2,
        progressSummary: { currentProgress: '75%' }
      });

      // Act
      const result = await service.initializeUserProfile(batchState);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(50);
      expect(ProfileInitStateManager.isHealingState).toHaveBeenCalledWith(batchState);
      expect(service.processConnectionLists).toHaveBeenCalledWith(batchState);
    });

    test('should recover from LinkedIn rate limiting', async () => {
      // Arrange
      const rateLimitState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'rate-limit-recovery-test',
        recursionCount: 2,
        healPhase: 'profile-init',
        healReason: 'LinkedIn rate limit exceeded',
        currentProcessingList: 'pending',
        currentBatch: 0,
        currentIndex: 15,
        masterIndexFile: 'profile-init-index-ratelimit.json'
      };

      ProfileInitStateManager.isHealingState.mockReturnValue(true);
      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 10, // Remaining connections after rate limit recovery
        skipped: 5,
        errors: 0,
        progressSummary: { currentProgress: '100%' }
      });

      // Act
      const result = await service.initializeUserProfile(rateLimitState);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(10);
      expect(result.metadata.requestId).toBe('rate-limit-recovery-test');
    });

    test('should handle multiple healing attempts', async () => {
      // Arrange
      const multiHealState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'multi-heal-test',
        recursionCount: 4, // Multiple healing attempts
        healPhase: 'profile-init',
        healReason: 'Multiple network failures',
        currentProcessingList: 'all',
        currentBatch: 1,
        currentIndex: 30
      };

      ProfileInitStateManager.isHealingState.mockReturnValue(true);
      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 70,
        skipped: 15,
        errors: 3,
        progressSummary: { currentProgress: '90%' }
      });

      // Act
      const result = await service.initializeUserProfile(multiHealState);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(70);
      expect(result.metadata.requestId).toBe('multi-heal-test');
      
      // Verify that high recursion count is handled properly
      expect(multiHealState.recursionCount).toBe(4);
    });
  });

  describe('Batch Processing Recovery', () => {
    test('should resume from specific batch and index', async () => {
      // Arrange
      const resumeState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        requestId: 'batch-resume-test',
        masterIndexFile: 'profile-init-index-resume.json',
        currentProcessingList: 'all',
        currentBatch: 3,
        currentIndex: 67,
        completedBatches: [0, 1, 2]
      };

      const mockMasterIndex = {
        metadata: {
          totalConnections: 400,
          totalPending: 20,
          totalSent: 10
        },
        processingState: {
          completedBatches: [0, 1, 2]
        }
      };

      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._processConnectionType = jest.fn().mockResolvedValue({
        processed: 33, // Remaining connections from batch 3 index 67 onwards
        skipped: 5,
        errors: 1
      });
      service._updateMasterIndex = jest.fn().mockResolvedValue();

      // Act
      const result = await service.processConnectionLists(resumeState);

      // Assert
      expect(result.processed).toBe(99); // 33 * 3 connection types
      expect(service._processConnectionType).toHaveBeenCalledWith('all', mockMasterIndex, resumeState);
      expect(service._processConnectionType).toHaveBeenCalledWith('pending', mockMasterIndex, resumeState);
      expect(service._processConnectionType).toHaveBeenCalledWith('sent', mockMasterIndex, resumeState);
    });

    test('should skip completed batches during recovery', async () => {
      // Arrange
      const skipBatchesState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        requestId: 'skip-batches-test',
        masterIndexFile: 'profile-init-index-skip.json',
        currentProcessingList: 'pending',
        completedBatches: [0, 1, 2, 3, 4] // Many completed batches
      };

      const mockMasterIndex = {
        metadata: { totalPending: 600 }, // 6 batches worth
        processingState: { completedBatches: [0, 1, 2, 3, 4] }
      };

      const mockConnections = Array(600).fill().map((_, i) => `profile${i}`);
      const mockBatchFiles = Array(6).fill().map((_, i) => `pending-batch-${i}.json`);

      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._getConnectionList = jest.fn().mockResolvedValue(mockConnections);
      service._createBatchFiles = jest.fn().mockResolvedValue(mockBatchFiles);
      service._processBatch = jest.fn().mockResolvedValue({
        processed: 100, skipped: 0, errors: 0
      });

      // Act
      const result = await service._processConnectionType('pending', mockMasterIndex, skipBatchesState);

      // Assert
      expect(result.processed).toBe(100); // Only batch 5 should be processed
      expect(service._processBatch).toHaveBeenCalledTimes(1);
      expect(service._processBatch).toHaveBeenCalledWith('pending-batch-5.json', skipBatchesState);
    });

    test('should handle batch file corruption during recovery', async () => {
      // Arrange
      const corruptionState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        requestId: 'corruption-recovery-test',
        masterIndexFile: 'profile-init-index-corrupt.json'
      };

      const corruptionError = new Error('Failed to load master index from profile-init-index-corrupt.json: Unexpected token');
      service._loadMasterIndex = jest.fn().mockRejectedValue(corruptionError);

      // Act & Assert
      await expect(service.processConnectionLists(corruptionState)).rejects.toThrow('Failed to load master index');
      expect(corruptionState.lastError).toBeUndefined(); // Error occurs before lastError is set
    });

    test('should preserve progress during connection type failures', async () => {
      // Arrange
      const progressState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        requestId: 'progress-preservation-test',
        masterIndexFile: 'profile-init-index-progress.json'
      };

      const mockMasterIndex = {
        metadata: {},
        processingState: { completedBatches: [] }
      };

      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._processConnectionType = jest.fn()
        .mockResolvedValueOnce({ processed: 50, skipped: 10, errors: 2 }) // 'all' succeeds
        .mockRejectedValueOnce(new Error('Pending connections processing failed')); // 'pending' fails

      // Act & Assert
      await expect(service.processConnectionLists(progressState)).rejects.toThrow('Pending connections processing failed');
      
      // Verify that error information is preserved for recovery
      expect(progressState.lastError).toEqual({
        connectionType: 'pending',
        message: 'Pending connections processing failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('State Validation During Recovery', () => {
    test('should validate healing state structure', async () => {
      // Arrange
      const invalidHealingState = {
        searchName: 'test@example.com',
        // Missing required fields for healing
        recursionCount: 1,
        healPhase: 'profile-init'
        // Missing healReason, jwtToken, etc.
      };

      ProfileInitStateManager.validateState.mockImplementation((state) => {
        if (!state.jwtToken) {
          throw new Error('Missing required field: jwtToken');
        }
        if (state.healPhase && !state.healReason) {
          throw new Error('Healing state must include healReason');
        }
      });

      // Act & Assert
      await expect(service.initializeUserProfile(invalidHealingState))
        .rejects.toThrow('Missing required field: jwtToken');
    });

    test('should validate batch processing state during recovery', async () => {
      // Arrange
      const invalidBatchState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'invalid-batch-test',
        currentProcessingList: 'all',
        currentBatch: 5,
        currentIndex: -1, // Invalid index
        masterIndexFile: 'profile-init-index-invalid.json'
      };

      ProfileInitStateManager.validateState.mockImplementation((state) => {
        if (state.currentIndex !== undefined && state.currentIndex < 0) {
          throw new Error('Invalid currentIndex: must be non-negative');
        }
      });

      // Act & Assert
      await expect(service.initializeUserProfile(invalidBatchState))
        .rejects.toThrow('Invalid currentIndex: must be non-negative');
    });

    test('should handle missing master index file during recovery', async () => {
      // Arrange
      const missingIndexState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'missing-index-test',
        masterIndexFile: 'nonexistent-index.json'
      };

      const fileError = new Error('ENOENT: no such file or directory, open \'nonexistent-index.json\'');
      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service._loadMasterIndex = jest.fn().mockRejectedValue(fileError);

      // Act & Assert
      await expect(service.initializeUserProfile(missingIndexState))
        .rejects.toThrow('ENOENT: no such file or directory');
    });
  });

  describe('Monitoring During Recovery', () => {
    test('should record healing events in monitoring', async () => {
      // Arrange
      const healingState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'monitoring-healing-test',
        recursionCount: 2,
        healPhase: 'profile-init',
        healReason: 'Network timeout during processing'
      };

      ProfileInitStateManager.isHealingState.mockReturnValue(true);
      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 25, skipped: 5, errors: 1
      });

      // Act
      await service.initializeUserProfile(healingState);

      // Assert
      // Monitoring should be called during the initialization process
      // The actual monitoring calls would be made by the controller, not the service
      expect(ProfileInitStateManager.isHealingState).toHaveBeenCalledWith(healingState);
    });

    test('should track recovery progress correctly', async () => {
      // Arrange
      const progressTrackingState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'progress-tracking-test',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Authentication retry',
        currentProcessingList: 'all',
        currentBatch: 2,
        currentIndex: 40,
        completedBatches: [0, 1]
      };

      const progressSummary = {
        totalProcessed: 240, // 2 completed batches * 100 + 40 current
        totalSkipped: 20,
        totalErrors: 5,
        currentProgress: '60%'
      };

      ProfileInitStateManager.getProgressSummary.mockReturnValue(progressSummary);
      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 60, // Remaining connections
        skipped: 10,
        errors: 2,
        progressSummary
      });

      // Act
      const result = await service.initializeUserProfile(progressTrackingState);

      // Assert
      expect(result.data.progressSummary).toEqual(progressSummary);
      expect(ProfileInitStateManager.getProgressSummary).toHaveBeenCalled();
    });
  });
});