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
 * Sanitize user data for database storage
 */
export const sanitizeUserForDatabase = (user: User) => {
  return {
    id: user.id.trim(),
    email: user.email.toLowerCase().trim(),
    firstName: user.firstName?.trim() || null,
    lastName: user.lastName?.trim() || null,
    emailVerified: user.emailVerified || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a database-safe user identifier
 * This ensures the ID is suitable for database primary keys
 */
export const getDatabaseUserId = (user: User): string => {
  // For Cognito users, use the sub directly
  if (user.id.includes('cognito') || user.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return user.id;
  }
  
  // For mock users, ensure it's database-safe
  return user.id.replace(/[^a-zA-Z0-9-_]/g, '');
};

/**
 * Check if user ID is from Cognito (UUID format)
 */
export const isCognitoUser = (userId: string): boolean => {
  // Check if it's a UUID format (Cognito sub)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
};

/**
 * Get user display name
 */
export const getUserDisplayName = (user: User): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.firstName) {
    return user.firstName;
  }
  
  if (user.lastName) {
    return user.lastName;
  }
  
  return user.email.split('@')[0];
};

/**
 * Get user initials for avatar display
 */
export const getUserInitials = (user: User): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  
  if (user.firstName) {
    return user.firstName.substring(0, 2).toUpperCase();
  }
  
  if (user.lastName) {
    return user.lastName.substring(0, 2).toUpperCase();
  }
  
  const emailName = user.email.split('@')[0];
  return emailName.substring(0, 2).toUpperCase();
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

/**
 * Database mapping utilities
 */
export const databaseUtils = {
  /**
   * Prepare user data for database insertion
   */
  prepareForInsert: (user: User) => {
    const sanitized = sanitizeUserForDatabase(user);
    return {
      ...sanitized,
      user_id: getDatabaseUserId(user),
      is_cognito_user: isCognitoUser(user.id),
      display_name: getUserDisplayName(user),
    };
  },

  /**
   * Generate a unique constraint key for the user
   */
  generateConstraintKey: (user: User): string => {
    return `user_${getDatabaseUserId(user)}_${user.email.toLowerCase()}`;
  },
};
