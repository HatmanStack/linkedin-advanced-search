import type { User } from '@/contexts/AuthContext';

/**
 * Utility functions for user management and identification
 */

/**
 * Generate a unique user identifier
 * For Cognito users, this will be the Cognito sub (UUID)
 * For mock users, this will be a timestamp-based ID
 */
export const generateUniqueUserId = (email: string, isCognito: boolean = false): string => {
  if (isCognito) {
    // Cognito will provide the actual UUID, this is just a fallback
    return `cognito-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // For mock/development users
  return `mock-${Date.now()}-${email.replace(/[^a-zA-Z0-9]/g, '')}`;
};

/**
 * Validate user object has required fields for database mapping
 */
export const validateUserForDatabase = (user: User): boolean => {
  return !!(
    user.id &&
    user.email &&
    user.id.length > 0 &&
    user.email.includes('@')
  );
};


/**
 * Security considerations for user data
 */
export const securityUtils = {
  /**
   * Mask sensitive user information for logging
   */
  maskUserForLogging: (user: User) => ({
    id: user.id,
    email: user.email.replace(/(.{2}).*@/, '$1***@'),
    firstName: user.firstName ? user.firstName[0] + '***' : null,
    lastName: user.lastName ? user.lastName[0] + '***' : null,
    emailVerified: user.emailVerified,
  }),

  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Check if user data contains PII that needs special handling
   */
  containsPII: (user: User): boolean => {
    return !!(user.firstName || user.lastName || user.email);
  },
};

