import type { User } from '@/features/auth';


export const generateUniqueUserId = (email: string, isCognito: boolean = false): string => {
  if (isCognito) {
    return `cognito-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  return `mock-${Date.now()}-${email.replace(/[^a-zA-Z0-9]/g, '')}`;
};


export const validateUserForDatabase = (user: User): boolean => {
  return !!(
    user.id &&
    user.email &&
    user.id.length > 0 &&
    user.email.includes('@')
  );
};


export const securityUtils = {
  
  maskUserForLogging: (user: User) => ({
    id: user.id,
    email: user.email.replace(/(.{2}).*@/, '$1***@'),
    firstName: user.firstName ? user.firstName[0] + '***' : null,
    lastName: user.lastName ? user.lastName[0] + '***' : null,
    emailVerified: user.emailVerified,
  }),

  
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  
  containsPII: (user: User): boolean => {
    return !!(user.firstName || user.lastName || user.email);
  },
};

