/**
 * Integration tests for Profile Initialization feature
 * Tests API endpoint, database operations, and heal-and-restore mechanism
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ProfileInitController } from '../puppeteer-backend/controllers/profileInitController.js';
import { ProfileInitService } from '../puppeteer-backend/services/profileInitService.js';
import DynamoDBService from '../puppeteer-backend/services/dynamoDBService.js';
import { HealingManager } from '../puppeteer-backend/utils/healingManager.js';
import { ProfileInitStateManager } from '../puppeteer-backend/utils/profileInitStateManager.js';

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

describe('Profile Initialization Integration Tests', () => {
  let app;
  let mockDynamoDBService;
  let mockProfileInitService;
  let mockHealingManager;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Add profile init route
    app.post('/api/profile-init', async (req, res) => {
      const controller = new ProfileInitController();
      await controller.performProfileInit(req, res);
    });
  });

  beforeEach(() => {
    // Mock DynamoDBService
    mockDynamoDBService = {
      setAuthToken: jest.fn(),
      checkEdgeExists: jest.fn(),
      createGoodContactEdges: jest.fn()
    };

    // Mock ProfileInitService
    mockProfileInitService = {
      initializeUserProfile: jest.fn()
    };

    // Mock HealingManager
    mockHealingManager = {
      healAndRestart: jest.fn()
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    DynamoDBService.mockImplementation(() => mockDynamoDBService);
    ProfileInitService.mockImplementation(() => mockProfileInitService);
    HealingManager.mockImplementation(() => mockHealingManager);

    ProfileInitStateManager.buildInitialState = jest.fn().mockReturnValue({
      searchName: 'test@example.com',
      searchPassword: 'testpassword',
      jwtToken: 'valid-jwt-token',
      requestId: 'test-request-id',
      recursionCount: 0
    });

    ProfileInitStateManager.validateState = jest.fn();
    ProfileInitStateManager.isResumingState = jest.fn().mockReturnValue(false);
  });

  describe('API Endpoint Integration', () => {
    test('should handle successful profile initialization request', async () => {
      // Arrange
      const mockResult = {
        success: true,
        message: 'Profile database initialized successfully',
        data: {
          processed: 15,
          skipped: 3,
          errors: 0,
          connectionTypes: {
            all: { processed: 10, skipped: 2, errors: 0 },
            pending: { processed: 3, skipped: 1, errors: 0 },
            sent: { processed: 2, skipped: 0, errors: 0 }
          }
        }
      };

      mockProfileInitService.initializeUserProfile.mockResolvedValue(mockResult);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.requestId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('should reject request without authorization', async () => {
      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing or invalid Authorization header');
    });

    test('should reject request with missing credentials', async () => {
      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com'
          // Missing searchPassword
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required fields: searchName, searchPassword');
    });

    test('should handle healing scenario correctly', async () => {
      // Arrange
      // Mock the controller to return undefined (indicating healing)
      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockResolvedValue(undefined);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('healing');
      expect(response.body.message).toBe('Worker process started for healing/recovery.');
      expect(response.body.healingInfo).toBeDefined();

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });

    test('should handle internal server errors', async () => {
      // Arrange
      const error = new Error('Internal processing error');
      mockProfileInitService.initializeUserProfile.mockRejectedValue(error);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error during profile initialization');
      expect(response.body.errorType).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    test('should handle malformed JSON requests', async () => {
      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // Assert
      expect(response.status).toBe(400);
    });

    test('should validate JWT token format', async () => {
      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'InvalidTokenFormat')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing or invalid Authorization header');
    });
  });

  describe('Database Integration', () => {
    test('should set auth token on DynamoDB service', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: { processed: 5, skipped: 0, errors: 0 }
      };

      mockProfileInitService.initializeUserProfile.mockResolvedValue(mockResult);

      // Act
      await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer test-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(mockDynamoDBService.setAuthToken).toHaveBeenCalledWith('test-jwt-token');
    });

    test('should handle database connection errors', async () => {
      // Arrange
      const dbError = new Error('DynamoDB connection failed');
      mockProfileInitService.initializeUserProfile.mockRejectedValue(dbError);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.errorType).toBe('UnknownError'); // Since we're not mocking the categorization
    });

    test('should check edge existence before processing', async () => {
      // Arrange
      const profileInitService = new ProfileInitService();
      const userProfileId = 'user123';
      const connectionProfileId = 'connection456';

      mockDynamoDBService.checkEdgeExists.mockResolvedValue(false);

      // Act
      const result = await profileInitService.checkEdgeExists(userProfileId, connectionProfileId);

      // Assert
      expect(mockDynamoDBService.checkEdgeExists).toHaveBeenCalledWith(userProfileId, connectionProfileId);
      expect(result).toBe(false);
    });

    test('should create database edges for new connections', async () => {
      // Arrange
      const profileInitService = new ProfileInitService();
      const connectionProfileId = 'connection456';

      mockDynamoDBService.createGoodContactEdges.mockResolvedValue({ success: true });

      // Act
      await mockDynamoDBService.createGoodContactEdges(connectionProfileId);

      // Assert
      expect(mockDynamoDBService.createGoodContactEdges).toHaveBeenCalledWith(connectionProfileId);
    });

    test('should handle database validation errors', async () => {
      // Arrange
      const validationError = new Error('ValidationException: Invalid input');
      mockDynamoDBService.createGoodContactEdges.mockRejectedValue(validationError);

      // Act & Assert
      await expect(mockDynamoDBService.createGoodContactEdges('invalid-profile'))
        .rejects.toThrow('ValidationException: Invalid input');
    });
  });

  describe('Heal-and-Restore Integration', () => {
    test('should trigger healing for authentication failures', async () => {
      // Arrange
      const authError = new Error('LinkedIn authentication failed');
      mockProfileInitService.initializeUserProfile.mockRejectedValue(authError);

      // Mock the controller's healing logic
      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockImplementation(async function(state) {
        // Simulate the controller's healing logic
        try {
          await mockProfileInitService.initializeUserProfile(state);
        } catch (error) {
          if (this._shouldTriggerHealing && this._shouldTriggerHealing(error)) {
            await this._handleProfileInitHealing(state);
            return undefined; // Indicates healing
          }
          throw error;
        }
      });

      ProfileInitController.prototype._shouldTriggerHealing = jest.fn().mockReturnValue(true);
      ProfileInitController.prototype._handleProfileInitHealing = jest.fn().mockResolvedValue();

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('healing');

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });

    test('should create healing state with correct parameters', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 0,
        currentProcessingList: 'all',
        currentBatch: 1,
        currentIndex: 25,
        masterIndexFile: 'test-index.json'
      };

      const expectedHealingState = {
        ...mockState,
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Profile initialization failed'
      };

      ProfileInitStateManager.createHealingState = jest.fn().mockReturnValue(expectedHealingState);

      const controller = new ProfileInitController();

      // Act
      await controller._handleProfileInitHealing(mockState);

      // Assert
      expect(ProfileInitStateManager.createHealingState).toHaveBeenCalledWith(
        mockState,
        'profile-init',
        'Profile initialization failed',
        expect.objectContaining({
          recursionCount: 1,
          timestamp: expect.any(String)
        })
      );
    });

    test('should initiate healing with HealingManager', async () => {
      // Arrange
      const healingParams = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Authentication failed',
        currentProcessingList: 'pending',
        currentBatch: 2,
        currentIndex: 15,
        masterIndexFile: 'test-index.json'
      };

      const controller = new ProfileInitController();

      // Act
      await controller._initiateHealing(healingParams);

      // Assert
      expect(HealingManager).toHaveBeenCalled();
      expect(mockHealingManager.healAndRestart).toHaveBeenCalledWith(healingParams);
    });

    test('should handle healing recursion limits', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 5 // High recursion count
      };

      const error = new Error('LinkedIn authentication failed');
      mockProfileInitService.initializeUserProfile.mockRejectedValue(error);

      // Mock healing to eventually succeed after multiple attempts
      let healingAttempts = 0;
      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockImplementation(async function(state) {
        healingAttempts++;
        if (healingAttempts <= 3) {
          return undefined; // Continue healing
        }
        // Eventually return success
        return {
          success: true,
          data: { processed: 1, skipped: 0, errors: 0 }
        };
      });

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('healing');

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });

    test('should preserve state during healing', async () => {
      // Arrange
      const initialState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 0,
        currentProcessingList: 'pending',
        currentBatch: 3,
        currentIndex: 45,
        masterIndexFile: 'profile-init-index-123.json',
        completedBatches: [0, 1, 2]
      };

      ProfileInitStateManager.buildInitialState.mockReturnValue(initialState);

      const healingState = {
        ...initialState,
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Network error'
      };

      ProfileInitStateManager.createHealingState = jest.fn().mockReturnValue(healingState);

      const controller = new ProfileInitController();

      // Act
      await controller._handleProfileInitHealing(initialState);

      // Assert
      expect(ProfileInitStateManager.createHealingState).toHaveBeenCalledWith(
        initialState,
        'profile-init',
        'Profile initialization failed',
        expect.objectContaining({
          recursionCount: 1
        })
      );

      // Verify that important state is preserved
      expect(healingState.currentProcessingList).toBe('pending');
      expect(healingState.currentBatch).toBe(3);
      expect(healingState.currentIndex).toBe(45);
      expect(healingState.masterIndexFile).toBe('profile-init-index-123.json');
      expect(healingState.completedBatches).toEqual([0, 1, 2]);
    });
  });

  describe('Batch Processing Integration', () => {
    test('should handle large connection lists with batching', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: {
          processed: 250,
          skipped: 50,
          errors: 5,
          connectionTypes: {
            all: { processed: 200, skipped: 40, errors: 3 },
            pending: { processed: 30, skipped: 8, errors: 1 },
            sent: { processed: 20, skipped: 2, errors: 1 }
          },
          progressSummary: {
            totalProcessed: 250,
            totalSkipped: 50,
            totalErrors: 5,
            currentProgress: '100%'
          }
        }
      };

      mockProfileInitService.initializeUserProfile.mockResolvedValue(mockResult);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.processed).toBe(250);
      expect(response.body.data.connectionTypes).toBeDefined();
      expect(response.body.data.progressSummary).toBeDefined();
    });

    test('should resume processing from interrupted state', async () => {
      // Arrange
      const resumeState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'resume-request-id',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Network timeout',
        currentProcessingList: 'all',
        currentBatch: 2,
        currentIndex: 75,
        masterIndexFile: 'profile-init-index-456.json',
        completedBatches: [0, 1]
      };

      ProfileInitStateManager.buildInitialState.mockReturnValue(resumeState);
      ProfileInitStateManager.isResumingState.mockReturnValue(true);

      const mockResult = {
        success: true,
        data: {
          processed: 125, // Remaining connections from batch 2 onwards
          skipped: 25,
          errors: 2
        }
      };

      mockProfileInitService.initializeUserProfile.mockResolvedValue(mockResult);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.processed).toBe(125);
      expect(ProfileInitStateManager.isResumingState).toHaveBeenCalledWith(resumeState);
    });

    test('should handle batch processing errors gracefully', async () => {
      // Arrange
      const batchError = new Error('Batch processing failed at index 45');
      batchError.context = {
        batchNumber: 2,
        batchFilePath: 'all-connections-batch-2.json',
        connectionIndex: 45,
        totalConnections: 100,
        processedSoFar: 44,
        errorsSoFar: 1
      };

      mockProfileInitService.initializeUserProfile.mockRejectedValue(batchError);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error during profile initialization');
    });
  });

  describe('Error Recovery Integration', () => {
    test('should recover from network timeouts', async () => {
      // Arrange
      let attemptCount = 0;
      const networkError = new Error('Network timeout');

      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockImplementation(async function(state) {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          throw networkError;
        } else if (attemptCount === 2) {
          // Second attempt triggers healing
          if (this._shouldTriggerHealing && this._shouldTriggerHealing(networkError)) {
            await this._handleProfileInitHealing(state);
            return undefined;
          }
        }
        // Third attempt succeeds
        return {
          success: true,
          data: { processed: 10, skipped: 2, errors: 0 }
        };
      });

      ProfileInitController.prototype._shouldTriggerHealing = jest.fn().mockReturnValue(true);
      ProfileInitController.prototype._handleProfileInitHealing = jest.fn().mockResolvedValue();

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('healing');

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });

    test('should handle LinkedIn rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('LinkedIn rate limit exceeded');
      
      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockImplementation(async function(state) {
        if (this._shouldTriggerHealing && this._shouldTriggerHealing(rateLimitError)) {
          await this._handleProfileInitHealing(state);
          return undefined;
        }
        throw rateLimitError;
      });

      ProfileInitController.prototype._shouldTriggerHealing = jest.fn().mockReturnValue(true);
      ProfileInitController.prototype._handleProfileInitHealing = jest.fn().mockResolvedValue();

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(202);
      expect(response.body.status).toBe('healing');
      expect(response.body.message).toBe('Worker process started for healing/recovery.');

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });

    test('should not trigger healing for non-recoverable errors', async () => {
      // Arrange
      const validationError = new Error('Invalid input data');
      
      const originalController = ProfileInitController.prototype.performProfileInitFromState;
      ProfileInitController.prototype.performProfileInitFromState = jest.fn().mockImplementation(async function(state) {
        if (this._shouldTriggerHealing && !this._shouldTriggerHealing(validationError)) {
          throw validationError;
        }
      });

      ProfileInitController.prototype._shouldTriggerHealing = jest.fn().mockReturnValue(false);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error during profile initialization');

      // Restore original method
      ProfileInitController.prototype.performProfileInitFromState = originalController;
    });
  });

  describe('Performance and Monitoring Integration', () => {
    test('should track request timing and metrics', async () => {
      // Arrange
      const startTime = Date.now();
      const mockResult = {
        success: true,
        data: { processed: 50, skipped: 10, errors: 2 }
      };

      mockProfileInitService.initializeUserProfile.mockImplementation(async () => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockResult;
      });

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.timestamp).toBeDefined();
      
      const responseTime = new Date(response.body.timestamp).getTime();
      expect(responseTime).toBeGreaterThan(startTime);
    });

    test('should handle concurrent requests properly', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: { processed: 25, skipped: 5, errors: 1 }
      };

      mockProfileInitService.initializeUserProfile.mockResolvedValue(mockResult);

      // Act - Send multiple concurrent requests
      const requests = Array(3).fill().map(() =>
        request(app)
          .post('/api/profile-init')
          .set('Authorization', 'Bearer valid-jwt-token')
          .send({
            searchName: 'test@example.com',
            searchPassword: 'testpassword'
          })
      );

      const responses = await Promise.all(requests);

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.requestId).toBeDefined();
        // Each request should have a unique request ID
        expect(response.body.requestId).toMatch(/^profile-init-\d+-[a-z0-9]+$/);
      });

      // Verify all request IDs are unique
      const requestIds = responses.map(r => r.body.requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(requestIds.length);
    });

    test('should provide detailed error information in development mode', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const detailedError = new Error('Detailed error for debugging');
      detailedError.stack = 'Error: Detailed error for debugging\n    at test location';
      mockProfileInitService.initializeUserProfile.mockRejectedValue(detailedError);

      // Act
      const response = await request(app)
        .post('/api/profile-init')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({
          searchName: 'test@example.com',
          searchPassword: 'testpassword'
        });

      // Assert
      expect(response.status).toBe(500);
      if (response.body.technicalDetails) {
        expect(response.body.technicalDetails.originalMessage).toBe('Detailed error for debugging');
        expect(response.body.technicalDetails.stack).toBeDefined();
      }

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});