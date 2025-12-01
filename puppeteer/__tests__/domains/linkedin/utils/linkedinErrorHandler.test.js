import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { LinkedInErrorHandler } from '../../../../src/domains/linkedin/utils/linkedinErrorHandler.js';

describe('LinkedInErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ERROR_CATEGORIES', () => {
    it('should have all error categories defined', () => {
      expect(LinkedInErrorHandler.ERROR_CATEGORIES).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.AUTHENTICATION).toBe('AUTHENTICATION');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.BROWSER).toBe('BROWSER');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.LINKEDIN).toBe('LINKEDIN');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.VALIDATION).toBe('VALIDATION');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.RATE_LIMIT).toBe('RATE_LIMIT');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.NETWORK).toBe('NETWORK');
      expect(LinkedInErrorHandler.ERROR_CATEGORIES.SYSTEM).toBe('SYSTEM');
    });
  });

  describe('ERROR_CODES', () => {
    it('should have authentication error codes', () => {
      expect(LinkedInErrorHandler.ERROR_CODES.JWT_INVALID).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CODES.JWT_INVALID.httpStatus).toBe(401);
      expect(LinkedInErrorHandler.ERROR_CODES.LINKEDIN_AUTH_REQUIRED).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CODES.LINKEDIN_SESSION_EXPIRED).toBeDefined();
    });

    it('should have browser error codes', () => {
      expect(LinkedInErrorHandler.ERROR_CODES.BROWSER_CRASH).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CODES.BROWSER_CRASH.httpStatus).toBe(503);
      expect(LinkedInErrorHandler.ERROR_CODES.BROWSER_TIMEOUT).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CODES.ELEMENT_NOT_FOUND).toBeDefined();
    });

    it('should have rate limit error codes with retryAfter', () => {
      expect(LinkedInErrorHandler.ERROR_CODES.LINKEDIN_RATE_LIMIT).toBeDefined();
      expect(LinkedInErrorHandler.ERROR_CODES.LINKEDIN_RATE_LIMIT.httpStatus).toBe(429);
      expect(LinkedInErrorHandler.ERROR_CODES.LINKEDIN_RATE_LIMIT.retryAfter).toBeDefined();
    });
  });

  describe('categorizeError', () => {
    it('should categorize JWT errors', () => {
      const error = new Error('Invalid JWT token');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('AUTHENTICATION');
      expect(result.httpStatus).toBe(401);
    });

    it('should categorize authentication errors', () => {
      const error = new Error('Login required for authentication');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('AUTHENTICATION');
    });

    it('should categorize browser crash errors', () => {
      const error = new Error('Browser session crashed');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('BROWSER');
      expect(result.httpStatus).toBe(503);
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Operation timed out');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('BROWSER');
      expect(result.httpStatus).toBe(504);
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('Rate limit exceeded, too many requests');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('RATE_LIMIT');
      expect(result.httpStatus).toBe(429);
    });

    it('should categorize network errors', () => {
      const error = new Error('Network connection failed');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('NETWORK');
    });

    it('should categorize memory errors', () => {
      const error = new Error('Memory heap limit exceeded');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('SYSTEM');
    });

    it('should return default system error for unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = LinkedInErrorHandler.categorizeError(error);
      expect(result.category).toBe('SYSTEM');
      expect(result.httpStatus).toBe(500);
    });
  });

  describe('createErrorResponse', () => {
    it('should create a properly formatted error response', () => {
      const error = new Error('Test error');
      const context = { operation: 'test' };
      const requestId = 'req-123';

      const { response, httpStatus } = LinkedInErrorHandler.createErrorResponse(error, context, requestId);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error.requestId).toBe(requestId);
      expect(response.error.timestamp).toBeDefined();
      expect(response.error.suggestions).toBeDefined();
      expect(httpStatus).toBeDefined();
    });

    it('should include retryAfter for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const { response } = LinkedInErrorHandler.createErrorResponse(error, {}, 'req-123');

      expect(response.error.retryAfter).toBeDefined();
      expect(response.error.retryAt).toBeDefined();
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff for rate limit', () => {
      const delay1 = LinkedInErrorHandler.calculateBackoffDelay(1, 'RATE_LIMIT');
      const delay2 = LinkedInErrorHandler.calculateBackoffDelay(2, 'RATE_LIMIT');
      const delay3 = LinkedInErrorHandler.calculateBackoffDelay(3, 'RATE_LIMIT');

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should calculate linear backoff for browser errors', () => {
      const delay1 = LinkedInErrorHandler.calculateBackoffDelay(1, 'BROWSER');
      const delay2 = LinkedInErrorHandler.calculateBackoffDelay(2, 'BROWSER');

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay2).toBeLessThanOrEqual(30000);
    });

    it('should cap delay at maximum', () => {
      const delay = LinkedInErrorHandler.calculateBackoffDelay(100, 'RATE_LIMIT');
      expect(delay).toBeLessThanOrEqual(300000 * 1.1); // max + jitter
    });
  });

  describe('isRecoverable', () => {
    it('should return true for browser errors on first attempt', () => {
      const browserError = LinkedInErrorHandler.ERROR_CODES.BROWSER_CRASH;
      expect(LinkedInErrorHandler.isRecoverable(browserError, 1)).toBe(true);
    });

    it('should return true for network errors', () => {
      const networkError = LinkedInErrorHandler.ERROR_CODES.NETWORK_ERROR;
      expect(LinkedInErrorHandler.isRecoverable(networkError, 1)).toBe(true);
    });

    it('should return false after max attempts', () => {
      const browserError = LinkedInErrorHandler.ERROR_CODES.BROWSER_CRASH;
      expect(LinkedInErrorHandler.isRecoverable(browserError, 3)).toBe(false);
    });

    it('should return true for rate limit on first two attempts', () => {
      const rateLimitError = LinkedInErrorHandler.ERROR_CODES.LINKEDIN_RATE_LIMIT;
      expect(LinkedInErrorHandler.isRecoverable(rateLimitError, 1)).toBe(true);
      expect(LinkedInErrorHandler.isRecoverable(rateLimitError, 2)).toBe(true);
    });

    it('should return false for rate limit after two attempts', () => {
      const rateLimitError = LinkedInErrorHandler.ERROR_CODES.LINKEDIN_RATE_LIMIT;
      expect(LinkedInErrorHandler.isRecoverable(rateLimitError, 3)).toBe(false);
    });
  });

  describe('createRecoveryPlan', () => {
    it('should create recovery plan for browser errors', () => {
      const error = new Error('Browser crashed');
      const plan = LinkedInErrorHandler.createRecoveryPlan(error, { attemptCount: 1 });

      expect(plan.shouldRecover).toBe(true);
      expect(plan.delay).toBeGreaterThan(0);
      expect(plan.actions).toContain('Cleanup existing browser session');
    });

    it('should create recovery plan for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const plan = LinkedInErrorHandler.createRecoveryPlan(error, { attemptCount: 1 });

      expect(plan.shouldRecover).toBe(true);
      expect(plan.actions).toContain('Wait for rate limit window to reset');
    });

    it('should create recovery plan for authentication errors', () => {
      const error = new Error('Authentication failed');
      const plan = LinkedInErrorHandler.createRecoveryPlan(error, { attemptCount: 1 });

      expect(plan.actions).toContain('Clear existing authentication state');
    });

    it('should set shouldRecover to false after max attempts', () => {
      const error = new Error('Browser crashed');
      const plan = LinkedInErrorHandler.createRecoveryPlan(error, { attemptCount: 5 });

      expect(plan.shouldRecover).toBe(false);
    });
  });
});
