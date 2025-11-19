/**
 * Unit Tests for useErrorHandler Hook
 * Task 9: Comprehensive error handling and user feedback
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { MessageGenerationError } from '@/services/messageGenerationService';
import { ApiError } from '@/services/lambdaApiService';

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('useErrorHandler Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize MessageGenerationError with 401 as authentication error', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new MessageGenerationError({ message: 'Unauthorized', status: 401 });

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError?.type).toBe('authentication');
      expect(result.current.currentError?.recoveryOptions.retry).toBe(true);
      expect(result.current.currentError?.recoveryOptions.skip).toBe(false);
    });

    it('should categorize MessageGenerationError with 429 as rate_limit error', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new MessageGenerationError({ message: 'Rate limited', status: 429 });

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError?.type).toBe('rate_limit');
      expect(result.current.currentError?.recoveryOptions.retry).toBe(true);
      expect(result.current.currentError?.recoveryOptions.skip).toBe(true);
    });

    it('should categorize ApiError as api error', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new ApiError('Database error', 500);

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError?.type).toBe('api');
      expect(result.current.currentError?.recoveryOptions.fallback).toBe(true);
    });

    it('should categorize network errors correctly', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Network request failed');
      error.name = 'NetworkError';

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError?.type).toBe('network');
      expect(result.current.currentError?.recoveryOptions.retry).toBe(true);
    });

    it('should categorize unknown errors as unknown type', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Something went wrong');

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError?.type).toBe('unknown');
    });
  });

  describe('Recovery Options', () => {
    it('should provide correct recovery options for network errors', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Network timeout');
      error.name = 'NetworkError';

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      const options = result.current.currentError?.recoveryOptions;
      expect(options?.retry).toBe(true);
      expect(options?.skip).toBe(true);
      expect(options?.stop).toBe(true);
      expect(options?.fallback).toBe(false);
    });

    it('should provide correct recovery options for validation errors', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new MessageGenerationError({ message: 'Invalid input', status: 400 });

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      const options = result.current.currentError?.recoveryOptions;
      expect(options?.retry).toBe(false);
      expect(options?.skip).toBe(true);
      expect(options?.stop).toBe(true);
      expect(options?.fallback).toBe(false);
    });
  });

  describe('Error History', () => {
    it('should maintain error history', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      act(() => {
        result.current.handleError(error1, 'conn1', 'John Doe');
      });

      act(() => {
        result.current.handleError(error2, 'conn2', 'Jane Smith');
      });

      expect(result.current.errorHistory).toHaveLength(2);
      expect(result.current.errorHistory[0].message).toBe('First error');
      expect(result.current.errorHistory[1].message).toBe('Second error');
    });

    it('should track retry count in error history', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Retry test');

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe', 2);
      });

      expect(result.current.currentError?.retryCount).toBe(2);
    });
  });

  describe('User Feedback', () => {
    it('should show success feedback', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showSuccessFeedback('Operation completed successfully');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Operation completed successfully',
        variant: 'default'
      });
    });

    it('should show warning feedback', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showWarningFeedback('This is a warning', 'Custom Warning');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Custom Warning',
        description: 'This is a warning',
        variant: 'default'
      });
    });

    it('should show info feedback', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showInfoFeedback('Information message');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Information',
        description: 'Information message',
        variant: 'default'
      });
    });
  });

  describe('Error Clearing', () => {
    it('should clear current error', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(result.current.currentError).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.currentError).toBeNull();
    });
  });

  describe('Toast Integration', () => {
    it('should show toast with connection name in title', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe');
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error processing John Doe',
          description: 'Test error'
        })
      );
    });

    it('should show generic title when no connection name provided', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');

      act(() => {
        result.current.handleError(error);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Message generation error',
          description: 'Test error'
        })
      );
    });

    it('should include retry count in description', async () => {
      const { result } = renderHook(() => useErrorHandler());
      const error = new Error('Test error');

      act(() => {
        result.current.handleError(error, 'conn1', 'John Doe', 1);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test error (Attempt 2)'
        })
      );
    });
  });
});
