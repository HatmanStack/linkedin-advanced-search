import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock modules
const mockGetMessages = vi.fn();
const mockCreateMessage = vi.fn();
const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUseAuth = vi.fn(() => ({ user: mockUser, isLoading: false }));

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  },
}));

import { useMessages } from '@/features/messages/hooks/useMessages';
import { createMockMessage, resetFactoryCounters } from '../../utils/mockFactories';

describe('useMessages', () => {
  beforeEach(() => {
    resetFactoryCounters();
    mockGetMessages.mockReset();
    mockCreateMessage.mockReset();
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });

    // Default successful response
    mockGetMessages.mockResolvedValue({
      success: true,
      data: { messages: [] },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with loading true', async () => {
      const { result } = renderHook(() => useMessages());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('starts with empty messages array', async () => {
      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
    });

    it('starts with null error', async () => {
      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('fetching messages', () => {
    it('fetches messages on mount', async () => {
      const mockMessages = [
        createMockMessage({ content: 'Hello' }),
        createMockMessage({ content: 'Hi there' }),
      ];

      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: mockMessages },
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetMessages).toHaveBeenCalled();
      expect(result.current.messages).toHaveLength(2);
    });

    it('passes connectionId to API call', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: [] },
      });

      renderHook(() => useMessages('conn-123'));

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith({ connectionId: 'conn-123' });
      });
    });

    it('sets error on failed fetch', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
      expect(result.current.messages).toEqual([]);
    });

    it('handles missing error message in response', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: false,
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch messages');
    });

    it('handles network errors', async () => {
      mockGetMessages.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.messages).toEqual([]);
    });

    it('handles non-Error thrown values', async () => {
      mockGetMessages.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Unknown error');
    });

    it('handles empty messages array in response', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: [] },
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('refetch', () => {
    it('provides refetch function', async () => {
      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers new API call', async () => {
      mockGetMessages.mockResolvedValue({
        success: true,
        data: { messages: [] },
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockGetMessages.mockClear();

      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: {
          messages: [createMockMessage({ content: 'New message' })],
        },
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetMessages).toHaveBeenCalledTimes(1);
      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('createMessage', () => {
    it('creates a message and adds to list', async () => {
      const newMessage = createMockMessage({ content: 'New message' });

      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: [] },
      });

      mockCreateMessage.mockResolvedValueOnce({
        success: true,
        data: newMessage,
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createMessage({ content: 'New message' });
      });

      expect(success).toBe(true);
      expect(result.current.messages).toHaveLength(1);
    });

    it('returns false on create failure', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: [] },
      });

      mockCreateMessage.mockResolvedValueOnce({
        success: false,
        error: 'Create failed',
      });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createMessage({ content: 'New message' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Create failed');
    });

    it('handles create network error', async () => {
      mockGetMessages.mockResolvedValueOnce({
        success: true,
        data: { messages: [] },
      });

      mockCreateMessage.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createMessage({ content: 'New message' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('no user', () => {
    it('returns empty messages when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useMessages());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(mockGetMessages).not.toHaveBeenCalled();
    });
  });
});
