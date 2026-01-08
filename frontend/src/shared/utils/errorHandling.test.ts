import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  transformErrorForUser,
  getToastVariant,
  ERROR_MESSAGES,
  logError,
} from './errorHandling';
import { ApiError } from '@/shared/services';

// Mock the logger
vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('errorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transformErrorForUser', () => {
    it('should handle ApiError with 401 status', () => {
      const error = new ApiError({ message: 'Unauthorized', status: 401 });
      const result = transformErrorForUser(error, 'fetch data');

      expect(result.severity).toBe('high');
      expect(result.userMessage).toContain('sign in');
      expect(result.recoveryActions.length).toBeGreaterThan(0);
      expect(result.recoveryActions[0].label).toBe('Sign In');
    });

    it('should handle ApiError with 403 status', () => {
      const error = new ApiError({ message: 'Forbidden', status: 403 });
      const result = transformErrorForUser(error, 'fetch data');

      expect(result.severity).toBe('high');
      expect(result.userMessage).toContain('sign in');
    });

    it('should handle ApiError with 404 status', () => {
      const error = new ApiError({ message: 'Not Found', status: 404 });
      const result = transformErrorForUser(error, 'fetch connection');

      expect(result.severity).toBe('medium');
      expect(result.userMessage).toContain('could not be found');
    });

    it('should handle ApiError with 429 rate limit status', () => {
      const error = new ApiError({ message: 'Rate limited', status: 429 });
      const result = transformErrorForUser(error, 'fetch data');

      expect(result.severity).toBe('low');
      expect(result.retryable).toBe(true);
      expect(result.userMessage).toContain('Too many requests');
    });

    it('should handle ApiError with 500+ status', () => {
      const error = new ApiError({ message: 'Server error', status: 500 });
      const result = transformErrorForUser(error, 'save data');

      expect(result.severity).toBe('high');
      expect(result.retryable).toBe(true);
      expect(result.userMessage).toContain('servers are experiencing issues');
    });

    it('should handle ApiError with network error code', () => {
      const error = new ApiError({ message: 'Network error', status: 0, code: 'NETWORK_ERROR' });
      const result = transformErrorForUser(error, 'connect');

      expect(result.severity).toBe('high');
      expect(result.retryable).toBe(true);
      expect(result.userMessage).toContain('internet connection');
    });

    it('should handle regular Error', () => {
      const error = new Error('Something went wrong');
      const result = transformErrorForUser(error, 'perform operation');

      expect(result.message).toBe('Something went wrong');
      expect(result.userMessage).toContain('Failed to perform operation');
    });

    it('should handle Error with timeout message', () => {
      const error = new Error('Request timeout');
      const result = transformErrorForUser(error, 'fetch data');

      expect(result.severity).toBe('low');
      expect(result.retryable).toBe(true);
      expect(result.userMessage).toContain('took too long');
    });

    it('should handle Error with network message', () => {
      const error = new Error('network failed');
      const result = transformErrorForUser(error, 'connect');

      expect(result.severity).toBe('high');
      expect(result.retryable).toBe(true);
      expect(result.userMessage).toContain('Network connection issue');
    });

    it('should handle string error', () => {
      const result = transformErrorForUser('Custom error message', 'test operation');

      expect(result.message).toBe('Custom error message');
      expect(result.userMessage).toContain('Failed to test operation');
    });

    it('should handle unknown error types', () => {
      const result = transformErrorForUser({ unknown: 'object' }, 'do something');

      expect(result.message).toBe('An unexpected error occurred');
      expect(result.userMessage).toBe('Something went wrong. Please try again.');
    });

    it('should preserve provided recovery actions', () => {
      const customAction = { label: 'Retry', action: vi.fn(), primary: true };
      const error = new Error('Test error');
      const result = transformErrorForUser(error, 'test', [customAction]);

      expect(result.recoveryActions).toContain(customAction);
    });
  });

  describe('getToastVariant', () => {
    it('should return default for low severity', () => {
      expect(getToastVariant('low')).toBe('default');
    });

    it('should return destructive for medium severity', () => {
      expect(getToastVariant('medium')).toBe('destructive');
    });

    it('should return destructive for high severity', () => {
      expect(getToastVariant('high')).toBe('destructive');
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have all expected error message keys', () => {
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
    it('should log error with Error instance', () => {
      const error = new Error('Test error');
      // This should not throw
      expect(() => logError(error, 'TestContext')).not.toThrow();
    });

    it('should log error with string', () => {
      expect(() => logError('String error', 'TestContext')).not.toThrow();
    });

    it('should log error with additional data', () => {
      const error = new Error('Test error');
      const additionalData = { userId: '123', action: 'test' };
      expect(() => logError(error, 'TestContext', additionalData)).not.toThrow();
    });
  });
});
