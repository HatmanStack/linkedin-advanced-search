import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '@/test-utils/queryWrapper';

const { mockInitializeProfileDatabase, mockToast } = vi.hoisted(() => ({
  mockInitializeProfileDatabase: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    initializeProfileDatabase: mockInitializeProfileDatabase,
  },
}));

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { useProfileInit } from './useProfileInit';

describe('useProfileInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.initializationMessage).toBe('');
    expect(result.current.initializationError).toBe('');
  });

  describe('initializeProfile', () => {
    it('should handle success response', async () => {
      const mockOnSuccess = vi.fn();
      mockInitializeProfileDatabase.mockResolvedValue({
        success: true,
        data: { success: true, message: 'Profile initialized!' },
      });

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.initializeProfile(mockOnSuccess);
      });

      expect(result.current.isInitializing).toBe(false);
      expect(result.current.initializationMessage).toBe('Profile initialized!');
      expect(result.current.initializationError).toBe('');
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
    });

    it('should handle healing response (202)', async () => {
      mockInitializeProfileDatabase.mockResolvedValue({
        success: true,
        data: { healing: true, message: 'Healing in progress' },
      });

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationMessage).toBe('Healing in progress');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Processing' }));
    });

    it('should handle API error response', async () => {
      mockInitializeProfileDatabase.mockResolvedValue({
        success: false,
        error: 'Service unavailable',
      });

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Service unavailable');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });

    it('should handle thrown error', async () => {
      mockInitializeProfileDatabase.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.initializeProfile();
      });

      expect(result.current.initializationError).toBe('Network error');
      expect(result.current.isInitializing).toBe(false);
    });

    it('should set loading state during initialization', async () => {
      let resolveInit: (v: unknown) => void;
      mockInitializeProfileDatabase.mockReturnValue(
        new Promise((resolve) => {
          resolveInit = resolve;
        })
      );

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      let promise: Promise<void>;
      act(() => {
        promise = result.current.initializeProfile();
      });

      expect(result.current.isInitializing).toBe(true);

      await act(async () => {
        resolveInit!({ success: true, data: { success: true } });
        await promise!;
      });

      expect(result.current.isInitializing).toBe(false);
    });
  });

  describe('clearMessages', () => {
    it('should reset message and error', async () => {
      mockInitializeProfileDatabase.mockResolvedValue({
        success: true,
        data: { success: true, message: 'Done' },
      });

      const { result } = renderHook(() => useProfileInit(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.initializeProfile();
      });
      expect(result.current.initializationMessage).toBe('Done');

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.initializationMessage).toBe('');
      expect(result.current.initializationError).toBe('');
    });
  });
});
