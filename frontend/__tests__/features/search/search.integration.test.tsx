import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, renderHook } from '@testing-library/react';
import type { SearchFormData } from '@/shared/utils/validation';

const mockPerformLinkedInSearch = vi.fn();
const mockMarkChanged = vi.fn();

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    performLinkedInSearch: (...args: unknown[]) => mockPerformLinkedInSearch(...args),
  },
}));

vi.mock('@/features/connections', () => ({
  connectionChangeTracker: {
    markChanged: (...args: unknown[]) => mockMarkChanged(...args),
  },
}));

vi.mock('@/config/appConfig', () => ({
  STORAGE_KEYS: {
    SEARCH_RESULTS: 'test_search_results',
    VISITED_LINKS: 'test_visited_links',
  },
}));

import useSearchResults from '@/features/search/hooks/useSearchResults';

describe('Search Flow Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockPerformLinkedInSearch.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Complete Search Workflow', () => {
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

    it('executes full search workflow: initiate -> loading -> complete', async () => {
      let resolveSearch: (value: unknown) => void = () => {};
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });

      mockPerformLinkedInSearch.mockReturnValue(searchPromise);

      const { result } = renderHook(() => useSearchResults());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      act(() => {
        result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveSearch({ success: true, message: 'Found 10 profiles', data: [] });
        await searchPromise;
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.infoMessage).toBe('Found 10 profiles');
      });
    });

    it('handles search error in workflow', async () => {
      mockPerformLinkedInSearch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        try {
          await result.current.searchLinkedIn(mockSearchData);
        } catch {
          // expected
        }
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
    });

    it('tracks visited profiles through workflow', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({
        success: true,
        message: 'Found 3 profiles',
        data: [
          { id: 'profile-1' },
          { id: 'profile-2' },
          { id: 'profile-3' },
        ],
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      act(() => {
        result.current.markAsVisited('profile-1');
      });

      await waitFor(() => {
        expect(result.current.visitedLinks['profile-1']).toBe(true);
        expect(result.current.visitedLinks['profile-2']).toBeUndefined();
      });

      act(() => {
        result.current.markAsVisited('profile-2');
      });

      await waitFor(() => {
        expect(result.current.visitedLinks['profile-1']).toBe(true);
        expect(result.current.visitedLinks['profile-2']).toBe(true);
      });
    });

    it('clears results and starts fresh search', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({
        success: true,
        message: 'First search',
        data: [],
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.infoMessage).toBe('First search');

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.results).toEqual([]);

      mockPerformLinkedInSearch.mockResolvedValue({
        success: true,
        message: 'Second search',
        data: [],
      });

      await act(async () => {
        await result.current.searchLinkedIn({
          ...mockSearchData,
          searchQuery: 'product manager',
        });
      });

      expect(result.current.infoMessage).toBe('Second search');
    });

    it('notifies connection tracker on successful search', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({
        success: true,
        message: 'Search complete',
        data: [],
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(mockMarkChanged).toHaveBeenCalledWith('search');
    });
  });

  describe('State Persistence Across Sessions', () => {
    it('persists visited links to localStorage', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });

      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('persistent-profile');
      });

      await waitFor(() => {
        const stored = localStorage.getItem('test_visited_links');
        expect(stored).toBeTruthy();
        expect(JSON.parse(stored!)).toHaveProperty('persistent-profile', true);
      });
    });

    it('restores visited links from localStorage on mount', async () => {
      localStorage.setItem(
        'test_visited_links',
        JSON.stringify({
          'previously-visited-1': true,
          'previously-visited-2': true,
        })
      );

      const { result } = renderHook(() => useSearchResults());

      await waitFor(() => {
        expect(result.current.visitedLinks['previously-visited-1']).toBe(true);
        expect(result.current.visitedLinks['previously-visited-2']).toBe(true);
      });
    });

    it('clears all visited links while preserving search results', async () => {
      localStorage.setItem('test_search_results', JSON.stringify(['result-1', 'result-2']));
      localStorage.setItem(
        'test_visited_links',
        JSON.stringify({ 'link-1': true, 'link-2': true })
      );

      const { result } = renderHook(() => useSearchResults());

      await waitFor(() => {
        expect(result.current.visitedLinks['link-1']).toBe(true);
      });

      act(() => {
        result.current.clearVisitedLinks();
      });

      await waitFor(() => {
        expect(result.current.visitedLinks).toEqual({});
        expect(result.current.results).toEqual(['result-1', 'result-2']);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('handles rapid successive searches', async () => {
      let callCount = 0;
      mockPerformLinkedInSearch.mockImplementation(() => {
        callCount++;
        const currentCall = callCount;
        return Promise.resolve({
          success: true,
          message: `Search ${currentCall}`,
          data: [],
        });
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        const promises = [
          result.current.searchLinkedIn({ ...mockSearchData, searchQuery: 'first' }),
          result.current.searchLinkedIn({ ...mockSearchData, searchQuery: 'second' }),
        ];
        await Promise.all(promises);
      });

      expect(mockPerformLinkedInSearch).toHaveBeenCalledTimes(2);
    });

    it('handles multiple markAsVisited calls', async () => {
      const { result } = renderHook(() => useSearchResults());

      act(() => {
        result.current.markAsVisited('profile-a');
      });

      act(() => {
        result.current.markAsVisited('profile-b');
      });

      act(() => {
        result.current.markAsVisited('profile-c');
      });

      await waitFor(() => {
        expect(result.current.visitedLinks['profile-a']).toBe(true);
        expect(result.current.visitedLinks['profile-b']).toBe(true);
        expect(result.current.visitedLinks['profile-c']).toBe(true);
      });
    });
  });

  describe('Error Recovery', () => {
    it('recovers from error state with successful search', async () => {
      mockPerformLinkedInSearch.mockRejectedValueOnce(new Error('First attempt failed'));
      mockPerformLinkedInSearch.mockResolvedValueOnce({
        success: true,
        message: 'Recovery successful',
        data: [],
      });

      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        try {
          await result.current.searchLinkedIn(mockSearchData);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe('First attempt failed');

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.infoMessage).toBe('Recovery successful');
    });

    it('handles sessionStorage errors gracefully', async () => {
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = () => {
        throw new Error('Storage error');
      };

      // Should not throw
      mockPerformLinkedInSearch.mockResolvedValue({ success: true, data: [] });
      const { result } = renderHook(() => useSearchResults());

      await act(async () => {
        await result.current.searchLinkedIn(mockSearchData);
      });

      expect(result.current.loading).toBe(false);

      sessionStorage.getItem = originalGetItem;
    });
  });

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
});
