import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  messageGenerationService, 
  MessageGenerationService,
  MessageGenerationError,
  type MessageGenerationRequest 
} from '../../services/messageGenerationService';
import { CognitoAuthService } from '../../services/cognitoService';

// Mock the CognitoAuthService
vi.mock('../../services/cognitoService', () => ({
  CognitoAuthService: {
    getCurrentUserToken: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

describe('MessageGenerationService', () => {
  let service: MessageGenerationService;
  
  const mockRequest: MessageGenerationRequest = {
    connectionId: 'test-connection-id',
    connectionProfile: {
      firstName: 'John',
      lastName: 'Doe',
      position: 'Software Engineer',
      company: 'Tech Corp',
      headline: 'Passionate about technology',
      tags: ['javascript', 'react'],
    },
    conversationTopic: 'Discussing new React features',
    messageHistory: [
      {
        id: 'msg-1',
        content: 'Hello John!',
        timestamp: '2024-01-01T10:00:00Z',
        sender: 'user',
      },
    ],
    userProfile: {
      user_id: 'user-123',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      headline: 'Product Manager',
      company: 'My Company',
      current_position: 'Senior PM',
      industry: 'Technology',
      interests: ['product', 'technology'],
      preferences: {},
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  };

  const mockSuccessResponse = {
    generatedMessage: 'Hi John! I saw your recent work on React components...',
    confidence: 0.85,
    reasoning: 'Generated based on shared interest in React',
  };

  beforeEach(() => {
    service = new MessageGenerationService();
    vi.clearAllMocks();
    
    // Mock successful auth token retrieval by default
    vi.mocked(CognitoAuthService.getCurrentUserToken).mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateMessage', () => {
    it('should successfully generate a message with valid request', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // Act
      const result = await service.generateMessage(mockRequest);

      // Assert
      expect(result).toBe(mockSuccessResponse.generatedMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/ai/generate-message',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
          }),
          body: expect.stringContaining('test-connection-id'),
        })
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('jwt_token', 'mock-jwt-token');
    });

    it('should handle missing auth token gracefully', async () => {
      // Arrange
      vi.mocked(CognitoAuthService.getCurrentUserToken).mockResolvedValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // Act
      const result = await service.generateMessage(mockRequest);

      // Assert
      expect(result).toBe(mockSuccessResponse.generatedMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/ai/generate-message',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });

    it('should validate required fields and throw error for missing connectionId', async () => {
      // Arrange
      const invalidRequest = { ...mockRequest, connectionId: '' };

      // Act & Assert
      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Connection ID is required',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should validate required fields and throw error for missing conversation topic', async () => {
      // Arrange
      const invalidRequest = { ...mockRequest, conversationTopic: '' };

      // Act & Assert
      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Conversation topic is required',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should validate required fields and throw error for missing connection profile', async () => {
      // Arrange
      const invalidRequest = { ...mockRequest, connectionProfile: undefined as any };

      // Act & Assert
      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Connection profile is required',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should validate connection profile fields', async () => {
      // Arrange
      const invalidRequest = {
        ...mockRequest,
        connectionProfile: {
          firstName: 'John',
          lastName: '',
          position: 'Engineer',
          company: 'Tech Corp',
        },
      };

      // Act & Assert
      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Connection profile must include firstName, lastName, position, and company',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should handle HTTP 400 error with user-friendly message', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request', code: 'BAD_REQUEST' }),
      });

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Bad request',
          status: 400,
          code: 'BAD_REQUEST',
        })
      );
    });

    it('should handle HTTP 401 error', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'HTTP error! status: 401',
          status: 401,
        })
      );
    });

    it('should handle HTTP 429 rate limiting error', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'HTTP error! status: 429',
          status: 429,
        })
      );
    });

    it('should handle HTTP 500 server error', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'HTTP error! status: 500',
          status: 500,
        })
      );
    });

    it('should handle network timeout error', async () => {
      // Arrange
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Request timeout - message generation is taking too long',
          code: 'TIMEOUT',
        })
      );
    });

    it('should handle network error', async () => {
      // Arrange
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Network connection failed',
          code: 'NETWORK_ERROR',
        })
      );
    });

    it('should handle invalid response missing generated message', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ confidence: 0.8 }), // Missing generatedMessage
      });

      // Act & Assert
      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Invalid response: missing generated message',
          code: 'INVALID_RESPONSE',
        })
      );
    });

    it('should handle auth token retrieval error', async () => {
      // Arrange
      vi.mocked(CognitoAuthService.getCurrentUserToken).mockRejectedValue(
        new Error('Auth service unavailable')
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // Act
      const result = await service.generateMessage(mockRequest);

      // Assert
      expect(result).toBe(mockSuccessResponse.generatedMessage);
      // Should still make the request without auth token
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should format request payload correctly', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // Act
      await service.generateMessage(mockRequest);

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody).toEqual({
        connectionId: 'test-connection-id',
        connectionProfile: {
          firstName: 'John',
          lastName: 'Doe',
          position: 'Software Engineer',
          company: 'Tech Corp',
          headline: 'Passionate about technology',
          tags: ['javascript', 'react'],
        },
        conversationTopic: 'Discussing new React features',
        messageHistory: [
          {
            id: 'msg-1',
            content: 'Hello John!',
            timestamp: '2024-01-01T10:00:00Z',
            sender: 'user',
          },
        ],
        userProfile: {
          firstName: 'Jane',
          lastName: 'Smith',
          headline: 'Product Manager',
          company: 'My Company',
          position: 'Senior PM',
          industry: 'Technology',
          interests: ['product', 'technology'],
        },
      });
    });

    it('should handle request without optional fields', async () => {
      // Arrange
      const minimalRequest: MessageGenerationRequest = {
        connectionId: 'test-connection-id',
        connectionProfile: {
          firstName: 'John',
          lastName: 'Doe',
          position: 'Software Engineer',
          company: 'Tech Corp',
        },
        conversationTopic: 'Hello there',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // Act
      const result = await service.generateMessage(minimalRequest);

      // Assert
      expect(result).toBe(mockSuccessResponse.generatedMessage);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody.connectionProfile.tags).toEqual([]);
      expect(requestBody.messageHistory).toEqual([]);
      expect(requestBody.userProfile).toBeUndefined();
    });
  });

  describe('generateBatchMessages', () => {
    const mockRequests: MessageGenerationRequest[] = [
      {
        ...mockRequest,
        connectionId: 'connection-1',
        connectionProfile: { ...mockRequest.connectionProfile, firstName: 'John' },
      },
      {
        ...mockRequest,
        connectionId: 'connection-2',
        connectionProfile: { ...mockRequest.connectionProfile, firstName: 'Jane' },
      },
    ];

    it('should successfully generate messages for multiple connections', async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ generatedMessage: 'Message for John', confidence: 0.8 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ generatedMessage: 'Message for Jane', confidence: 0.9 }),
        });

      // Act
      const results = await service.generateBatchMessages(mockRequests);

      // Assert
      expect(results.size).toBe(2);
      expect(results.get('connection-1')).toBe('Message for John');
      expect(results.get('connection-2')).toBe('Message for Jane');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch generation', async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ generatedMessage: 'Message for John', confidence: 0.8 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        });

      // Act
      const results = await service.generateBatchMessages(mockRequests);

      // Assert
      expect(results.size).toBe(1);
      expect(results.get('connection-1')).toBe('Message for John');
      expect(results.has('connection-2')).toBe(false);
    });

    it('should throw error when all batch requests fail', async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ message: 'Server error' }),
        });

      // Act & Assert
      await expect(service.generateBatchMessages(mockRequests)).rejects.toThrow(
        new MessageGenerationError({
          message: 'Batch generation failed: Server error',
          code: 'BATCH_GENERATION_FAILED',
        })
      );
    });

    it('should handle empty batch requests', async () => {
      // Act
      const results = await service.generateBatchMessages([]);

      // Assert
      expect(results.size).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('MessageGenerationError', () => {
    it('should create error with all properties', () => {
      // Act
      const error = new MessageGenerationError({
        message: 'Test error',
        status: 400,
        code: 'TEST_ERROR',
      });

      // Assert
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('MessageGenerationError');
      expect(error instanceof Error).toBe(true);
    });

    it('should create error with minimal properties', () => {
      // Act
      const error = new MessageGenerationError({
        message: 'Simple error',
      });

      // Assert
      expect(error.message).toBe('Simple error');
      expect(error.status).toBeUndefined();
      expect(error.code).toBeUndefined();
      expect(error.name).toBe('MessageGenerationError');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(messageGenerationService).toBeInstanceOf(MessageGenerationService);
    });

    it('should use the same instance across imports', () => {
      const instance1 = messageGenerationService;
      const instance2 = messageGenerationService;
      expect(instance1).toBe(instance2);
    });
  });
});