import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateUniqueUserId,
  validateUserForDatabase,
  securityUtils,
} from '@/shared/utils/userUtils';

describe('userUtils', () => {
  describe('generateUniqueUserId', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('generates mock user ID for non-Cognito users', () => {
      const email = 'test@example.com';
      const result = generateUniqueUserId(email, false);

      expect(result).toMatch(/^mock-\d+-testexamplecom$/);
    });

    it('generates cognito user ID for Cognito users', () => {
      const email = 'test@example.com';
      const result = generateUniqueUserId(email, true);

      expect(result).toMatch(/^cognito-\d+-[a-z0-9]+$/);
    });

    it('strips special characters from email in mock ID', () => {
      const email = 'user+tag@sub.domain.com';
      const result = generateUniqueUserId(email, false);

      expect(result).toMatch(/^mock-\d+-usertagsubdomaincom$/);
    });

    it('defaults to mock ID when isCognito is not provided', () => {
      const email = 'test@example.com';
      const result = generateUniqueUserId(email);

      expect(result).toMatch(/^mock-/);
    });

    it('generates unique IDs for same email', () => {
      const email = 'test@example.com';
      const result1 = generateUniqueUserId(email, true);

      // Advance time
      vi.advanceTimersByTime(1);

      const result2 = generateUniqueUserId(email, true);

      expect(result1).not.toBe(result2);
    });
  });

  describe('validateUserForDatabase', () => {
    it('returns true for valid user', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
      };

      expect(validateUserForDatabase(user)).toBe(true);
    });

    it('returns false for missing id', () => {
      const user = {
        id: '',
        email: 'test@example.com',
      };

      expect(validateUserForDatabase(user)).toBe(false);
    });

    it('returns false for missing email', () => {
      const user = {
        id: 'user-123',
        email: '',
      };

      expect(validateUserForDatabase(user)).toBe(false);
    });

    it('returns false for invalid email (no @)', () => {
      const user = {
        id: 'user-123',
        email: 'invalid-email',
      };

      expect(validateUserForDatabase(user)).toBe(false);
    });

    it('returns true for email with @ symbol', () => {
      const user = {
        id: 'user-123',
        email: 'simple@test',
      };

      expect(validateUserForDatabase(user)).toBe(true);
    });
  });

  describe('securityUtils', () => {
    describe('maskUserForLogging', () => {
      it('masks email correctly', () => {
        const user = {
          id: 'user-123',
          email: 'johndoe@example.com',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.email).toBe('jo***@example.com');
      });

      it('masks firstName correctly', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
          firstName: 'John',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.firstName).toBe('J***');
      });

      it('masks lastName correctly', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
          lastName: 'Smith',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.lastName).toBe('S***');
      });

      it('returns null for missing firstName', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.firstName).toBeNull();
      });

      it('returns null for missing lastName', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.lastName).toBeNull();
      });

      it('preserves id', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.id).toBe('user-123');
      });

      it('preserves emailVerified', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
          emailVerified: true,
        };

        const result = securityUtils.maskUserForLogging(user);

        expect(result.emailVerified).toBe(true);
      });
    });

    describe('isValidEmail', () => {
      it('returns true for valid email', () => {
        expect(securityUtils.isValidEmail('test@example.com')).toBe(true);
      });

      it('returns true for email with subdomain', () => {
        expect(securityUtils.isValidEmail('user@sub.domain.com')).toBe(true);
      });

      it('returns true for email with plus sign', () => {
        expect(securityUtils.isValidEmail('user+tag@example.com')).toBe(true);
      });

      it('returns false for email without @', () => {
        expect(securityUtils.isValidEmail('notanemail')).toBe(false);
      });

      it('returns false for email without domain', () => {
        expect(securityUtils.isValidEmail('user@')).toBe(false);
      });

      it('returns false for email without local part', () => {
        expect(securityUtils.isValidEmail('@example.com')).toBe(false);
      });

      it('returns false for email with spaces', () => {
        expect(securityUtils.isValidEmail('user @example.com')).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(securityUtils.isValidEmail('')).toBe(false);
      });
    });

    describe('containsPII', () => {
      it('returns true when firstName is present', () => {
        const user = {
          id: 'user-123',
          email: '',
          firstName: 'John',
        };

        expect(securityUtils.containsPII(user)).toBe(true);
      });

      it('returns true when lastName is present', () => {
        const user = {
          id: 'user-123',
          email: '',
          lastName: 'Doe',
        };

        expect(securityUtils.containsPII(user)).toBe(true);
      });

      it('returns true when email is present', () => {
        const user = {
          id: 'user-123',
          email: 'test@test.com',
        };

        expect(securityUtils.containsPII(user)).toBe(true);
      });

      it('returns false when no PII fields are present', () => {
        const user = {
          id: 'user-123',
          email: '',
          firstName: '',
          lastName: '',
        };

        expect(securityUtils.containsPII(user)).toBe(false);
      });
    });
  });
});
