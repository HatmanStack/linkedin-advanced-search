import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/appConfig', () => ({
  cognitoConfig: {
    userPoolId: 'test-pool-id',
    userPoolWebClientId: 'test-client-id',
  },
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  }),
}));

const mockAuthenticateUser = vi.fn();
const mockGetUserAttributes = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockConfirmRegistration = vi.fn();
const mockResendConfirmationCode = vi.fn();
const mockForgotPassword = vi.fn();
const mockConfirmPassword = vi.fn();
const mockCompleteNewPasswordChallenge = vi.fn();
const mockSignUp = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: vi.fn(() => ({
    signUp: (...args: unknown[]) => mockSignUp(...args),
    getCurrentUser: () => mockGetCurrentUser(),
  })),
  CognitoUser: vi.fn(() => ({
    authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
    getUserAttributes: (...args: unknown[]) => mockGetUserAttributes(...args),
    signOut: () => mockSignOut(),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    confirmRegistration: (...args: unknown[]) => mockConfirmRegistration(...args),
    resendConfirmationCode: (...args: unknown[]) => mockResendConfirmationCode(...args),
    forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
    confirmPassword: (...args: unknown[]) => mockConfirmPassword(...args),
    completeNewPasswordChallenge: (...args: unknown[]) => mockCompleteNewPasswordChallenge(...args),
  })),
  AuthenticationDetails: vi.fn(),
  CognitoUserAttribute: vi.fn((data: { Name: string; Value: string }) => ({
    getName: () => data.Name,
    getValue: () => data.Value,
  })),
}));

import { CognitoAuthService } from '@/features/auth/services/cognitoService';

describe('CognitoAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockReturnValue(null);
  });

  const createMockSession = (sub = 'user-sub-123') => ({
    getIdToken: () => ({
      payload: { sub },
      getJwtToken: () => 'mock-jwt-token',
    }),
    isValid: () => true,
  });

  const createMockAttributes = (attrs: Record<string, string> = {}) => {
    const defaultAttrs = {
      email: 'test@example.com',
      given_name: 'Test',
      family_name: 'User',
      email_verified: 'true',
      ...attrs,
    };

    return Object.entries(defaultAttrs).map(([name, value]) => ({
      getName: () => name,
      getValue: () => value,
    }));
  };

  describe('signUp', () => {
    it('signs up successfully', async () => {
      const mockResult = { userSub: 'new-user-sub' };
      mockSignUp.mockImplementation(
        (_email: string, _password: string, _attrs: unknown[], _validation: unknown[], callback: (err: Error | null, result?: unknown) => void) => {
          callback(null, mockResult);
        }
      );

      const result = await CognitoAuthService.signUp(
        'new@example.com',
        'password123',
        'John',
        'Doe'
      );

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(mockSignUp).toHaveBeenCalled();
    });

    it('returns error on sign up failure', async () => {
      mockSignUp.mockImplementation(
        (_email: string, _password: string, _attrs: unknown[], _validation: unknown[], callback: (err: Error | null) => void) => {
          callback(new Error('User already exists'));
        }
      );

      const result = await CognitoAuthService.signUp('existing@example.com', 'password123');

      expect(result.error).toEqual({ message: 'User already exists' });
      expect(result.user).toBeUndefined();
    });
  });

  describe('signIn', () => {
    it('signs in successfully', async () => {
      const mockSession = createMockSession();
      const mockAttributes = createMockAttributes();

      mockAuthenticateUser.mockImplementation((_details: unknown, callbacks: { onSuccess: (session: unknown) => void }) => {
        callbacks.onSuccess(mockSession);
      });

      mockGetUserAttributes.mockImplementation((callback: (err: Error | null, attrs: unknown[]) => void) => {
        callback(null, mockAttributes);
      });

      const result = await CognitoAuthService.signIn('test@example.com', 'password123');

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('test@example.com');
      expect(result.user?.firstName).toBe('Test');
      expect(result.user?.lastName).toBe('User');
    });

    it('returns error on authentication failure', async () => {
      mockAuthenticateUser.mockImplementation((_details: unknown, callbacks: { onFailure: (err: Error & { code?: string }) => void }) => {
        const error = new Error('Incorrect username or password') as Error & { code?: string };
        error.code = 'NotAuthorizedException';
        callbacks.onFailure(error);
      });

      const result = await CognitoAuthService.signIn('test@example.com', 'wrong-password');

      expect(result.error).toEqual({
        message: 'Incorrect username or password',
        code: 'NotAuthorizedException',
      });
      expect(result.user).toBeUndefined();
    });

    it('handles newPasswordRequired challenge', async () => {
      const mockSession = createMockSession();
      const mockAttributes = createMockAttributes();

      mockAuthenticateUser.mockImplementation((_details: unknown, callbacks: { newPasswordRequired: (attrs: Record<string, string>) => void }) => {
        callbacks.newPasswordRequired({ email: 'test@example.com' });
      });

      mockCompleteNewPasswordChallenge.mockImplementation(
        (_password: string, _attrs: unknown, callbacks: { onSuccess: (session: unknown) => void }) => {
          callbacks.onSuccess(mockSession);
        }
      );

      mockGetUserAttributes.mockImplementation((callback: (err: Error | null, attrs: unknown[]) => void) => {
        callback(null, mockAttributes);
      });

      const result = await CognitoAuthService.signIn('test@example.com', 'password123');

      expect(result.error).toBeNull();
      expect(result.user).toBeDefined();
      expect(mockCompleteNewPasswordChallenge).toHaveBeenCalled();
    });

    it('returns error when getUserAttributes fails', async () => {
      const mockSession = createMockSession();

      mockAuthenticateUser.mockImplementation((_details: unknown, callbacks: { onSuccess: (session: unknown) => void }) => {
        callbacks.onSuccess(mockSession);
      });

      mockGetUserAttributes.mockImplementation((callback: (err: Error) => void) => {
        callback(new Error('Failed to get attributes'));
      });

      const result = await CognitoAuthService.signIn('test@example.com', 'password123');

      expect(result.error).toEqual({ message: 'Failed to get attributes' });
    });
  });

  describe('signOut', () => {
    it('signs out current user', async () => {
      mockGetCurrentUser.mockReturnValue({ signOut: mockSignOut });

      await CognitoAuthService.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('does nothing when no user is signed in', async () => {
      mockGetCurrentUser.mockReturnValue(null);

      await CognitoAuthService.signOut();

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns current user when session is valid', async () => {
      const mockSession = createMockSession();
      const mockAttributes = createMockAttributes();

      mockGetCurrentUser.mockReturnValue({
        getSession: mockGetSession,
        getUserAttributes: mockGetUserAttributes,
      });

      mockGetSession.mockImplementation((callback: (err: Error | null, session: unknown) => void) => {
        callback(null, mockSession);
      });

      mockGetUserAttributes.mockImplementation((callback: (err: Error | null, attrs: unknown[]) => void) => {
        callback(null, mockAttributes);
      });

      const user = await CognitoAuthService.getCurrentUser();

      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');
    });

    it('returns null when no user is logged in', async () => {
      mockGetCurrentUser.mockReturnValue(null);

      const user = await CognitoAuthService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('returns null when session is invalid', async () => {
      mockGetCurrentUser.mockReturnValue({
        getSession: mockGetSession,
      });

      mockGetSession.mockImplementation((callback: (err: Error | null, session: { isValid: () => boolean }) => void) => {
        callback(null, { isValid: () => false });
      });

      const user = await CognitoAuthService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('returns null when getSession fails', async () => {
      mockGetCurrentUser.mockReturnValue({
        getSession: mockGetSession,
      });

      mockGetSession.mockImplementation((callback: (err: Error) => void) => {
        callback(new Error('Session error'));
      });

      const user = await CognitoAuthService.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('getCurrentUserToken', () => {
    it('returns JWT token when session is valid', async () => {
      const mockSession = createMockSession();

      mockGetCurrentUser.mockReturnValue({
        getSession: mockGetSession,
      });

      mockGetSession.mockImplementation((callback: (err: Error | null, session: unknown) => void) => {
        callback(null, mockSession);
      });

      const token = await CognitoAuthService.getCurrentUserToken();

      expect(token).toBe('mock-jwt-token');
    });

    it('returns null when no user is logged in', async () => {
      mockGetCurrentUser.mockReturnValue(null);

      const token = await CognitoAuthService.getCurrentUserToken();

      expect(token).toBeNull();
    });

    it('returns null when session is invalid', async () => {
      mockGetCurrentUser.mockReturnValue({
        getSession: mockGetSession,
      });

      mockGetSession.mockImplementation((callback: (err: Error | null, session: { isValid: () => boolean }) => void) => {
        callback(null, { isValid: () => false });
      });

      const token = await CognitoAuthService.getCurrentUserToken();

      expect(token).toBeNull();
    });
  });

  describe('confirmSignUp', () => {
    it('confirms sign up successfully', async () => {
      mockConfirmRegistration.mockImplementation(
        (_code: string, _forceAlias: boolean, callback: (err: Error | null) => void) => {
          callback(null);
        }
      );

      const result = await CognitoAuthService.confirmSignUp('test@example.com', '123456');

      expect(result.error).toBeNull();
      expect(mockConfirmRegistration).toHaveBeenCalledWith('123456', true, expect.any(Function));
    });

    it('returns error on confirmation failure', async () => {
      mockConfirmRegistration.mockImplementation(
        (_code: string, _forceAlias: boolean, callback: (err: Error) => void) => {
          callback(new Error('Invalid code'));
        }
      );

      const result = await CognitoAuthService.confirmSignUp('test@example.com', 'wrong-code');

      expect(result.error).toEqual({ message: 'Invalid code' });
    });
  });

  describe('resendConfirmationCode', () => {
    it('resends code successfully', async () => {
      mockResendConfirmationCode.mockImplementation((callback: (err: Error | null) => void) => {
        callback(null);
      });

      const result = await CognitoAuthService.resendConfirmationCode('test@example.com');

      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockResendConfirmationCode.mockImplementation((callback: (err: Error) => void) => {
        callback(new Error('Too many requests'));
      });

      const result = await CognitoAuthService.resendConfirmationCode('test@example.com');

      expect(result.error).toEqual({ message: 'Too many requests' });
    });
  });

  describe('forgotPassword', () => {
    it('initiates forgot password successfully', async () => {
      mockForgotPassword.mockImplementation((callbacks: { onSuccess: () => void }) => {
        callbacks.onSuccess();
      });

      const result = await CognitoAuthService.forgotPassword('test@example.com');

      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      mockForgotPassword.mockImplementation((callbacks: { onFailure: (err: Error) => void }) => {
        callbacks.onFailure(new Error('User not found'));
      });

      const result = await CognitoAuthService.forgotPassword('unknown@example.com');

      expect(result.error).toEqual({ message: 'User not found' });
    });
  });

  describe('confirmPassword', () => {
    it('confirms password reset successfully', async () => {
      mockConfirmPassword.mockImplementation((_code: string, _newPassword: string, callbacks: { onSuccess: () => void }) => {
        callbacks.onSuccess();
      });

      const result = await CognitoAuthService.confirmPassword(
        'test@example.com',
        '123456',
        'newPassword123'
      );

      expect(result.error).toBeNull();
      expect(mockConfirmPassword).toHaveBeenCalledWith(
        '123456',
        'newPassword123',
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onFailure: expect.any(Function),
        })
      );
    });

    it('returns error on failure', async () => {
      mockConfirmPassword.mockImplementation(
        (_code: string, _newPassword: string, callbacks: { onFailure: (err: Error) => void }) => {
          callbacks.onFailure(new Error('Invalid code'));
        }
      );

      const result = await CognitoAuthService.confirmPassword(
        'test@example.com',
        'wrong-code',
        'newPassword123'
      );

      expect(result.error).toEqual({ message: 'Invalid code' });
    });
  });
});
