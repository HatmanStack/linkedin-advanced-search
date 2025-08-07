import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageGenerationService, MessageGenerationError } from '../messageGenerationService';
import type { MessageGenerationRequest } from '../messageGenerationService';
import { CognitoAuthService } from '../cognitoService';

// Mock the CognitoAuthService
vi.mock('../cognitoService', () => ({
  CognitoAuthService: {
    getCurrentUserToken: vi.fn(),
  },
}));

describe('MessageGenerationService - Task 10 Core Functionality', () => {
  let service: MessageGenerationService;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockRequest: MessageGenerationRequest = {
    connectionId: 'conn-123',
    connectionProfile: {
      firstName: 'John',
      lastName: 'Doe',
      position: 'Software Engineer',
      company: 'Tech Corp',
      headline: 'Passionate about technology',
      tags: ['tech', 'innovation'],
    },
    conversationTopic: 'AI and machine learning trends',
    messageHistory: [],
    userProfile: {
      id: 'user-123',
      first_name: 'Jane',
      last_name: 'Smith',
      headline: 'Product Manager',
      company: 'StartupCo',
      current_position: 'Senior PM',
      industry: 'Technology',
      interests: ['AI', 'product development'],
    },
  };

  beforeEach(() => {
    service = new MessageGenerationService();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock successful auth token
    vi.mocked(CognitoAuthService.getCurrentUserToken).mockResolvedValue('mock-jwt-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Request Formatting', () => {
    it('should format request payload correctly', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          generatedMessage: 'Test message',
          confidence: 0.9,
        }),
      });

      await service.generateMessage(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/generate-message'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
          }),
          body: expect.stringContaining('"connectionId":"conn-123"'),
        })
      );

      // Verify the request body structure
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody).toEqual({
        connectionId: 'conn-123',
        connectionProfile: {
          firstName: 'John',
          lastName: 'Doe',
          position: 'Software Engineer',
          company: 'Tech Corp',
          headline: 'Passionate about technology',
          tags: ['tech', 'innovation'],
        },
        conversationTopic: 'AI and machine learning trends',
        messageHistory: [],
        userProfile: {
          firstName: 'Jane',
          lastName: 'Smith',
          headline: 'Product Manager',
          company: 'StartupCo',
          position: 'Senior PM',
          industry: 'Technology',
          interests: ['AI', 'product development'],
        },
      });
    });

    it('should handle missing userProfile gracefully', async () => {
      const requestWithoutProfile = { ...mockRequest, userProfile: undefined };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          generatedMessage: 'Test message',
          confidence: 0.9,
        }),
      });

      await service.generateMessage(requestWithoutProfile);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      
      expect(requestBody.userProfile).toBeUndefined();
    });
  });

  describe('Authentication Headers', () => {
    it('should include JWT token in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          generatedMessage: 'Test message',
          confidence: 0.9,
        }),
      });

      await service.generateMessage(mockRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-jwt-token',
          }),
        })
      );
    });

    it('should handle missing JWT token', async () => {
      vi.mocked(CognitoAuthService.getCurrentUserToken).mockResolvedValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          generatedMessage: 'Test message',
          confidence: 0.9,
        }),
      });

      await service.generateMessage(mockRequest);

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Response Parsing', () => {
    it('should parse successful API response', async () => {
      const mockResponse = {
        generatedMessage: 'Hello John, I noticed your work at Tech Corp...',
        confidence: 0.85,
        reasoning: 'Generated based on professional context',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.generateMessage(mockRequest);

      expect(result).toBe(mockResponse.generatedMessage);
    });

    it('should throw error for invalid response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // Missing generatedMessage
      });

      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        MessageGenerationError
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP 400 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          message: 'Invalid request data',
          code: 'BAD_REQUEST',
        }),
      });

      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Invalid request data',
          status: 400,
          code: 'BAD_REQUEST',
        })
      );
    });

    it('should handle HTTP 401 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          message: 'Unauthorized',
          code: 'UNAUTHORIZED',
        }),
      });

      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          status: 401,
        })
      );
    });

    it('should handle network timeout', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(service.generateMessage(mockRequest)).rejects.toThrow(
        expect.objectContaining({
          code: 'TIMEOUT',
        })
      );
    });
  });

  describe('Request Validation', () => {
    it('should validate required connectionId', async () => {
      const invalidRequest = { ...mockRequest, connectionId: '' };

      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Connection ID is required',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should validate required conversationTopic', async () => {
      const invalidRequest = { ...mockRequest, conversationTopic: '' };

      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Conversation topic is required',
          code: 'INVALID_REQUEST',
        })
      );
    });

    it('should validate required connectionProfile fields', async () => {
      const invalidRequest = {
        ...mockRequest,
        connectionProfile: {
          ...mockRequest.connectionProfile,
          firstName: '',
        },
      };

      await expect(service.generateMessage(invalidRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Connection profile must include firstName, lastName, position, and company',
          code: 'INVALID_REQUEST',
        })
      );
    });
  });

  // Note: Mock mode functionality is implemented but not tested here
  // to focus on core API integration functionality
});
