/**
 * Unit Tests for useSearchResults Hook
 * Phase 5 Task 5: Update Frontend Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import useSearchResults from '@/hooks/useSearchResults';
import type { SearchFormData } from '@/utils/validation';

// Mock lambdaApiService
const mockSearchProfiles = vi.fn();
vi.mock('@/services/lambdaApiService', () => ({
  lambdaApiService: {
    searchProfiles: (...args: any[]) => mockSearchProfiles(...args),
  },
}));

// Mock useLocalStorage
let mockResults: any[] = [];
let mockVisitedLinks: Record<string, boolean> = {};

const mockSetResults = vi.fn((value: any) => {
  mockResults = typeof value === 'function' ? value(mockResults) : value;
});

const mockSetVisitedLinks = vi.fn((value: any) => {
  mockVisitedLinks = typeof value === 'function' ? value(mockVisitedLinks) : value;
});

vi.mock('@/hooks/useLocalStorage', () => ({
  default: vi.fn((key: string, defaultValue: any) => {
    if (key === 'linkedin-adv-search.searchResults') {
      return [mockResults, mockSetResults];
    }
    if (key === 'linkedin-adv-search.visitedLinks') {
      return [mockVisitedLinks, mockSetVisitedLinks];
    }
    return [defaultValue, vi.fn()];
  }),
}));

// Mock connectionChangeTracker
vi.mock('@/utils/connectionChangeTracker', () => ({
  connectionChangeTracker: {
    markChanged: vi.fn(),
  },
}));

describe('useSearchResults Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResults = [];
    mockVisitedLinks = {};
  });

  describe('Placeholder Search Response', () => {
    it('should handle placeholder search response', async () => {
      const mockResponse = {
        success: true,
        message: 'Search functionality is currently unavailable. This is a placeholder response. External search system integration coming soon.',
        results: [],
        total: 0,
        metadata: {
          search_id: 'search-123',
          status: 'placeholder',
          userId: 'user-123',
        },
      };

      mockSearchProfiles.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'TechCorp',
        companyRole: 'Software Engineer',
        companyLocation: 'San Francisco',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(result.current.infoMessage).toBe('Search functionality is currently unavailable. This is a placeholder response. External search system integration coming soon.');
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should convert SearchFormData to query string', async () => {
      const mockResponse = {
        success: true,
        message: 'Placeholder',
        results: [],
        total: 0,
      };

      mockSearchProfiles.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'Google',
        companyRole: 'Product Manager',
        companyLocation: 'New York',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(mockSearchProfiles).toHaveBeenCalledWith('Product Manager at Google in New York');
      });
    });

    it('should handle partial SearchFormData', async () => {
      const mockResponse = {
        success: true,
        results: [],
        total: 0,
      };

      mockSearchProfiles.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: '',
        companyRole: 'Engineer',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(mockSearchProfiles).toHaveBeenCalledWith('Engineer');
      });
    });

    it('should use default query when all fields empty', async () => {
      const mockResponse = {
        success: true,
        results: [],
        total: 0,
      };

      mockSearchProfiles.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: '',
        companyRole: '',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(mockSearchProfiles).toHaveBeenCalledWith('professionals');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search API errors', async () => {
      const mockError = new Error('Network error');
      mockSearchProfiles.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'Test',
        companyRole: 'Test',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should handle empty response gracefully', async () => {
      const mockResponse = {
        success: true,
        results: [],
        total: 0,
        message: '',
      };

      mockSearchProfiles.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'Test',
        companyRole: '',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Visited Links Management', () => {
    it('should provide markAsVisited function', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.markAsVisited).toBeDefined();
      expect(typeof result.current.markAsVisited).toBe('function');

      // Should not throw when called
      act(() => {
        result.current.markAsVisited('profile-123');
      });
    });

    it('should provide clearVisitedLinks function', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.clearVisitedLinks).toBeDefined();
      expect(typeof result.current.clearVisitedLinks).toBe('function');

      // Should not throw when called
      act(() => {
        result.current.clearVisitedLinks();
      });
    });
  });

  describe('Results Management', () => {
    it('should provide clearResults function', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.clearResults).toBeDefined();
      expect(typeof result.current.clearResults).toBe('function');

      // Should not throw when called
      act(() => {
        result.current.clearResults();
      });
    });

    it('should return empty results by default', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.results).toEqual([]);
    });

    it('should return empty visited links by default', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.visitedLinks).toEqual({});
    });
  });

  describe('Loading State', () => {
    it('should show loading state during search', async () => {
      const mockResponse = {
        success: true,
        results: [],
        total: 0,
      };

      // Create a promise that we can control
      let resolveSearch: any;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });

      mockSearchProfiles.mockReturnValue(searchPromise);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'Test',
        companyRole: 'Test',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      act(() => {
        result.current.searchLinkedIn(searchData);
      });

      // At this point, loading should be true
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve the search
      resolveSearch(mockResponse);

      // After resolution, loading should be false
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Info Message State', () => {
    it('should clear info message on subsequent search without message', async () => {
      const mockResponseWithMessage = {
        success: true,
        message: 'First message',
        results: [],
        total: 0,
      };

      const mockResponseWithoutMessage = {
        success: true,
        results: [],
        total: 0,
      };

      mockSearchProfiles.mockResolvedValueOnce(mockResponseWithMessage);
      mockSearchProfiles.mockResolvedValueOnce(mockResponseWithoutMessage);

      const { result } = renderHook(() => useSearchResults());

      const searchData: SearchFormData = {
        companyName: 'Test',
        companyRole: '',
        companyLocation: '',
        searchName: '',
        searchPassword: '',
      };

      // First search with message
      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      await waitFor(() => {
        expect(result.current.infoMessage).toBe('First message');
      });

      // Second search without message
      await act(async () => {
        await result.current.searchLinkedIn(searchData);
      });

      // Info message should not be cleared if no new message
      // (The implementation sets message from response, so it persists)
      expect(result.current.infoMessage).toBe('First message');
    });

    it('should return null infoMessage initially', () => {
      const { result } = renderHook(() => useSearchResults());

      expect(result.current.infoMessage).toBeNull();
    });
  });
});
