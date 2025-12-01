import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { SearchRequestValidator } from '../../../../src/domains/search/utils/searchRequestValidator.js';

describe('SearchRequestValidator', () => {
  describe('validateRequest', () => {
    it('should return valid for complete request with plaintext credentials', () => {
      const body = {
        companyName: 'Acme Corp',
        companyRole: 'Engineer',
        companyLocation: 'San Francisco',
        searchName: 'user@example.com',
        searchPassword: 'password123',
      };
      const jwtToken = 'valid-jwt-token';

      const result = SearchRequestValidator.validateRequest(body, jwtToken);

      expect(result.isValid).toBe(true);
    });

    it('should return valid for request with encrypted credentials', () => {
      const body = {
        companyName: 'Acme Corp',
        linkedinCredentialsCiphertext: 'sealbox_x25519:b64:encrypted-data',
      };
      const jwtToken = 'valid-jwt-token';

      const result = SearchRequestValidator.validateRequest(body, jwtToken);

      expect(result.isValid).toBe(true);
    });

    it('should return valid for request with structured credentials', () => {
      const body = {
        companyName: 'Acme Corp',
        linkedinCredentials: {
          email: 'user@example.com',
          password: 'password123',
        },
      };
      const jwtToken = 'valid-jwt-token';

      const result = SearchRequestValidator.validateRequest(body, jwtToken);

      expect(result.isValid).toBe(true);
    });

    it('should return invalid when no credentials provided', () => {
      const body = {
        companyName: 'Acme Corp',
        companyRole: 'Engineer',
      };
      const jwtToken = 'valid-jwt-token';

      const result = SearchRequestValidator.validateRequest(body, jwtToken);

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should return 401 when JWT token is missing', () => {
      const body = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
      };

      const result = SearchRequestValidator.validateRequest(body, null);

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should return 401 when JWT token is empty', () => {
      const body = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
      };

      const result = SearchRequestValidator.validateRequest(body, '');

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('should include search in error message for actionType', () => {
      const body = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
        searchPassword: 'password123',
      };

      const result = SearchRequestValidator.validateRequest(body, null);

      expect(result.message).toContain('search');
    });

    it('should handle empty body gracefully', () => {
      const result = SearchRequestValidator.validateRequest({}, 'valid-token');

      expect(result.isValid).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should handle partial credentials (only searchName)', () => {
      const body = {
        companyName: 'Acme Corp',
        searchName: 'user@example.com',
      };

      const result = SearchRequestValidator.validateRequest(body, 'valid-token');

      expect(result.isValid).toBe(false);
    });

    it('should handle partial credentials (only searchPassword)', () => {
      const body = {
        companyName: 'Acme Corp',
        searchPassword: 'password123',
      };

      const result = SearchRequestValidator.validateRequest(body, 'valid-token');

      expect(result.isValid).toBe(false);
    });
  });
});
