/**
 * Unit Tests for lambdaApiService Search Functionality
 * Phase 5 Task 5: Update Frontend Tests
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AxiosInstance } from 'axios';

// Create mock axios instance
const mockAxiosInstance: Partial<AxiosInstance> = {
  post: vi.fn(),
  get: vi.fn(),
  interceptors: {
    request: {
      use: vi.fn((successHandler) => {
        // Store the interceptor for later use if needed
        return 0;
      }),
      eject: vi.fn(),
    },
    response: { use: vi.fn(), eject: vi.fn() },
  } as any,
};

// Mock axios before importing lambdaApiService
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

// Mock Cognito service
vi.mock('@/services/cognitoService', () => ({
  CognitoAuthService: {
    getCurrentUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  },
}));

// Import after mocks are set up
const { lambdaApiService } = await import('@/services/lambdaApiService');

describe('lambdaApiService - Search Functionality', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('searchProfiles', () => {
    it('should call search API endpoint with correct parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Search functionality is currently unavailable',
          results: [],
          total: 0,
          metadata: {
            search_id: 'search-123',
            status: 'placeholder',
            userId: 'user-123',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await lambdaApiService.searchProfiles('software engineer');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('search', {
        query: 'software engineer',
        filters: undefined,
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.message).toBe('Search functionality is currently unavailable');
    });

    it('should handle search with filters', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Placeholder response',
          results: [],
          total: 0,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const filters = {
        location: 'San Francisco',
        company: 'TechCorp',
      };

      await lambdaApiService.searchProfiles('engineer', filters, 20, 10);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('search', {
        query: 'engineer',
        filters,
        limit: 20,
        offset: 10,
      });
    });

    it('should handle Lambda proxy response format', async () => {
      const mockResponse = {
        data: {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Placeholder response',
            results: [],
            total: 0,
          }),
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await lambdaApiService.searchProfiles('test');

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should handle search API errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await lambdaApiService.searchProfiles('test');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle 400 error (invalid query)', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { error: 'query is required' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await lambdaApiService.searchProfiles('');

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(result.results).toEqual([]);
    });

    it('should handle 401 error (authentication failure)', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await lambdaApiService.searchProfiles('test');

      expect(result.success).toBe(false);
      expect(result.results).toEqual([]);
    });

    it('should handle 500 error (server error)', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      const result = await lambdaApiService.searchProfiles('test');

      expect(result.success).toBe(false);
      expect(result.results).toEqual([]);
    });

    it('should use default limit and offset when not provided', async () => {
      const mockResponse = {
        data: {
          success: true,
          results: [],
          total: 0,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await lambdaApiService.searchProfiles('test');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('search', {
        query: 'test',
        filters: undefined,
        limit: 10,
        offset: 0,
      });
    });

    it('should return empty results for placeholder response', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Search functionality is currently unavailable',
          results: [],
          total: 0,
          metadata: {
            status: 'placeholder',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await lambdaApiService.searchProfiles('software engineer');

      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.metadata?.status).toBe('placeholder');
    });

    it('should include search metadata in response', async () => {
      const mockResponse = {
        data: {
          success: true,
          results: [],
          total: 0,
          metadata: {
            search_id: 'search-456',
            status: 'placeholder',
            userId: 'user-789',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await lambdaApiService.searchProfiles('test');

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.search_id).toBe('search-456');
      expect(result.metadata?.userId).toBe('user-789');
    });
  });
});
