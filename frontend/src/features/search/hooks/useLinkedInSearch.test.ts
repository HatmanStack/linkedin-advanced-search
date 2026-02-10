import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLinkedInSearch } from './useLinkedInSearch';

// Mock dependencies
vi.mock('@/shared/hooks', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/features/search', () => ({
  useSearchResults: vi.fn(() => ({
    loading: false,
    error: null,
    infoMessage: null,
    searchLinkedIn: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@/features/profile', () => ({
  useUserProfile: vi.fn(() => ({ ciphertext: 'sealbox_x25519:b64:testdata==' })),
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

import { useSearchResults } from '@/features/search';
import { useToast } from '@/shared/hooks';

describe('useLinkedInSearch', () => {
  const mockFetchConnections = vi.fn(() => Promise.resolve());
  const mockSearchLinkedIn = vi.fn(() => Promise.resolve());
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchConnections.mockResolvedValue(undefined);
    mockSearchLinkedIn.mockResolvedValue(undefined);
    vi.mocked(useSearchResults).mockReturnValue({
      loading: false,
      error: null,
      infoMessage: null,
      searchLinkedIn: mockSearchLinkedIn,
    } as unknown as ReturnType<typeof useSearchResults>);
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as unknown as ReturnType<
      typeof useToast
    >);
  });

  describe('initial state', () => {
    it('returns isSearchingLinkedIn as false', () => {
      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );
      expect(result.current.isSearchingLinkedIn).toBe(false);
    });

    it('returns search loading state from useSearchResults', () => {
      vi.mocked(useSearchResults).mockReturnValue({
        loading: true,
        error: null,
        infoMessage: null,
        searchLinkedIn: mockSearchLinkedIn,
      } as unknown as ReturnType<typeof useSearchResults>);

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );
      expect(result.current.searchLoading).toBe(true);
    });

    it('returns search error from useSearchResults', () => {
      vi.mocked(useSearchResults).mockReturnValue({
        loading: false,
        error: 'Search failed',
        infoMessage: null,
        searchLinkedIn: mockSearchLinkedIn,
      } as unknown as ReturnType<typeof useSearchResults>);

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );
      expect(result.current.searchError).toBe('Search failed');
    });

    it('returns info message from useSearchResults', () => {
      vi.mocked(useSearchResults).mockReturnValue({
        loading: false,
        error: null,
        infoMessage: 'Searching...',
        searchLinkedIn: mockSearchLinkedIn,
      } as unknown as ReturnType<typeof useSearchResults>);

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );
      expect(result.current.searchInfoMessage).toBe('Searching...');
    });
  });

  describe('handleLinkedInSearch', () => {
    it('sets isSearchingLinkedIn to true during search', async () => {
      let resolveSearch: () => void;
      mockSearchLinkedIn.mockImplementation(
        () =>
          new Promise((r) => {
            resolveSearch = r;
          })
      );

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );

      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.handleLinkedInSearch({
          company: 'Acme',
          job: 'Engineer',
          location: 'NYC',
          userId: 'user-1',
        });
      });

      expect(result.current.isSearchingLinkedIn).toBe(true);

      await act(async () => {
        resolveSearch!();
        await searchPromise!;
      });

      expect(result.current.isSearchingLinkedIn).toBe(false);
    });

    it('calls searchLinkedIn with formatted search data', async () => {
      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );

      await act(async () => {
        await result.current.handleLinkedInSearch({
          company: 'Google',
          job: 'PM',
          location: 'SF',
          userId: 'user-1',
        });
      });

      expect(mockSearchLinkedIn).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Google',
          companyRole: 'PM',
          companyLocation: 'SF',
          userId: 'user-1',
        })
      );
    });

    it('calls fetchConnections after search completes', async () => {
      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );

      await act(async () => {
        await result.current.handleLinkedInSearch({
          company: 'Acme',
          job: 'Dev',
          location: 'LA',
          userId: 'user-1',
        });
      });

      expect(mockFetchConnections).toHaveBeenCalled();
    });

    it('shows toast on search error', async () => {
      mockSearchLinkedIn.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );

      await act(async () => {
        await result.current.handleLinkedInSearch({
          company: 'Acme',
          job: 'Dev',
          location: 'LA',
          userId: 'user-1',
        });
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Search Failed',
          variant: 'destructive',
        })
      );
    });

    it('resets isSearchingLinkedIn after error', async () => {
      mockSearchLinkedIn.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() =>
        useLinkedInSearch({ fetchConnections: mockFetchConnections })
      );

      await act(async () => {
        await result.current.handleLinkedInSearch({
          company: 'Acme',
          job: 'Dev',
          location: 'LA',
          userId: 'user-1',
        });
      });

      expect(result.current.isSearchingLinkedIn).toBe(false);
    });
  });
});
