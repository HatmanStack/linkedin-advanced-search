import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock modules
const mockInitializeProfileDatabase = vi.fn();
const mockToast = vi.fn();
const mockMarkChanged = vi.fn();

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    initializeProfileDatabase: (...args: unknown[]) => mockInitializeProfileDatabase(...args),
  },
}));

vi.mock('@/features/connections', () => ({
  connectionChangeTracker: {
    markChanged: (...args: unknown[]) => mockMarkChanged(...args),
  },
}));

import { useProfileInit } from '@/features/profile/hooks/useProfileInit';

describe('useProfileInit', () => {
  beforeEach(() => {
    mockInitializeProfileDatabase.mockReset();
    mockToast.mockReset();
    mockMarkChanged.mockReset();

    // Default successful response
    mockInitializeProfileDatabase.mockResolvedValue({
      success: true,
      data: { success: true, message: 'Initialized' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with isInitializing false', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(result.current.isInitializing).toBe(false);
    });

    it('starts with empty initializationMessage', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(result.current.initializationMessage).toBe('');
    });

    it('starts with empty initializationError', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(result.current.initializationError).toBe('');
    });

    it('provides initializeProfile function', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(typeof result.current.initializeProfile).toBe('function');
    });

    it('provides clearMessages function', () => {
      const { result } = renderHook(() => useProfileInit());

      expect(typeof result.current.clearMessages).toBe('function');
    });
  });

  describe('initializeProfile', () => {
    it('calls puppeteerApiService.initializeProfileDatabase', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockInitializeProfileDatabase).toHaveBeenCalledWith({});
    });

    it('sets initializationMessage on success', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: true,
        data: { success: true, message: 'Profile initialized!' },
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Profile initialized!');
    });

    it('calls onSuccess callback when provided', async () => {
      const onSuccess = vi.fn();

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile(onSuccess);
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it('marks connection as changed on success', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockMarkChanged).toHaveBeenCalledWith('init');
    });

    it('shows success toast on success', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
        })
      );
    });

    it('handles healing response', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: true,
        data: { healing: true, message: 'Healing in progress...' },
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Healing in progress...');
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Processing',
        })
      );
    });

    it('sets initializationError on API failure', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Server error');
    });

    it('shows error toast on failure', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive',
        })
      );
    });

    it('handles network error', async () => {
      mockInitializeProfileDatabase.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Network error');
    });

    it('handles non-Error thrown values', async () => {
      mockInitializeProfileDatabase.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Failed to initialize profile database');
    });

    it('sets isInitializing to false after completion', async () => {
      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.isInitializing).toBe(false);
    });

    it('sets isInitializing to false after error', async () => {
      mockInitializeProfileDatabase.mockRejectedValueOnce(new Error('Error'));

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.isInitializing).toBe(false);
    });

    it('handles response with message but no data.message', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: true,
        message: 'Top level message',
        data: { success: false },
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Top level message');
    });
  });

  describe('clearMessages', () => {
    it('clears initializationMessage', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: true,
        data: { success: true, message: 'Success' },
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Success');

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.initializationMessage).toBe('');
    });

    it('clears initializationError', async () => {
      mockInitializeProfileDatabase.mockResolvedValueOnce({
        success: false,
        error: 'Error',
      });

      const { result } = renderHook(() => useProfileInit());

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Error');

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.initializationError).toBe('');
    });
  });
});
