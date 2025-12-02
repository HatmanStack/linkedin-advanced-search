import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { SearchFormData } from '@/shared/utils/validation';

const mockPerformLinkedInSearch = vi.fn();

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    performLinkedInSearch: (...args: unknown[]) => mockPerformLinkedInSearch(...args),
  },
}));

vi.mock('@/config/appConfig', () => ({
  STORAGE_KEYS: {
    SEARCH_RESULTS: 'test_search_results',
    VISITED_LINKS: 'test_visited_links',
  },
}));

const mockMarkChanged = vi.fn();
vi.mock('@/features/connections', () => ({
  connectionChangeTracker: {
    markChanged: (...args: unknown[]) => mockMarkChanged(...args),
  },
}));

import useSearchResults from '@/features/search/hooks/useSearchResults';

describe('useSearchResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPerformLinkedInSearch.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('returns empty results array', () => {
      const { result } = renderHook(() => useSearchResults());
      expect(result.current.results).toEqual([]);
    });

    it('returns empty visited links object', () => {
      const { result } = renderHook(() => useSearchResults());
      expect(result.current.visitedLinks).toEqual({});
    });

    it('returns loading as false', () => {
      const { result } = renderHook(() => useSearchResults());
      expect(result.current.loading).toBe(false);
    });

    it('returns error as null', () => {
      const { result } = renderHook(() => useSearchResults());
      expect(result.current.error).toBeNull();
    });

    it('returns infoMessage as null', () => {
      const { result } = renderHook(() => useSearchResults());
      expect(result.current.infoMessage).toBeNull();
    });
  });

  describe('searchLinkedIn', () => {
    const mockSearchData: SearchFormData = {
      searchQuery: 'software engineer',
      location: 'San Francisco',
      company: 'Tech Corp',
      title: 'Senior Engineer',
      keywords: '',
      school: '',
      pastCompany: '',
      firstName: '',
      lastName: '',
      industry: '',
      sortBy: 'relevance',
    };

    it('sets loading to true during search', async () => {
      mockPerformLinkedInSearch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.loading).toBe(true);
    });

    it('calls puppeteerApiService.performLinkedInSearch with search data', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(mockPerformLinkedInSearch).toHaveBeenCalledWith(mockSearchData);
    });

    it('sets info message from response', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({
        success: true,
        message: 'Found 5 results',
        data: [],
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.infoMessage).toBe('Found 5 results');
    });

    it('marks connection as changed after successful search', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(mockMarkChanged).toHaveBeenCalledWith('search');
    });

    it('sets loading to false after search completes', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.loading).toBe(false);
    });

    it('throws error on search failure', async () => {
      mockPerformLinkedInSearch.mockRejectedValue(new Error('Search API error'));

      const { result } = renderHook(() => useSearchResults());

      await expect(
        act(async () => {
          await result.current.searchLinkedIn(mockSearchData);
        })
      ).rejects.toThrow('Search API error');

      expect(result.current.loading).toBe(false);
    });

    it('sets error state on search failure', async () => {
      const error = new Error('Search API error');
      mockPerformLinkedInSearch.mockRejectedValue(error);

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        try {
          await result.current.searchLinkedIn(mockSearchData);
        } catch {
          // Error is expected and rethrown by hook
        }
      });

      expect(result.current.error).toBe('Search API error');
    });

    it('clears error state on new search attempt', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('markAsVisited', () => {
    it('marks a profile as visited', () => {
      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('profile-123');
      });

      expect(result.current.visitedLinks['profile-123']).toBe(true);
    });

    it('preserves existing visited links when marking new ones', () => {
      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('profile-1');
      });

      act(() => {
        result.current.markAsVisited('profile-2');
      });

      expect(result.current.visitedLinks['profile-1']).toBe(true);
      expect(result.current.visitedLinks['profile-2']).toBe(true);
    });

    it('persists visited links to localStorage', () => {
      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('profile-123');
      });

      const stored = localStorage.getItem('test_visited_links');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toHaveProperty('profile-123', true);
    });
  });

  describe('clearResults', () => {
    it('clears search results', () => {
      localStorage.setItem('test_search_results', JSON.stringify(['result1', 'result2']));

      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.results).toEqual([]);
    });
  });

  describe('clearVisitedLinks', () => {
    it('clears visited links', async () => {
      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('profile-1');
      });

      await waitFor(() => {
        expect(result.current.visitedLinks['profile-1']).toBe(true);
      });

      act(() => {
        result.current.markAsVisited('profile-2');
      });

      await waitFor(() => {
        expect(result.current.visitedLinks['profile-2']).toBe(true);
      });

      act(() => {
        result.current.clearVisitedLinks();
      });

      await waitFor(() => {
        expect(result.current.visitedLinks).toEqual({});
      });
    });
  });

  describe('State Persistence', () => {
    it('restores results from localStorage on mount', async () => {
      localStorage.setItem('test_search_results', JSON.stringify(['profile-1', 'profile-2']));

      const { result } = renderHook(() => useSearchResults());

      await waitFor(() => {
        expect(result.current.results).toEqual(['profile-1', 'profile-2']);
      });
    });

    it('restores visited links from localStorage on mount', async () => {
      localStorage.setItem(
        'test_visited_links',
        JSON.stringify({ 'profile-1': true, 'profile-2': true })
      );

      const { result } = renderHook(() => useSearchResults());

      await waitFor(() => {
        expect(result.current.visitedLinks).toEqual({
          'profile-1': true,
          'profile-2': true,
        });
      });
    });
  });
});
