import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock modules using inline definitions
const mockToast = vi.fn();

vi.mock('@/shared/hooks', async () => {
  return {
    useToast: () => ({ toast: mockToast }),
  };
});

vi.mock('@/features/messages', () => ({
  MessageGenerationError: class MessageGenerationError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = 'MessageGenerationError';
      this.status = status;
    }
  },
}));

vi.mock('@/shared/services', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

import { useErrorHandler } from '@/shared/hooks/useErrorHandler';
import { MessageGenerationError } from '@/features/messages';
import { ApiError } from '@/shared/services';

describe('useErrorHandler', () => {
  beforeEach(() => {
    mockToast.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with null currentError', () => {
      const { result } = renderHook(() => useErrorHandler());

      expect(result.current.currentError).toBeNull();
    });

    it('starts with empty errorHistory', () => {
      const { result } = renderHook(() => useErrorHandler());

      expect(result.current.errorHistory).toEqual([]);
    });
  });

  describe('handleError', () => {
    it('sets currentError when called', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(result.current.currentError).not.toBeNull();
      expect(result.current.currentError?.message).toBe('Test error');
    });

    it('adds error to errorHistory', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(result.current.errorHistory).toHaveLength(1);
      expect(result.current.errorHistory[0].message).toBe('Test error');
    });

    it('includes connectionId when provided', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'), 'conn-123');
      });

      expect(result.current.currentError?.connectionId).toBe('conn-123');
    });

    it('includes connectionName when provided', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'), 'conn-123', 'John Doe');
      });

      expect(result.current.currentError?.connectionName).toBe('John Doe');
    });

    it('shows toast with error message', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test error',
        })
      );
    });

    it('shows toast with connection name in title', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'), 'conn-123', 'John Doe');
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error processing John Doe',
        })
      );
    });

    it('includes retry count in description', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'), undefined, undefined, 2);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Test error (Attempt 3)',
        })
      );
    });

    it('returns a promise', () => {
      const { result } = renderHook(() => useErrorHandler());

      let promise: Promise<'retry' | 'skip' | 'stop'>;

      act(() => {
        promise = result.current.handleError(new Error('Test error'));
      });

      expect(promise!).toBeInstanceOf(Promise);
    });

    it('resolves to skip after timeout when skip is available', async () => {
      const { result } = renderHook(() => useErrorHandler());

      let resolvedValue: 'retry' | 'skip' | 'stop' | undefined;

      act(() => {
        result.current.handleError(new Error('Test error')).then((v) => {
          resolvedValue = v;
        });
      });

      // Advance timers past the 10 second timeout
      await act(async () => {
        vi.advanceTimersByTime(11000);
      });

      expect(resolvedValue).toBe('skip');
    });
  });

  describe('error categorization', () => {
    it('categorizes authentication errors (401)', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Unauthorized', 401);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.type).toBe('authentication');
    });

    it('categorizes rate limit errors (429)', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Rate limited', 429);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.type).toBe('rate_limit');
    });

    it('categorizes validation errors (4xx)', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Bad request', 400);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.type).toBe('validation');
    });

    it('categorizes server errors (5xx)', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Server error', 500);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.type).toBe('api');
    });

    it('categorizes ApiError as api type', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (ApiError as unknown as new (msg: string) => Error)('API error');

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.type).toBe('api');
    });

    it('categorizes network errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const networkError = new Error('network failure');
      (networkError as { name?: string }).name = 'NetworkError';

      act(() => {
        result.current.handleError(networkError);
      });

      expect(result.current.currentError?.type).toBe('network');
    });

    it('categorizes unknown errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Unknown error'));
      });

      expect(result.current.currentError?.type).toBe('unknown');
    });
  });

  describe('recovery options', () => {
    it('sets recovery options for network errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const networkError = new Error('network failure');
      (networkError as { name?: string }).name = 'NetworkError';

      act(() => {
        result.current.handleError(networkError);
      });

      expect(result.current.currentError?.recoveryOptions).toEqual({
        retry: true,
        skip: true,
        stop: true,
        fallback: false,
      });
    });

    it('sets recovery options for validation errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Bad request', 400);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.recoveryOptions).toEqual({
        retry: false,
        skip: true,
        stop: true,
        fallback: false,
      });
    });

    it('sets recovery options for authentication errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Unauthorized', 401);

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.recoveryOptions).toEqual({
        retry: true,
        skip: false,
        stop: true,
        fallback: false,
      });
    });

    it('sets recovery options for api errors with fallback', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (ApiError as unknown as new (msg: string) => Error)('API error');

      act(() => {
        result.current.handleError(error);
      });

      expect(result.current.currentError?.recoveryOptions.fallback).toBe(true);
    });
  });

  describe('clearError', () => {
    it('clears currentError', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      expect(result.current.currentError).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.currentError).toBeNull();
    });

    it('does not clear errorHistory', async () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error('Test error'));
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.errorHistory).toHaveLength(1);
    });
  });

  describe('feedback methods', () => {
    it('showSuccessFeedback triggers toast with default title', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showSuccessFeedback('Operation completed');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Operation completed',
        variant: 'default',
      });
    });

    it('showSuccessFeedback triggers toast with custom title', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showSuccessFeedback('Messages sent', 'Complete');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Complete',
        description: 'Messages sent',
        variant: 'default',
      });
    });

    it('showWarningFeedback triggers toast with default title', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showWarningFeedback('This might fail');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Warning',
        description: 'This might fail',
        variant: 'default',
      });
    });

    it('showInfoFeedback triggers toast with default title', () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.showInfoFeedback('Processing started');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Information',
        description: 'Processing started',
        variant: 'default',
      });
    });
  });

  describe('toast variant based on severity', () => {
    it('uses destructive variant for critical errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (MessageGenerationError as unknown as new (msg: string, status: number) => Error)('Unauthorized', 401);

      act(() => {
        result.current.handleError(error);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('uses destructive variant for high severity errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const networkError = new Error('network failure');
      (networkError as { name?: string }).name = 'NetworkError';

      act(() => {
        result.current.handleError(networkError);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('uses default variant for medium severity errors', async () => {
      const { result } = renderHook(() => useErrorHandler());

      const error = new (ApiError as unknown as new (msg: string) => Error)('API error');

      act(() => {
        result.current.handleError(error);
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'default',
        })
      );
    });
  });
});
