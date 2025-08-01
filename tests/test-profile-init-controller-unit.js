/**
 * Unit tests for ProfileInitController
 * Tests controller logic, request validation, error handling, and heal-and-restore mechanism
 */

const { ProfileInitController } = require('../backend/controllers/profileInitController.js');
const { ProfileInitStateManager } = require('../backend/utils/profileInitStateManager.js');
const { HealingManager } = require('../backend/utils/healingManager.js');
const { profileInitMonitor } = require('../backend/utils/profileInitMonitor.js');

// Mock dependencies
jest.mock('../backend/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../backend/services/puppeteerService.js');
jest.mock('../backend/services/linkedinService.js');
jest.mock('../backend/services/linkedinContactService.js');
jest.mock('../backend/services/dynamoDBService.js');
jest.mock('../backend/services/profileInitService.js');
jest.mock('../backend/utils/healingManager.js');
jest.mock('../backend/utils/profileInitStateManager.js');
jest.mock('../backend/utils/profileInitMonitor.js');

describe('ProfileInitController Unit Tests', () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockProfileInitService;
  let mockHealingManager;

  beforeEach(() => {
    controller = new ProfileInitController();
    
    // Mock request object
    mockReq = {
      method: 'POST',
      url: '/api/profile-init',
      headers: {
        'authorization': 'Bearer valid-jwt-token',
        'user-agent': 'test-agent',
        'content-type': 'application/json'
      },
      body: {
        searchName: 'test@example.com',
        searchPassword: 'testpassword'
      }
    };

    // Mock response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
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
    ProfileInitStateManager.buildInitialState = jest.fn().mockReturnValue({
      searchName: 'test@example.com',
      searchPassword: 'testpassword',
      jwtToken: 'valid-jwt-token',
      requestId: 'test-request-id',
      recursionCount: 0
    });

    ProfileInitStateManager.isResumingState = jest.fn().mockReturnValue(false);
    ProfileInitStateManager.validateState = jest.fn();

    profileInitMonitor.startRequest = jest.fn();
    profileInitMonitor.recordSuccess = jest.fn();
    profileInitMonitor.recordFailure = jest.fn();
    profileInitMonitor.recordHealing = jest.fn();

    HealingManager.mockImplementation(() => mockHealingManager);
  });

  describe('Request Validation', () => {
    test('should reject request without JWT token', async () => {
      // Arrange
      mockReq.headers.authorization = undefined;

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing or invalid Authorization header'
        })
      );
    });

    test('should reject request with malformed JWT token', async () => {
      // Arrange
      mockReq.headers.authorization = 'InvalidToken';

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing or invalid Authorization header'
        })
      );
    });

    test('should reject request without searchName', async () => {
      // Arrange
      mockReq.body.searchName = undefined;

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing required fields: searchName, searchPassword'
        })
      );
    });

    test('should reject request without searchPassword', async () => {
      // Arrange
      mockReq.body.searchPassword = undefined;

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing required fields: searchName, searchPassword'
        })
      );
    });

    test('should accept valid request with all required fields', async () => {
      // Arrange
      const mockResult = {
        success: true,
        data: { processed: 5, skipped: 2, errors: 0 }
      };

      // Mock successful processing
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(mockResult);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).not.toHaveBeenCalledWith(400);
      expect(mockRes.status).not.toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockResult
        })
      );
    });
  });

  describe('State Management', () => {
    test('should build initial state correctly', async () => {
      // Arrange
      const mockResult = { success: true };
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(mockResult);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(ProfileInitStateManager.buildInitialState).toHaveBeenCalledWith({
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: expect.any(String)
      });
    });

    test('should handle healing state correctly', async () => {
      // Arrange
      const healingOpts = {
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Authentication failed'
      };

      const mockResult = { success: true };
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(mockResult);

      // Act
      await controller.performProfileInit(mockReq, mockRes, healingOpts);

      // Assert
      expect(ProfileInitStateManager.buildInitialState).toHaveBeenCalledWith(
        expect.objectContaining({
          recursionCount: 1,
          healPhase: 'profile-init',
          healReason: 'Authentication failed'
        })
      );
    });

    test('should validate state before processing', async () => {
      // Arrange
      controller._initializeServices = jest.fn().mockResolvedValue({
        puppeteerService: { close: jest.fn() },
        linkedInService: {},
        linkedInContactService: {},
        dynamoDBService: { setAuthToken: jest.fn() }
      });

      controller._processUserProfile = jest.fn().mockResolvedValue({
        success: true,
        data: { processed: 1 }
      });

      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token'
      };

      // Act
      await controller.performProfileInitFromState(mockState);

      // Assert
      expect(ProfileInitStateManager.validateState).toHaveBeenCalledWith(mockState);
    });
  });

  describe('Service Integration', () => {
    test('should initialize services correctly', async () => {
      // Arrange
      const mockServices = {
        puppeteerService: { 
          initialize: jest.fn(),
          close: jest.fn()
        },
        linkedInService: {},
        linkedInContactService: {},
        dynamoDBService: { setAuthToken: jest.fn() }
      };

      controller._initializeServices = jest.fn().mockResolvedValue(mockServices);
      controller._processUserProfile = jest.fn().mockResolvedValue({
        success: true,
        data: { processed: 1 }
      });

      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token'
      };

      // Act
      await controller.performProfileInitFromState(mockState);

      // Assert
      expect(controller._initializeServices).toHaveBeenCalled();
      expect(mockServices.puppeteerService.close).toHaveBeenCalled();
    });

    test('should set auth token on DynamoDB service', async () => {
      // Arrange
      const mockServices = {
        puppeteerService: { close: jest.fn() },
        linkedInService: {},
        linkedInContactService: {},
        dynamoDBService: { setAuthToken: jest.fn() }
      };

      controller._initializeServices = jest.fn().mockResolvedValue(mockServices);
      controller._processUserProfile = jest.fn().mockResolvedValue({
        success: true,
        data: { processed: 1 }
      });

      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'test-jwt-token'
      };

      // Act
      await controller.performProfileInitFromState(mockState);

      // Assert
      expect(mockServices.dynamoDBService.setAuthToken).toHaveBeenCalledWith('test-jwt-token');
    });
  });

  describe('Error Handling', () => {
    test('should categorize authentication errors correctly', () => {
      // Arrange
      const authError = new Error('LinkedIn authentication failed');

      // Act
      const result = controller._categorizeError(authError);

      // Assert
      expect(result.type).toBe('AuthenticationError');
      expect(result.category).toBe('authentication');
      expect(result.isRecoverable).toBe(true);
      expect(result.severity).toBe('high');
    });

    test('should categorize network errors correctly', () => {
      // Arrange
      const networkError = new Error('Network connection timeout');

      // Act
      const result = controller._categorizeError(networkError);

      // Assert
      expect(result.type).toBe('NetworkError');
      expect(result.category).toBe('network');
      expect(result.isRecoverable).toBe(true);
      expect(result.severity).toBe('medium');
    });

    test('should categorize LinkedIn errors correctly', () => {
      // Arrange
      const linkedinError = new Error('LinkedIn rate limit exceeded');

      // Act
      const result = controller._categorizeError(linkedinError);

      // Assert
      expect(result.type).toBe('LinkedInError');
      expect(result.category).toBe('linkedin');
      expect(result.isRecoverable).toBe(true);
      expect(result.severity).toBe('high');
    });

    test('should categorize database errors correctly', () => {
      // Arrange
      const dbError = new Error('DynamoDB ValidationException');

      // Act
      const result = controller._categorizeError(dbError);

      // Assert
      expect(result.type).toBe('DatabaseError');
      expect(result.category).toBe('database');
      expect(result.isRecoverable).toBe(false);
      expect(result.severity).toBe('high');
    });

    test('should handle unknown errors gracefully', () => {
      // Arrange
      const unknownError = new Error('Some unexpected error');

      // Act
      const result = controller._categorizeError(unknownError);

      // Assert
      expect(result.type).toBe('UnknownError');
      expect(result.category).toBe('unknown');
      expect(result.isRecoverable).toBe(false);
      expect(result.severity).toBe('high');
    });

    test('should return 500 status for unhandled errors', async () => {
      // Arrange
      const error = new Error('Unexpected error');
      controller.performProfileInitFromState = jest.fn().mockRejectedValue(error);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error during profile initialization',
          errorType: 'UnknownError'
        })
      );
    });
  });

  describe('Heal-and-Restore Mechanism', () => {
    test('should determine recoverable errors correctly', () => {
      // Arrange
      const recoverableErrors = [
        new Error('LinkedIn login failed'),
        new Error('Authentication failed'),
        new Error('Network error occurred'),
        new Error('Connection timeout'),
        new Error('Rate limit exceeded'),
        new Error('Puppeteer navigation failed')
      ];

      // Act & Assert
      recoverableErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(true);
      });
    });

    test('should determine non-recoverable errors correctly', () => {
      // Arrange
      const nonRecoverableErrors = [
        new Error('Database validation failed'),
        new Error('Invalid input provided'),
        new Error('File not found')
      ];

      // Act & Assert
      nonRecoverableErrors.forEach(error => {
        expect(controller._shouldTriggerHealing(error)).toBe(false);
      });
    });

    test('should trigger healing for recoverable errors', async () => {
      // Arrange
      const recoverableError = new Error('LinkedIn authentication failed');
      controller._processUserProfile = jest.fn().mockRejectedValue(recoverableError);
      controller._shouldTriggerHealing = jest.fn().mockReturnValue(true);
      controller._handleProfileInitHealing = jest.fn().mockResolvedValue(undefined);

      const mockServices = {
        puppeteerService: { close: jest.fn() },
        linkedInService: {},
        linkedInContactService: {},
        dynamoDBService: { setAuthToken: jest.fn() }
      };

      controller._initializeServices = jest.fn().mockResolvedValue(mockServices);

      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token'
      };

      // Act
      const result = await controller.performProfileInitFromState(mockState);

      // Assert
      expect(controller._shouldTriggerHealing).toHaveBeenCalledWith(recoverableError);
      expect(controller._handleProfileInitHealing).toHaveBeenCalledWith(mockState);
      expect(result).toBeUndefined(); // Indicates healing in progress
    });

    test('should return 202 status when healing is triggered', async () => {
      // Arrange
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(undefined);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healing',
          message: 'Worker process started for healing/recovery.'
        })
      );
    });

    test('should create healing state correctly', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 0,
        currentProcessingList: 'all',
        currentBatch: 2,
        currentIndex: 15,
        masterIndexFile: 'test-index.json'
      };

      const expectedHealingState = {
        ...mockState,
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Profile initialization failed'
      };

      ProfileInitStateManager.createHealingState = jest.fn().mockReturnValue(expectedHealingState);
      controller._initiateHealing = jest.fn();

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
      expect(controller._initiateHealing).toHaveBeenCalledWith(expectedHealingState);
    });

    test('should initiate healing with HealingManager', async () => {
      // Arrange
      const healingParams = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Authentication failed'
      };

      // Act
      await controller._initiateHealing(healingParams);

      // Assert
      expect(HealingManager).toHaveBeenCalled();
      expect(mockHealingManager.healAndRestart).toHaveBeenCalledWith(healingParams);
    });
  });

  describe('Response Building', () => {
    test('should build success response correctly', () => {
      // Arrange
      const result = {
        success: true,
        data: { processed: 5, skipped: 2, errors: 0 }
      };
      const requestId = 'test-request-id';

      // Act
      const response = controller._buildSuccessResponse(result, requestId);

      // Assert
      expect(response).toEqual({
        status: 'success',
        data: result,
        requestId: requestId,
        timestamp: expect.any(String)
      });
    });

    test('should build error response correctly', () => {
      // Arrange
      const error = new Error('Test error');
      const requestId = 'test-request-id';
      const errorDetails = {
        type: 'TestError',
        category: 'test',
        severity: 'high',
        userMessage: 'A test error occurred'
      };

      // Act
      const response = controller._buildErrorResponse(error, requestId, errorDetails);

      // Assert
      expect(response).toEqual({
        error: 'Internal server error during profile initialization',
        message: 'A test error occurred',
        requestId: requestId,
        errorType: 'TestError',
        timestamp: expect.any(String)
      });
    });

    test('should include technical details in development mode', () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const requestId = 'test-request-id';
      const errorDetails = {
        type: 'TestError',
        category: 'test',
        severity: 'high',
        isRecoverable: true,
        userMessage: 'A test error occurred'
      };

      // Act
      const response = controller._buildErrorResponse(error, requestId, errorDetails);

      // Assert
      expect(response.technicalDetails).toEqual({
        originalMessage: 'Test error',
        stack: expect.any(String),
        category: 'test',
        severity: 'high',
        isRecoverable: true
      });

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Monitoring Integration', () => {
    test('should start request monitoring', async () => {
      // Arrange
      const mockResult = { success: true };
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(mockResult);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(profileInitMonitor.startRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          username: '[REDACTED]',
          recursionCount: 0,
          isResuming: false
        })
      );
    });

    test('should record success in monitoring', async () => {
      // Arrange
      const mockResult = { success: true, data: { processed: 5 } };
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(mockResult);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(profileInitMonitor.recordSuccess).toHaveBeenCalledWith(
        expect.any(String),
        mockResult
      );
    });

    test('should record failure in monitoring', async () => {
      // Arrange
      const error = new Error('Test error');
      controller.performProfileInitFromState = jest.fn().mockRejectedValue(error);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(profileInitMonitor.recordFailure).toHaveBeenCalledWith(
        expect.any(String),
        error,
        expect.any(Object)
      );
    });

    test('should record healing in monitoring', async () => {
      // Arrange
      controller.performProfileInitFromState = jest.fn().mockResolvedValue(undefined);

      // Act
      await controller.performProfileInit(mockReq, mockRes);

      // Assert
      expect(profileInitMonitor.recordHealing).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          recursionCount: expect.any(Number)
        })
      );
    });
  });

  describe('Request ID Generation', () => {
    test('should generate unique request IDs', () => {
      // Act
      const id1 = controller._generateRequestId();
      const id2 = controller._generateRequestId();

      // Assert
      expect(id1).toMatch(/^profile-init-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^profile-init-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('JWT Token Extraction', () => {
    test('should extract JWT token from Bearer header', () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'Bearer test-jwt-token'
        }
      };

      // Act
      const token = controller._extractJwtToken(req);

      // Assert
      expect(token).toBe('test-jwt-token');
    });

    test('should return null for missing authorization header', () => {
      // Arrange
      const req = { headers: {} };

      // Act
      const token = controller._extractJwtToken(req);

      // Assert
      expect(token).toBeNull();
    });

    test('should return null for malformed authorization header', () => {
      // Arrange
      const req = {
        headers: {
          authorization: 'InvalidFormat test-jwt-token'
        }
      };

      // Act
      const token = controller._extractJwtToken(req);

      // Assert
      expect(token).toBeNull();
    });
  });
});