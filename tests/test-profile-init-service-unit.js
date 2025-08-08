/**
 * Unit tests for ProfileInitService
 * Tests service logic, batch processing, connection handling, and LinkedIn integration
 */

import { jest } from '@jest/globals';
import { ProfileInitService } from '../puppeteer-backend/services/profileInitService.js';
import { ProfileInitStateManager } from '../puppeteer-backend/utils/profileInitStateManager.js';
import { profileInitMonitor } from '../puppeteer-backend/utils/profileInitMonitor.js';
import RandomHelpers from '../puppeteer-backend/utils/randomHelpers.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('../puppeteer-backend/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../puppeteer-backend/utils/profileInitStateManager.js');
jest.mock('../puppeteer-backend/utils/profileInitMonitor.js');
jest.mock('../puppeteer-backend/utils/randomHelpers.js');
jest.mock('fs/promises');
jest.mock('path');

describe('ProfileInitService Unit Tests', () => {
  let service;
  let mockPuppeteerService;
  let mockLinkedInService;
  let mockLinkedInContactService;
  let mockDynamoDBService;

  beforeEach(() => {
    // Mock services
    mockPuppeteerService = {
      initialize: jest.fn(),
      close: jest.fn()
    };

    mockLinkedInService = {
      login: jest.fn()
    };

    mockLinkedInContactService = {
      takeScreenShotAndUploadToS3: jest.fn()
    };

    mockDynamoDBService = {
      setAuthToken: jest.fn(),
      createGoodContactEdges: jest.fn(),
      checkEdgeExists: jest.fn()
    };

    // Create service instance
    service = new ProfileInitService(
      mockPuppeteerService,
      mockLinkedInService,
      mockLinkedInContactService,
      mockDynamoDBService
    );

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    ProfileInitStateManager.validateState = jest.fn();
    ProfileInitStateManager.isResumingState = jest.fn().mockReturnValue(false);
    ProfileInitStateManager.isHealingState = jest.fn().mockReturnValue(false);
    ProfileInitStateManager.getProgressSummary = jest.fn().mockReturnValue({
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      currentProgress: '0%'
    });
    ProfileInitStateManager.updateBatchProgress = jest.fn().mockImplementation((state, updates) => ({
      ...state,
      ...updates
    }));

    profileInitMonitor.recordConnection = jest.fn();
    RandomHelpers.randomDelay = jest.fn().mockResolvedValue();

    fs.writeFile = jest.fn().mockResolvedValue();
    fs.readFile = jest.fn();
    fs.mkdir = jest.fn().mockResolvedValue();
    path.join = jest.fn().mockImplementation((...args) => args.join('/'));
  });

  describe('Service Initialization', () => {
    test('should initialize with correct dependencies', () => {
      // Assert
      expect(service.puppeteer).toBe(mockPuppeteerService);
      expect(service.linkedInService).toBe(mockLinkedInService);
      expect(service.linkedInContactService).toBe(mockLinkedInContactService);
      expect(service.dynamoDBService).toBe(mockDynamoDBService);
      expect(service.batchSize).toBe(100);
    });

    test('should allow custom batch size configuration', () => {
      // Arrange
      const customService = new ProfileInitService(
        mockPuppeteerService,
        mockLinkedInService,
        mockLinkedInContactService,
        mockDynamoDBService
      );
      customService.batchSize = 50;

      // Assert
      expect(customService.batchSize).toBe(50);
    });
  });

  describe('Profile Initialization', () => {
    test('should initialize user profile successfully', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id'
      };

      const mockResult = {
        processed: 5,
        skipped: 2,
        errors: 0,
        progressSummary: { totalProcessed: 5 }
      };

      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue(mockResult);

      // Act
      const result = await service.initializeUserProfile(mockState);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Profile database initialized successfully');
      expect(result.data).toEqual(mockResult);
      expect(result.metadata.requestId).toBe('test-request-id');
      expect(mockDynamoDBService.setAuthToken).toHaveBeenCalledWith('valid-jwt-token');
    });

    test('should validate state before processing', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token'
      };

      service._performLinkedInLogin = jest.fn().mockResolvedValue();
      service.processConnectionLists = jest.fn().mockResolvedValue({
        processed: 0, skipped: 0, errors: 0
      });

      // Act
      await service.initializeUserProfile(mockState);

      // Assert
      expect(ProfileInitStateManager.validateState).toHaveBeenCalledWith(mockState);
    });

    test('should handle initialization errors with context', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id'
      };

      const error = new Error('LinkedIn login failed');
      service._performLinkedInLogin = jest.fn().mockRejectedValue(error);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'AuthenticationError',
        category: 'authentication',
        isRecoverable: true
      });

      // Act & Assert
      await expect(service.initializeUserProfile(mockState)).rejects.toThrow('LinkedIn login failed');
      expect(error.context).toEqual(
        expect.objectContaining({
          requestId: 'test-request-id',
          duration: expect.any(Number),
          state: expect.any(Object),
          errorDetails: expect.any(Object)
        })
      );
    });
  });

  describe('LinkedIn Login', () => {
    test('should perform LinkedIn login successfully', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 0
      };

      mockLinkedInService.login.mockResolvedValue();

      // Act
      await service._performLinkedInLogin(mockState);

      // Assert
      expect(mockLinkedInService.login).toHaveBeenCalledWith(
        'test@example.com',
        'testpassword',
        false // isRetry should be false for recursionCount 0
      );
    });

    test('should handle retry login for healing scenarios', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 2
      };

      mockLinkedInService.login.mockResolvedValue();

      // Act
      await service._performLinkedInLogin(mockState);

      // Assert
      expect(mockLinkedInService.login).toHaveBeenCalledWith(
        'test@example.com',
        'testpassword',
        true // isRetry should be true for recursionCount > 0
      );
    });

    test('should handle login failures with enhanced error context', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 0
      };

      const loginError = new Error('Authentication failed');
      mockLinkedInService.login.mockRejectedValue(loginError);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'AuthenticationError',
        category: 'authentication',
        isRecoverable: true
      });

      // Act & Assert
      await expect(service._performLinkedInLogin(mockState)).rejects.toThrow('LinkedIn authentication failed');
    });

    test('should log healing context when present', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        searchPassword: 'testpassword',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id',
        recursionCount: 1,
        healPhase: 'profile-init',
        healReason: 'Previous authentication failed'
      };

      ProfileInitStateManager.isHealingState.mockReturnValue(true);
      mockLinkedInService.login.mockResolvedValue();

      // Act
      await service._performLinkedInLogin(mockState);

      // Assert
      expect(ProfileInitStateManager.isHealingState).toHaveBeenCalledWith(mockState);
    });
  });

  describe('Connection List Processing', () => {
    test('should process connection lists successfully', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        requestId: 'test-request-id'
      };

      const mockMasterIndex = {
        metadata: {
          totalConnections: 100,
          totalPending: 5,
          totalSent: 3
        },
        processingState: {
          completedBatches: []
        }
      };

      service._createMasterIndexFile = jest.fn().mockResolvedValue('test-index.json');
      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._processConnectionType = jest.fn().mockResolvedValue({
        processed: 10,
        skipped: 2,
        errors: 0
      });
      service._updateMasterIndex = jest.fn().mockResolvedValue();

      // Act
      const result = await service.processConnectionLists(mockState);

      // Assert
      expect(result.processed).toBe(30); // 10 * 3 connection types
      expect(result.skipped).toBe(6); // 2 * 3 connection types
      expect(result.errors).toBe(0);
      expect(result.connectionTypes).toHaveProperty('all');
      expect(result.connectionTypes).toHaveProperty('pending');
      expect(result.connectionTypes).toHaveProperty('sent');
    });

    test('should create master index file when not resuming', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        masterIndexFile: null
      };

      service._createMasterIndexFile = jest.fn().mockResolvedValue('new-index.json');
      service._loadMasterIndex = jest.fn().mockResolvedValue({
        metadata: {},
        processingState: { completedBatches: [] }
      });
      service._processConnectionType = jest.fn().mockResolvedValue({
        processed: 0, skipped: 0, errors: 0
      });
      service._updateMasterIndex = jest.fn().mockResolvedValue();

      // Act
      await service.processConnectionLists(mockState);

      // Assert
      expect(service._createMasterIndexFile).toHaveBeenCalledWith(mockState);
      expect(mockState.masterIndexFile).toBe('new-index.json');
    });

    test('should resume from specific connection list', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        masterIndexFile: 'existing-index.json',
        currentProcessingList: 'pending'
      };

      const mockMasterIndex = {
        metadata: {},
        processingState: { completedBatches: [] }
      };

      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._processConnectionType = jest.fn().mockResolvedValue({
        processed: 5, skipped: 1, errors: 0
      });
      service._updateMasterIndex = jest.fn().mockResolvedValue();

      // Act
      await service.processConnectionLists(mockState);

      // Assert
      // Should only process 'pending' and 'sent', skipping 'all'
      expect(service._processConnectionType).toHaveBeenCalledTimes(2);
      expect(service._processConnectionType).toHaveBeenCalledWith('pending', mockMasterIndex, mockState);
      expect(service._processConnectionType).toHaveBeenCalledWith('sent', mockMasterIndex, mockState);
    });

    test('should handle connection type processing errors', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token',
        masterIndexFile: 'test-index.json'
      };

      const mockMasterIndex = {
        metadata: {},
        processingState: { completedBatches: [] }
      };

      const error = new Error('Connection processing failed');
      service._loadMasterIndex = jest.fn().mockResolvedValue(mockMasterIndex);
      service._processConnectionType = jest.fn()
        .mockResolvedValueOnce({ processed: 5, skipped: 0, errors: 0 }) // 'all' succeeds
        .mockRejectedValueOnce(error); // 'pending' fails

      // Act & Assert
      await expect(service.processConnectionLists(mockState)).rejects.toThrow('Connection processing failed');
      expect(mockState.lastError).toEqual({
        connectionType: 'pending',
        message: 'Connection processing failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Master Index File Management', () => {
    test('should create master index file with correct structure', async () => {
      // Arrange
      const mockState = {
        searchName: 'test@example.com',
        jwtToken: 'valid-jwt-token'
      };

      const mockConnectionCounts = {
        all: 150,
        pending: 8,
        sent: 4
      };

      service._getConnectionCounts = jest.fn().mockResolvedValue(mockConnectionCounts);

      // Act
      const result = await service._createMasterIndexFile(mockState);

      // Assert
      expect(result).toMatch(/^data\/profile-init-index-\d+\.json$/);
      expect(fs.writeFile).toHaveBeenCalledWith(
        result,
        expect.stringContaining('"totalConnections":150')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        result,
        expect.stringContaining('"totalPending":8')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        result,
        expect.stringContaining('"totalSent":4')
      );
    });

    test('should load master index from file', async () => {
      // Arrange
      const masterIndexFile = 'test-index.json';
      const mockIndexData = {
        metadata: { totalConnections: 100 },
        files: {},
        processingState: {}
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockIndexData));

      // Act
      const result = await service._loadMasterIndex(masterIndexFile);

      // Assert
      expect(fs.readFile).toHaveBeenCalledWith(masterIndexFile, 'utf8');
      expect(result).toEqual(mockIndexData);
    });

    test('should handle master index loading errors', async () => {
      // Arrange
      const masterIndexFile = 'nonexistent-index.json';
      const error = new Error('File not found');
      fs.readFile.mockRejectedValue(error);

      // Act & Assert
      await expect(service._loadMasterIndex(masterIndexFile)).rejects.toThrow('File not found');
    });

    test('should update master index file', async () => {
      // Arrange
      const masterIndexFile = 'test-index.json';
      const masterIndex = {
        metadata: { totalConnections: 100 },
        processingState: { currentBatch: 1 }
      };

      // Act
      await service._updateMasterIndex(masterIndexFile, masterIndex);

      // Assert
      expect(fs.writeFile).toHaveBeenCalledWith(
        masterIndexFile,
        JSON.stringify(masterIndex, null, 2)
      );
    });
  });

  describe('Connection Type Processing', () => {
    test('should process connection type successfully', async () => {
      // Arrange
      const connectionType = 'all';
      const mockMasterIndex = {
        processingState: { completedBatches: [] }
      };
      const mockState = {
        completedBatches: [],
        currentBatch: 0
      };

      const mockConnections = ['profile1', 'profile2', 'profile3'];
      const mockBatchFiles = ['batch-0.json'];

      service._getConnectionList = jest.fn().mockResolvedValue(mockConnections);
      service._createBatchFiles = jest.fn().mockResolvedValue(mockBatchFiles);
      service._processBatch = jest.fn().mockResolvedValue({
        processed: 3,
        skipped: 0,
        errors: 0
      });

      // Act
      const result = await service._processConnectionType(connectionType, mockMasterIndex, mockState);

      // Assert
      expect(result.processed).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.batches).toHaveLength(1);
      expect(RandomHelpers.randomDelay).toHaveBeenCalledWith(2000, 5000);
    });

    test('should skip empty connection lists', async () => {
      // Arrange
      const connectionType = 'pending';
      const mockMasterIndex = { processingState: { completedBatches: [] } };
      const mockState = {};

      service._getConnectionList = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service._processConnectionType(connectionType, mockMasterIndex, mockState);

      // Assert
      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(service._createBatchFiles).not.toHaveBeenCalled();
    });

    test('should skip completed batches when resuming', async () => {
      // Arrange
      const connectionType = 'all';
      const mockMasterIndex = {
        processingState: { completedBatches: [] }
      };
      const mockState = {
        completedBatches: [0, 1], // Batches 0 and 1 already completed
        currentBatch: 2
      };

      const mockConnections = Array(300).fill().map((_, i) => `profile${i}`); // 3 batches worth
      const mockBatchFiles = ['batch-0.json', 'batch-1.json', 'batch-2.json'];

      service._getConnectionList = jest.fn().mockResolvedValue(mockConnections);
      service._createBatchFiles = jest.fn().mockResolvedValue(mockBatchFiles);
      service._processBatch = jest.fn().mockResolvedValue({
        processed: 100,
        skipped: 0,
        errors: 0
      });

      // Act
      const result = await service._processConnectionType(connectionType, mockMasterIndex, mockState);

      // Assert
      expect(service._processBatch).toHaveBeenCalledTimes(1); // Only batch 2 should be processed
      expect(service._processBatch).toHaveBeenCalledWith('batch-2.json', mockState);
    });
  });

  describe('Batch File Management', () => {
    test('should create batch files correctly', async () => {
      // Arrange
      const connectionType = 'all';
      const connections = Array(250).fill().map((_, i) => `profile${i}`); // 3 batches worth
      const mockMasterIndex = {
        files: {}
      };

      // Act
      const result = await service._createBatchFiles(connectionType, connections, mockMasterIndex);

      // Assert
      expect(result).toHaveLength(3); // 250 connections / 100 batch size = 3 batches
      expect(fs.writeFile).toHaveBeenCalledTimes(3);
      
      // Check first batch file
      expect(fs.writeFile).toHaveBeenCalledWith(
        'data/all-connections-batch-0.json',
        expect.stringContaining('"batchNumber":0')
      );
      
      // Check master index update
      expect(mockMasterIndex.files.allConnections).toEqual([
        'all-connections-batch-0.json',
        'all-connections-batch-1.json',
        'all-connections-batch-2.json'
      ]);
    });

    test('should handle batch file creation errors', async () => {
      // Arrange
      const connectionType = 'pending';
      const connections = ['profile1', 'profile2'];
      const mockMasterIndex = { files: {} };
      const error = new Error('Write failed');

      fs.writeFile.mockRejectedValue(error);

      // Act & Assert
      await expect(service._createBatchFiles(connectionType, connections, mockMasterIndex))
        .rejects.toThrow('Write failed');
    });
  });

  describe('Batch Processing', () => {
    test('should process batch successfully', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 0,
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2', 'profile3'],
        batchMetadata: {}
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn().mockResolvedValue(false);
      service._processConnection = jest.fn().mockResolvedValue();

      // Act
      const result = await service._processBatch(batchFilePath, mockState);

      // Assert
      expect(result.batchNumber).toBe(0);
      expect(result.processed).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.connections).toHaveLength(3);
      expect(mockState.currentIndex).toBe(0); // Reset after successful batch
    });

    test('should skip connections with existing edges', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 0,
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2'],
        batchMetadata: {}
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn()
        .mockResolvedValueOnce(true)  // profile1 has existing edge
        .mockResolvedValueOnce(false); // profile2 doesn't have edge
      service._processConnection = jest.fn().mockResolvedValue();

      // Act
      const result = await service._processBatch(batchFilePath, mockState);

      // Assert
      expect(result.processed).toBe(1); // Only profile2 processed
      expect(result.skipped).toBe(1); // profile1 skipped
      expect(result.errors).toBe(0);
      expect(service._processConnection).toHaveBeenCalledTimes(1);
      expect(profileInitMonitor.recordConnection).toHaveBeenCalledWith(
        'test-request-id',
        'profile1',
        'skipped',
        expect.any(Number),
        expect.objectContaining({
          reason: 'Edge already exists'
        })
      );
    });

    test('should resume from specific index', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 2, // Resume from index 2
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2', 'profile3', 'profile4'],
        batchMetadata: {}
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn().mockResolvedValue(false);
      service._processConnection = jest.fn().mockResolvedValue();

      // Act
      const result = await service._processBatch(batchFilePath, mockState);

      // Assert
      expect(result.processed).toBe(2); // Only profile3 and profile4 processed
      expect(service._processConnection).toHaveBeenCalledTimes(2);
      expect(service._processConnection).toHaveBeenCalledWith('profile3', mockState);
      expect(service._processConnection).toHaveBeenCalledWith('profile4', mockState);
    });

    test('should handle connection-level errors gracefully', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 0,
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2'],
        batchMetadata: {}
      };

      const connectionError = new Error('Profile not found');
      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn().mockResolvedValue(false);
      service._processConnection = jest.fn()
        .mockRejectedValueOnce(connectionError) // profile1 fails
        .mockResolvedValueOnce(); // profile2 succeeds
      service._isConnectionLevelError = jest.fn().mockReturnValue(true);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'ProfileError',
        category: 'profile',
        skipConnection: true
      });

      // Act
      const result = await service._processBatch(batchFilePath, mockState);

      // Assert
      expect(result.processed).toBe(1); // profile2 processed
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(1); // profile1 error
      expect(result.connections[0].status).toBe('error');
      expect(result.connections[1].status).toBe('processed');
    });

    test('should fail batch for serious errors', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 0,
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2'],
        batchMetadata: {}
      };

      const seriousError = new Error('Database connection failed');
      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn().mockResolvedValue(false);
      service._processConnection = jest.fn().mockRejectedValue(seriousError);
      service._isConnectionLevelError = jest.fn().mockReturnValue(false);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'DatabaseError',
        category: 'database',
        skipConnection: false
      });

      // Act & Assert
      await expect(service._processBatch(batchFilePath, mockState)).rejects.toThrow('Database connection failed');
      expect(seriousError.context).toEqual(
        expect.objectContaining({
          batchNumber: 0,
          batchFilePath,
          connectionIndex: 0,
          totalConnections: 2
        })
      );
    });

    test('should handle batch file loading errors', async () => {
      // Arrange
      const batchFilePath = 'nonexistent-batch.json';
      const mockState = { requestId: 'test-request-id' };
      const fileError = new Error('File not found');

      fs.readFile.mockRejectedValue(fileError);

      // Act & Assert
      await expect(service._processBatch(batchFilePath, mockState))
        .rejects.toThrow('Batch file loading failed: File not found');
    });
  });

  describe('Connection Processing', () => {
    test('should process connection successfully', async () => {
      // Arrange
      const connectionProfileId = 'profile123';
      const mockState = {
        requestId: 'test-request-id',
        currentBatch: 0,
        currentIndex: 5
      };

      const mockScreenshotResult = {
        success: true,
        path: 'screenshot.png'
      };

      const mockDatabaseResult = { success: true };

      service.captureProfileScreenshot = jest.fn().mockResolvedValue(mockScreenshotResult);
      mockDynamoDBService.createGoodContactEdges.mockResolvedValue(mockDatabaseResult);

      // Act
      await service._processConnection(connectionProfileId, mockState);

      // Assert
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('linkedin-screenshots'),
        { recursive: true }
      );
      expect(service.captureProfileScreenshot).toHaveBeenCalledWith(
        connectionProfileId,
        expect.stringContaining('linkedin-screenshots')
      );
      expect(mockDynamoDBService.createGoodContactEdges).toHaveBeenCalledWith(connectionProfileId);
    });

    test('should handle screenshot failures gracefully', async () => {
      // Arrange
      const connectionProfileId = 'profile123';
      const mockState = {
        requestId: 'test-request-id',
        currentBatch: 0,
        currentIndex: 5
      };

      const mockScreenshotResult = {
        success: false,
        message: 'Screenshot capture failed'
      };

      const mockDatabaseResult = { success: true };

      service.captureProfileScreenshot = jest.fn().mockResolvedValue(mockScreenshotResult);
      mockDynamoDBService.createGoodContactEdges.mockResolvedValue(mockDatabaseResult);

      // Act
      await service._processConnection(connectionProfileId, mockState);

      // Assert
      expect(mockDynamoDBService.createGoodContactEdges).toHaveBeenCalledWith(connectionProfileId);
      // Should continue processing even if screenshot fails
    });

    test('should handle processing errors with context', async () => {
      // Arrange
      const connectionProfileId = 'profile123';
      const mockState = {
        requestId: 'test-request-id',
        currentBatch: 0,
        currentIndex: 5
      };

      const processingError = new Error('Database operation failed');
      service.captureProfileScreenshot = jest.fn().mockResolvedValue({ success: true });
      mockDynamoDBService.createGoodContactEdges.mockRejectedValue(processingError);
      service._categorizeServiceError = jest.fn().mockReturnValue({
        type: 'DatabaseError',
        category: 'database',
        skipConnection: false
      });

      // Act & Assert
      await expect(service._processConnection(connectionProfileId, mockState))
        .rejects.toThrow('Database operation failed');
      expect(processingError.context).toEqual(
        expect.objectContaining({
          requestId: 'test-request-id',
          profileId: connectionProfileId,
          duration: expect.any(Number),
          errorDetails: expect.any(Object)
        })
      );
    });
  });

  describe('Edge Existence Checking', () => {
    test('should check edge existence correctly', async () => {
      // Arrange
      const userProfileId = 'user123';
      const connectionProfileId = 'profile456';
      mockDynamoDBService.checkEdgeExists.mockResolvedValue(true);

      // Act
      const result = await service.checkEdgeExists(userProfileId, connectionProfileId);

      // Assert
      expect(mockDynamoDBService.checkEdgeExists).toHaveBeenCalledWith(userProfileId, connectionProfileId);
      expect(result).toBe(true);
    });

    test('should handle edge check errors gracefully', async () => {
      // Arrange
      const userProfileId = 'user123';
      const connectionProfileId = 'profile456';
      const error = new Error('Database error');
      mockDynamoDBService.checkEdgeExists.mockRejectedValue(error);

      // Act
      const result = await service.checkEdgeExists(userProfileId, connectionProfileId);

      // Assert
      expect(result).toBe(false); // Should return false on error
    });
  });

  describe('Error Categorization', () => {
    test('should identify connection-level errors', () => {
      // Arrange
      const connectionErrors = [
        new Error('Profile not found'),
        new Error('Profile is private'),
        new Error('Profile unavailable'),
        new Error('Screenshot failed'),
        new Error('Invalid profile ID'),
        new Error('Profile deleted')
      ];

      // Act & Assert
      connectionErrors.forEach(error => {
        expect(service._isConnectionLevelError(error)).toBe(true);
      });
    });

    test('should identify non-connection-level errors', () => {
      // Arrange
      const seriousErrors = [
        new Error('Database connection failed'),
        new Error('Network timeout'),
        new Error('Authentication expired'),
        new Error('Service unavailable')
      ];

      // Act & Assert
      seriousErrors.forEach(error => {
        expect(service._isConnectionLevelError(error)).toBe(false);
      });
    });
  });

  describe('Random Delays', () => {
    test('should add delays between connections', async () => {
      // Arrange
      const batchFilePath = 'test-batch.json';
      const mockState = {
        requestId: 'test-request-id',
        currentIndex: 0,
        userProfileId: 'user123'
      };

      const mockBatchData = {
        batchNumber: 0,
        connections: ['profile1', 'profile2'],
        batchMetadata: {}
      };

      fs.readFile.mockResolvedValue(JSON.stringify(mockBatchData));
      service.checkEdgeExists = jest.fn().mockResolvedValue(false);
      service._processConnection = jest.fn().mockResolvedValue();

      // Act
      await service._processBatch(batchFilePath, mockState);

      // Assert
      expect(RandomHelpers.randomDelay).toHaveBeenCalledWith(1000, 3000);
      expect(RandomHelpers.randomDelay).toHaveBeenCalledTimes(2); // Once per connection
    });

    test('should add delays between batches', async () => {
      // Arrange
      const connectionType = 'all';
      const mockMasterIndex = {
        processingState: { completedBatches: [] }
      };
      const mockState = { completedBatches: [] };

      const mockConnections = Array(200).fill().map((_, i) => `profile${i}`); // 2 batches
      const mockBatchFiles = ['batch-0.json', 'batch-1.json'];

      service._getConnectionList = jest.fn().mockResolvedValue(mockConnections);
      service._createBatchFiles = jest.fn().mockResolvedValue(mockBatchFiles);
      service._processBatch = jest.fn().mockResolvedValue({
        processed: 100, skipped: 0, errors: 0
      });

      // Act
      await service._processConnectionType(connectionType, mockMasterIndex, mockState);

      // Assert
      expect(RandomHelpers.randomDelay).toHaveBeenCalledWith(2000, 5000);
      expect(RandomHelpers.randomDelay).toHaveBeenCalledTimes(2); // Once per batch
    });
  });
});