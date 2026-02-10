/**
 * Unit tests for RAGStack Search Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create the mock before hoisting
const { mockPost } = vi.hoisted(() => {
  return { mockPost: vi.fn() };
});

// Mock axios before importing the service
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        post: mockPost,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
    },
  };
});

// Mock Cognito auth service
vi.mock('@/features/auth', () => ({
  CognitoAuthService: {
    getCurrentUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  },
}));

// Import after mocks are set up
import { searchProfiles, SearchError } from './ragstackSearchService';

describe('ragstackSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchProfiles', () => {
    it('should return profile IDs from search', async () => {
      mockPost.mockResolvedValue({
        data: {
          statusCode: 200,
          body: JSON.stringify({
            results: [
              { source: 'profile_abc123', score: 0.95, content: 'John Doe software engineer' },
              { source: 'profile_def456', score: 0.85, content: 'Jane Smith product manager' },
            ],
            totalResults: 2,
          }),
        },
      });

      const response = await searchProfiles('software engineer');

      expect(response.results[0].profileId).toBe('abc123');
      expect(response.results[1].profileId).toBe('def456');
      expect(response.totalResults).toBe(2);
    });

    it('should handle direct API response format', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [{ source: 'profile_xyz789', score: 0.9, content: 'Test content' }],
          totalResults: 1,
        },
      });

      const response = await searchProfiles('test query');

      expect(response.results[0].profileId).toBe('xyz789');
      expect(response.results[0].score).toBe(0.9);
      expect(response.totalResults).toBe(1);
    });

    it('should handle empty results', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [],
          totalResults: 0,
        },
      });

      const response = await searchProfiles('nonexistent person');

      expect(response.results).toEqual([]);
      expect(response.totalResults).toBe(0);
    });

    it('should pass maxResults parameter', async () => {
      mockPost.mockResolvedValue({
        data: { results: [], totalResults: 0 },
      });

      await searchProfiles('test', 50);

      expect(mockPost).toHaveBeenCalledWith(
        'ragstack',
        expect.objectContaining({
          operation: 'search',
          query: 'test',
          maxResults: 50,
        }),
        expect.any(Object)
      );
    });

    it('should use default maxResults of 100', async () => {
      mockPost.mockResolvedValue({
        data: { results: [], totalResults: 0 },
      });

      await searchProfiles('test');

      expect(mockPost).toHaveBeenCalledWith(
        'ragstack',
        expect.objectContaining({
          maxResults: 100,
        }),
        expect.any(Object)
      );
    });

    it('should throw SearchError on network error', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(searchProfiles('test')).rejects.toThrow(SearchError);
    });

    it('should throw SearchError on HTTP error', async () => {
      mockPost.mockResolvedValue({
        data: {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        },
      });

      await expect(searchProfiles('test')).rejects.toThrow(SearchError);
    });

    it('should extract snippet from content', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [{ source: 'profile_abc', score: 0.9, content: 'This is a test snippet' }],
          totalResults: 1,
        },
      });

      const response = await searchProfiles('test');

      expect(response.results[0].snippet).toBe('This is a test snippet');
    });

    it('should handle malformed source field gracefully', async () => {
      mockPost.mockResolvedValue({
        data: {
          results: [{ source: 'malformed', score: 0.9, content: 'Content' }],
          totalResults: 1,
        },
      });

      const response = await searchProfiles('test');

      expect(response.results[0].profileId).toBe('malformed');
    });
  });
});
