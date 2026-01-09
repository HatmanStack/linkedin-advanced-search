import { describe, it, expect } from 'vitest';
import {
  isNonEmptyString,
  isValidNumber,
  isPositiveInteger,
  isValidISODate,
  isValidUrl,
  isConnectionStatus,
  isMessageSender,
  isConversionLikelihood,
  isMessage,
  isConnection,
  isConnectionFilters,
  isApiResponse,
} from './guards';

describe('guards', () => {
  describe('primitive type guards', () => {
    describe('isNonEmptyString', () => {
      it('should return true for non-empty strings', () => {
        expect(isNonEmptyString('hello')).toBe(true);
        expect(isNonEmptyString('a')).toBe(true);
      });

      it('should return false for empty strings', () => {
        expect(isNonEmptyString('')).toBe(false);
      });

      it('should return false for non-strings', () => {
        expect(isNonEmptyString(null)).toBe(false);
        expect(isNonEmptyString(undefined)).toBe(false);
        expect(isNonEmptyString(123)).toBe(false);
        expect(isNonEmptyString({})).toBe(false);
      });
    });

    describe('isValidNumber', () => {
      it('should return true for valid numbers', () => {
        expect(isValidNumber(42)).toBe(true);
        expect(isValidNumber(0)).toBe(true);
        expect(isValidNumber(-10)).toBe(true);
        expect(isValidNumber(3.14)).toBe(true);
      });

      it('should return false for non-numbers', () => {
        expect(isValidNumber('42')).toBe(false);
        expect(isValidNumber(null)).toBe(false);
        expect(isValidNumber(NaN)).toBe(false);
        expect(isValidNumber(Infinity)).toBe(false);
      });
    });

    describe('isPositiveInteger', () => {
      it('should return true for positive integers', () => {
        expect(isPositiveInteger(1)).toBe(true);
        expect(isPositiveInteger(100)).toBe(true);
      });

      it('should return false for non-positive or non-integers', () => {
        expect(isPositiveInteger(0)).toBe(false);
        expect(isPositiveInteger(-1)).toBe(false);
        expect(isPositiveInteger(1.5)).toBe(false);
      });
    });

    describe('isValidISODate', () => {
      it('should return true for valid ISO dates', () => {
        expect(isValidISODate('2024-01-15T12:00:00.000Z')).toBe(true);
      });

      it('should return false for invalid dates', () => {
        expect(isValidISODate('not-a-date')).toBe(false);
        expect(isValidISODate('2024-01-15')).toBe(false);
        expect(isValidISODate('')).toBe(false);
      });
    });

    describe('isValidUrl', () => {
      it('should return true for valid URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:3000/path')).toBe(true);
      });

      it('should return false for invalid URLs', () => {
        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
      });
    });
  });

  describe('enum type guards', () => {
    describe('isConnectionStatus', () => {
      it('should return true for valid statuses', () => {
        expect(isConnectionStatus('possible')).toBe(true);
        expect(isConnectionStatus('incoming')).toBe(true);
        expect(isConnectionStatus('outgoing')).toBe(true);
        expect(isConnectionStatus('ally')).toBe(true);
        expect(isConnectionStatus('processed')).toBe(true);
      });

      it('should return false for invalid statuses', () => {
        expect(isConnectionStatus('invalid')).toBe(false);
        expect(isConnectionStatus('')).toBe(false);
        expect(isConnectionStatus(123)).toBe(false);
      });
    });

    describe('isMessageSender', () => {
      it('should return true for valid senders', () => {
        expect(isMessageSender('user')).toBe(true);
        expect(isMessageSender('connection')).toBe(true);
      });

      it('should return false for invalid senders', () => {
        expect(isMessageSender('invalid')).toBe(false);
        expect(isMessageSender('')).toBe(false);
      });
    });

    describe('isConversionLikelihood', () => {
      it('should return true for valid likelihoods', () => {
        expect(isConversionLikelihood('high')).toBe(true);
        expect(isConversionLikelihood('medium')).toBe(true);
        expect(isConversionLikelihood('low')).toBe(true);
      });

      it('should return false for invalid values', () => {
        expect(isConversionLikelihood('invalid')).toBe(false);
        expect(isConversionLikelihood(75)).toBe(false);
        expect(isConversionLikelihood('')).toBe(false);
      });
    });
  });

  describe('isMessage', () => {
    it('should return true for valid messages', () => {
      const message = {
        id: 'msg-1',
        content: 'Hello',
        timestamp: '2024-01-15',
        sender: 'user',
      };
      expect(isMessage(message)).toBe(true);
    });

    it('should return false for invalid messages', () => {
      expect(isMessage(null)).toBe(false);
      expect(isMessage({})).toBe(false);
      expect(isMessage({ id: 'msg-1' })).toBe(false);
    });
  });

  describe('isConnection', () => {
    const validConnection = {
      id: 'conn-1',
      first_name: 'John',
      last_name: 'Doe',
      position: 'Engineer',
      company: 'Test Corp',
      status: 'ally',
    };

    it('should return true for valid connections', () => {
      expect(isConnection(validConnection)).toBe(true);
    });

    it('should return true with optional fields', () => {
      const connWithOptional = {
        ...validConnection,
        location: 'New York',
        headline: 'Senior Engineer',
        conversion_likelihood: 'high',
        tags: ['tech', 'startup'],
      };
      expect(isConnection(connWithOptional)).toBe(true);
    });

    it('should return false for null or non-objects', () => {
      expect(isConnection(null)).toBe(false);
      expect(isConnection('string')).toBe(false);
    });

    it('should return false when missing required fields', () => {
      expect(isConnection({ id: 'conn-1' })).toBe(false);
    });

    it('should return false with invalid status', () => {
      expect(isConnection({ ...validConnection, status: 'invalid' })).toBe(false);
    });

    it('should return false with invalid conversion_likelihood', () => {
      expect(isConnection({ ...validConnection, conversion_likelihood: 'invalid' })).toBe(false);
      expect(isConnection({ ...validConnection, conversion_likelihood: 75 })).toBe(false);
    });

    it('should return false with invalid array fields', () => {
      expect(isConnection({ ...validConnection, tags: [123] })).toBe(false);
      expect(isConnection({ ...validConnection, common_interests: [true] })).toBe(false);
    });
  });

  describe('isConnectionFilters', () => {
    it('should return true for valid filters', () => {
      expect(isConnectionFilters({})).toBe(true);
      expect(isConnectionFilters({ status: 'ally' })).toBe(true);
      expect(isConnectionFilters({ status: 'all' })).toBe(true);
      expect(isConnectionFilters({ company: 'Test Corp' })).toBe(true);
      expect(isConnectionFilters({ tags: ['tech'] })).toBe(true);
    });

    it('should return false for invalid filters', () => {
      expect(isConnectionFilters(null)).toBe(false);
      expect(isConnectionFilters({ status: 'invalid' })).toBe(false);
      expect(isConnectionFilters({ tags: [123] })).toBe(false);
      expect(isConnectionFilters({ company: 123 })).toBe(false);
    });
  });

  describe('isApiResponse', () => {
    it('should return true for valid API responses', () => {
      const response = {
        statusCode: 200,
        body: { data: 'test' },
      };
      expect(isApiResponse(response)).toBe(true);
    });

    it('should return true with optional error field', () => {
      const response = {
        statusCode: 400,
        body: null,
        error: 'Bad request',
      };
      expect(isApiResponse(response)).toBe(true);
    });

    it('should return false for invalid responses', () => {
      expect(isApiResponse(null)).toBe(false);
      expect(isApiResponse({})).toBe(false);
      expect(isApiResponse({ statusCode: 'not-a-number' })).toBe(false);
    });

    it('should use body validator when provided', () => {
      const response = { statusCode: 200, body: 'valid' };
      const validator = (body: unknown): body is string => typeof body === 'string';
      expect(isApiResponse(response, validator)).toBe(true);

      const invalidResponse = { statusCode: 200, body: 123 };
      expect(isApiResponse(invalidResponse, validator)).toBe(false);
    });
  });
});
