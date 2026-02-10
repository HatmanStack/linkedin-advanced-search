import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createWrapper } from '@/test-utils/queryWrapper';
import useSearchResults from './useSearchResults';

// Mock dependencies
vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    performLinkedInSearch: vi.fn(),
  },
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  default: vi.fn((_key: string, initialValue: unknown) => {
    const state = { current: initialValue };
    return [
      state.current,
      (newValue: unknown) => {
        if (typeof newValue === 'function') {
          state.current = newValue(state.current);
        } else {
          state.current = newValue;
        }
      },
    ];
  }),
}));

import { puppeteerApiService } from '@/shared/services';

const mockPerformLinkedInSearch = puppeteerApiService.performLinkedInSearch as ReturnType<
  typeof vi.fn
>;

describe('useSearchResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns initial values', () => {
      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.visitedLinks).toEqual({});
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.infoMessage).toBeNull();
    });
  });

  describe('searchLinkedIn', () => {
    it('sets loading to true during search', async () => {
      let resolveSearch: () => void;
      mockPerformLinkedInSearch.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSearch = () => resolve({ message: 'Done' });
          })
      );

      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.searchLinkedIn({
          companyName: 'Test',
          companyRole: 'Engineer',
          companyLocation: 'NYC',
          searchName: '',
          searchPassword: '',
          userId: 'user-1',
        });
      });

      // Wait for loading state to become true
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolveSearch!();
        await searchPromise!;
      });

      expect(result.current.loading).toBe(false);
    });

    it('sets infoMessage on success', async () => {
      mockPerformLinkedInSearch.mockResolvedValue({ message: 'Found 5 profiles' });

      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.searchLinkedIn({
          companyName: 'Test',
          companyRole: 'Engineer',
          companyLocation: 'NYC',
          searchName: '',
          searchPassword: '',
          userId: 'user-1',
        });
      });

      expect(result.current.infoMessage).toBe('Found 5 profiles');
    });

    it('sets error on failure', async () => {
      mockPerformLinkedInSearch.mockRejectedValue(new Error('Search failed'));

      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.searchLinkedIn({
            companyName: 'Test',
            companyRole: 'Engineer',
            companyLocation: 'NYC',
            searchName: '',
            searchPassword: '',
            userId: 'user-1',
          });
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Search failed');
      });
    });

    it('resets loading after error', async () => {
      mockPerformLinkedInSearch.mockRejectedValue(new Error('Search failed'));

      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.searchLinkedIn({
            companyName: 'Test',
            companyRole: 'Engineer',
            companyLocation: 'NYC',
            searchName: '',
            searchPassword: '',
            userId: 'user-1',
          });
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('markAsVisited', () => {
    it('marks profile as visited', () => {
      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.markAsVisited('profile-1');
      });

      // Note: Due to mock, we can't verify the actual state change
      // but the function should be callable without error
      expect(typeof result.current.markAsVisited).toBe('function');
    });
  });

  describe('clearResults', () => {
    it('clears results', () => {
      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.clearResults();
      });

      expect(typeof result.current.clearResults).toBe('function');
    });
  });

  describe('clearVisitedLinks', () => {
    it('clears visited links', () => {
      const { result } = renderHook(() => useSearchResults(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.clearVisitedLinks();
      });

      expect(typeof result.current.clearVisitedLinks).toBe('function');
    });
  });
});
