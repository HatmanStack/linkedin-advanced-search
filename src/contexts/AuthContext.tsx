import React, { createContext, useContext, useEffect, useState } from 'react';
import { CognitoAuthService, type CognitoUserData } from '@/services/cognitoService';
import { isCognitoConfigured } from '@/config/appConfig';
import { generateUniqueUserId, validateUserForDatabase, securityUtils } from '@/utils/userUtils';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  confirmSignUp?: (email: string, code: string) => Promise<{ error: any }>;
  resendConfirmationCode?: (email: string) => Promise<{ error: any }>;
  forgotPassword?: (email: string) => Promise<{ error: any }>;
  confirmPassword?: (email: string, code: string, newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Local storage key for mock authentication fallback
const LOCAL_STORAGE_KEY = 'linkedin_advanced_search_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    if (isCognitoConfigured) {
      // Use AWS Cognito
      try {
        const cognitoUser: CognitoUserData | null = await CognitoAuthService.getCurrentUser();
        if (cognitoUser) {
          const userData: User = {
            id: cognitoUser.id, // This is the Cognito sub (UUID)
            email: cognitoUser.email,
            firstName: cognitoUser.firstName,
            lastName: cognitoUser.lastName,
            emailVerified: cognitoUser.emailVerified,
          };

          // Validate user data before setting
          if (validateUserForDatabase(userData)) {
            setUser(userData);
            console.log('Cognito user authenticated:', securityUtils.maskUserForLogging(userData));
          } else {
            console.error('Invalid user data from Cognito');
          }
        }
      } catch (error) {
        console.error('Error initializing Cognito auth:', error);
      }
    } else {
      // Fallback to localStorage mock authentication
      const storedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (validateUserForDatabase(parsedUser)) {
            setUser(parsedUser);
            console.log('Mock user authenticated:', securityUtils.maskUserForLogging(parsedUser));
          } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }
    setLoading(false);
  };

  const getToken = async (): Promise<string | null> => {
    if (isCognitoConfigured) {
      try {
        return await CognitoAuthService.getCurrentUserToken();
      } catch (error) {
        console.error('Error getting token:', error);
        return null;
      }
    } else {
      // For mock auth, return a fake token or null
      return user ? 'mock-jwt-token' : null;
    }
  };

  const signIn = async (email: string, password: string) => {
    // Validate email format
    if (!securityUtils.isValidEmail(email)) {
      return { error: { message: 'Invalid email format' } };
    }

    if (isCognitoConfigured) {
      // Use AWS Cognito
      try {
        const result = await CognitoAuthService.signIn(email, password);
        if (result.error) {
          return { error: result.error };
        }

        if (result.user) {
          const userData: User = {
            id: result.user.id, // Cognito sub (UUID)
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            emailVerified: result.user.emailVerified,
          };

          if (validateUserForDatabase(userData)) {
            setUser(userData);
            console.log('User signed in:', securityUtils.maskUserForLogging(userData));
          } else {
            return { error: { message: 'Invalid user data received' } };
          }
        }

        return { error: null };
      } catch {
        return { error: { message: 'Authentication failed' } };
      }
    } else {
      // Fallback to mock authentication
      if (email && password) {
        const mockUser: User = {
          id: generateUniqueUserId(email, false),
          email: email.toLowerCase(),
          firstName: 'Demo',
          lastName: 'User',
          emailVerified: true,
        };

        if (validateUserForDatabase(mockUser)) {
          setUser(mockUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockUser));
          console.log('Mock user signed in:', securityUtils.maskUserForLogging(mockUser));
          return { error: null };
        }
      }
      return { error: { message: 'Invalid credentials' } };
    }
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    // Validate email format
    if (!securityUtils.isValidEmail(email)) {
      return { error: { message: 'Invalid email format' } };
    }

    if (isCognitoConfigured) {
      // Use AWS Cognito
      try {
        const result = await CognitoAuthService.signUp(email, password, firstName, lastName);
        if (result.error) {
          return { error: result.error };
        }

        // For Cognito, user needs to verify email before they can sign in
        // Don't set user state here, they need to verify first
        console.log('User registered with Cognito, verification required');
        return {
          error: null,
          message: 'Registration successful! Please check your email for verification code.',
          needsVerification: true
        };
      } catch {
        return { error: { message: 'Registration failed' } };
      }
    } else {
      // Fallback to mock authentication
      if (email && password) {
        const mockUser: User = {
          id: generateUniqueUserId(email, false),
          email: email.toLowerCase(),
          firstName: firstName || 'New',
          lastName: lastName || 'User',
          emailVerified: true,
        };

        if (validateUserForDatabase(mockUser)) {
          setUser(mockUser);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockUser));
          console.log('Mock user registered:', securityUtils.maskUserForLogging(mockUser));
          return { error: null };
        }
      }
      return { error: { message: 'Registration failed' } };
    }
  };

  const signOut = async () => {
    if (user) {
      console.log('User signing out:', securityUtils.maskUserForLogging(user));
    }

    // Clear JWT token from session storage
          // Note: clearAuthToken functionality moved to puppeteerApiService
      // For now, we'll clear session storage directly
      sessionStorage.removeItem('jwt_token');

    if (isCognitoConfigured) {
      // Use AWS Cognito
      try {
        await CognitoAuthService.signOut();
      } catch (error) {
        console.error('Error signing out from Cognito:', error);
      }
    } else {
      // Fallback to localStorage cleanup
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setUser(null);
  };

  // Cognito-specific methods (only available when Cognito is configured)
  const confirmSignUp = isCognitoConfigured
    ? async (email: string, code: string) => {
      try {
        const result = await CognitoAuthService.confirmSignUp(email, code);
        if (!result.error) {
          console.log('User email verified:', email);
        }
        return result;
      } catch {
        return { error: { message: 'Verification failed' } };
      }
    }
    : undefined;

  const resendConfirmationCode = isCognitoConfigured
    ? async (email: string) => {
      try {
        return await CognitoAuthService.resendConfirmationCode(email);
      } catch {
        return { error: { message: 'Failed to resend code' } };
      }
    }
    : undefined;

  const forgotPassword = isCognitoConfigured
    ? async (email: string) => {
      try {
        return await CognitoAuthService.forgotPassword(email);
      } catch {
        return { error: { message: 'Failed to initiate password reset' } };
      }
    }
    : undefined;

  const confirmPassword = isCognitoConfigured
    ? async (email: string, code: string, newPassword: string) => {
      try {
        return await CognitoAuthService.confirmPassword(email, code, newPassword);
      } catch {
        return { error: { message: 'Failed to reset password' } };
      }
    }
    : undefined;

  const value = {
    user,
    loading,
    getToken,
    signIn,
    signUp,
    signOut,
    confirmSignUp,
    resendConfirmationCode,
    forgotPassword,
    confirmPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { useAuth, AuthContext };
