import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the ApiError import - define class inline in mock
vi.mock('@/shared/services', () => ({
  ApiError: class ApiError extends Error {
    status?: number;
    code?: string;
    retryable?: boolean;

    constructor({
      message,
      status,
      code,
      retryable,
    }: {
      message: string;
      status?: number;
      code?: string;
      retryable?: boolean;
    }) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.retryable = retryable;
    }
  },
}));

// Import ApiError from the mock for use in tests
import { ApiError } from '@/shared/services';

import {
  transformErrorForUser,
  getToastVariant,
  ERROR_MESSAGES,
  logError,
} from '@/shared/utils/errorHandling';

describe('errorHandling', () => {
  describe('transformErrorForUser', () => {
    it('returns default values for unknown error', () => {
      const result = transformErrorForUser({}, 'test operation');

      expect(result.message).toBe('An unexpected error occurred');
      expect(result.userMessage).toBe('Something went wrong. Please try again.');
      expect(result.severity).toBe('medium');
      expect(result.retryable).toBe(false);
    });

    it('handles regular Error', () => {
      const error = new Error('Something broke');
      const result = transformErrorForUser(error, 'load data');

      expect(result.message).toBe('Something broke');
      expect(result.userMessage).toBe('Failed to load data. Something broke');
    });

    it('handles string error', () => {
      const result = transformErrorForUser('String error message', 'fetch users');

      expect(result.message).toBe('String error message');
      expect(result.userMessage).toBe('Failed to fetch users. String error message');
    });

    it('handles timeout errors', () => {
      const error = new Error('Request timeout');
      const result = transformErrorForUser(error, 'load data');

      expect(result.userMessage).toBe('The request took too long. Please try again.');
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe('low');
    });

    it('handles network errors in Error message', () => {
      const error = new Error('network connection failed');
      const result = transformErrorForUser(error, 'load data');

      expect(result.userMessage).toBe('Network connection issue. Please check your internet connection.');
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('handles fetch errors in Error message', () => {
      const error = new Error('fetch failed');
      const result = transformErrorForUser(error, 'load data');

      expect(result.retryable).toBe(true);
      expect(result.severity).toBe('high');
    });

    it('includes provided recovery actions', () => {
      const retryAction = { label: 'Retry', action: vi.fn() };
      const result = transformErrorForUser(new Error('test'), 'test', [retryAction]);

      expect(result.recoveryActions).toContain(retryAction);
    });

    describe('ApiError handling', () => {
      it('handles 401 unauthorized', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Unauthorized', status: 401 });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('You need to sign in again to continue.');
        expect(result.severity).toBe('high');
        expect(result.recoveryActions).toHaveLength(1);
        expect(result.recoveryActions[0].label).toBe('Sign In');
      });

      it('handles 403 forbidden', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Forbidden', status: 403 });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('You need to sign in again to continue.');
        expect(result.severity).toBe('high');
      });

      it('handles 404 not found', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Not found', status: 404 });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('The requested information could not be found.');
        expect(result.severity).toBe('medium');
      });

      it('handles 429 rate limit', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Rate limited', status: 429 });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('Too many requests. Please wait a moment and try again.');
        expect(result.severity).toBe('low');
        expect(result.retryable).toBe(true);
      });

      it('handles 500+ server errors', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Internal error', status: 500 });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('Our servers are experiencing issues. Please try again in a few moments.');
        expect(result.severity).toBe('high');
        expect(result.retryable).toBe(true);
      });

      it('handles 503 server error', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Service unavailable', status: 503 });
        const result = transformErrorForUser(error, 'test');

        expect(result.retryable).toBe(true);
        expect(result.severity).toBe('high');
      });

      it('handles network error code', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; code?: string }) => Error)({ message: 'Failed', code: 'NETWORK_ERROR' });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('Unable to connect to our servers. Please check your internet connection.');
        expect(result.retryable).toBe(true);
        expect(result.severity).toBe('high');
      });

      it('handles Network error in message', () => {
        const error = new (ApiError as unknown as new (opts: { message: string }) => Error)({ message: 'Network error occurred' });
        const result = transformErrorForUser(error, 'test');

        expect(result.userMessage).toBe('Unable to connect to our servers. Please check your internet connection.');
        expect(result.retryable).toBe(true);
      });

      it('uses error retryable property', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; retryable?: boolean }) => Error)({ message: 'Error', retryable: true });
        const result = transformErrorForUser(error, 'test');

        expect(result.retryable).toBe(true);
      });

      it('falls back to context-based message for other status codes', () => {
        const error = new (ApiError as unknown as new (opts: { message: string; status?: number }) => Error)({ message: 'Bad request', status: 400 });
        const result = transformErrorForUser(error, 'save data');

        expect(result.userMessage).toBe('Failed to save data. Bad request');
        expect(result.severity).toBe('medium');
      });
    });
  });

  describe('getToastVariant', () => {
    it('returns default for low severity', () => {
      expect(getToastVariant('low')).toBe('default');
    });

    it('returns destructive for medium severity', () => {
      expect(getToastVariant('medium')).toBe('destructive');
    });

    it('returns destructive for high severity', () => {
      expect(getToastVariant('high')).toBe('destructive');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('has required context messages', () => {
      expect(ERROR_MESSAGES.FETCH_CONNECTIONS).toBe('load your connections');
      expect(ERROR_MESSAGES.UPDATE_CONNECTION).toBe('update the connection');
      expect(ERROR_MESSAGES.REMOVE_CONNECTION).toBe('remove the connection');
      expect(ERROR_MESSAGES.FETCH_MESSAGES).toBe('load message history');
      expect(ERROR_MESSAGES.SEND_MESSAGE).toBe('send the message');
      expect(ERROR_MESSAGES.AUTHENTICATION).toBe('authenticate your request');
      expect(ERROR_MESSAGES.NETWORK).toBe('connect to our servers');
      expect(ERROR_MESSAGES.VALIDATION).toBe('validate the information');
      expect(ERROR_MESSAGES.UNKNOWN).toBe('complete the operation');
    });
  });

  describe('logError', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('logs Error instances correctly', () => {
      const error = new Error('Test error');

      // This function logs to the logger, which we've mocked
      // Just verify it doesn't throw
      expect(() => logError(error, 'TestContext')).not.toThrow();
    });

    it('logs non-Error values', () => {
      expect(() => logError('string error', 'TestContext')).not.toThrow();
      expect(() => logError({ custom: 'error' }, 'TestContext')).not.toThrow();
      expect(() => logError(123, 'TestContext')).not.toThrow();
    });

    it('includes additional data', () => {
      const additionalData = { userId: '123', action: 'test' };

      expect(() => logError(new Error('test'), 'TestContext', additionalData)).not.toThrow();
    });
  });
});
