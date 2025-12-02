import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock modules
const mockGetDrafts = vi.fn();
const mockCreateDraft = vi.fn();
const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUseAuth = vi.fn(() => ({ user: mockUser, isLoading: false }));

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    getDrafts: () => mockGetDrafts(),
    createDraft: (...args: unknown[]) => mockCreateDraft(...args),
  },
}));

import { useDrafts } from '@/features/posts/hooks/useDrafts';

describe('useDrafts', () => {
  beforeEach(() => {
    mockGetDrafts.mockReset();
    mockCreateDraft.mockReset();
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });

    // Default successful response
    mockGetDrafts.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading true', async () => {
      const { result } = renderHook(() => useDrafts());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('starts with empty drafts array', async () => {
      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.drafts).toEqual([]);
    });

    it('starts with null error', async () => {
      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('fetching drafts', () => {
    it('fetches drafts on mount', async () => {
      const mockDrafts = [
        { id: 'draft-1', content: 'Draft 1' },
        { id: 'draft-2', content: 'Draft 2' },
      ];

      mockGetDrafts.mockResolvedValueOnce({
        success: true,
        data: mockDrafts,
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetDrafts).toHaveBeenCalled();
      expect(result.current.drafts).toHaveLength(2);
    });

    it('sets error on failed fetch', async () => {
      mockGetDrafts.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.drafts).toEqual([]);
    });

    it('handles missing error message in response', async () => {
      mockGetDrafts.mockResolvedValueOnce({
        success: false,
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch drafts');
    });

    it('handles network errors', async () => {
      mockGetDrafts.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.drafts).toEqual([]);
    });

    it('handles non-Error thrown values', async () => {
      mockGetDrafts.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });

  describe('refetch', () => {
    it('provides refetch function', async () => {
      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers new API call', async () => {
      mockGetDrafts.mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockGetDrafts.mockClear();

      mockGetDrafts.mockResolvedValueOnce({
        success: true,
        data: [{ id: 'new-draft', content: 'New draft' }],
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetDrafts).toHaveBeenCalledTimes(1);
      expect(result.current.drafts).toHaveLength(1);
    });
  });

  describe('createDraft', () => {
    it('creates a draft and adds to list', async () => {
      const newDraft = { id: 'new-draft', content: 'New draft content' };

      mockGetDrafts.mockResolvedValueOnce({
        success: true,
        data: [],
      });

      mockCreateDraft.mockResolvedValueOnce({
        success: true,
        data: newDraft,
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createDraft({ content: 'New draft content' });
      });

      expect(success).toBe(true);
      expect(result.current.drafts).toHaveLength(1);
    });

    it('returns false on create failure', async () => {
      mockGetDrafts.mockResolvedValueOnce({
        success: true,
        data: [],
      });

      mockCreateDraft.mockResolvedValueOnce({
        success: false,
        error: 'Create failed',
      });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createDraft({ content: 'New draft content' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Create failed');
    });

    it('handles create network error', async () => {
      mockGetDrafts.mockResolvedValueOnce({
        success: true,
        data: [],
      });

      mockCreateDraft.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createDraft({ content: 'New draft content' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('no user', () => {
    it('returns empty drafts when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useDrafts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.drafts).toEqual([]);
      expect(mockGetDrafts).not.toHaveBeenCalled();
    });
  });
});
