import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitoAuthService } from '@/services/cognitoService';

const mockSignUp = vi.fn();
const mockAuthenticateUser = vi.fn();
const mockGetSession = vi.fn();
const mockGetUserAttributes = vi.fn();
const mockConfirmRegistration = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/config/appConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/appConfig')>();
  return {
    ...actual,
    cognitoConfig: {
      region: 'us-west-2',
      userPoolId: 'test-pool',
      userPoolWebClientId: 'test-client',
      identityPoolId: 'test-identity',
    },
  };
});

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: class {
    signUp = mockSignUp;
    getCurrentUser = mockGetCurrentUser;
  },
  CognitoUser: class {
    authenticateUser = mockAuthenticateUser;
    getSession = mockGetSession;
    getUserAttributes = mockGetUserAttributes;
    confirmRegistration = mockConfirmRegistration;
    signOut = vi.fn();
  },
  CognitoUserAttribute: class {
    constructor(public data: any) {}
  },
  AuthenticationDetails: class {
    constructor(public data: any) {}
  },
}));

describe('CognitoAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUp', () => {
    it('should sign up new user successfully', async () => {
      mockSignUp.mockImplementation((email, pw, attrs, vd, cb) => {
        cb(null, { userSub: 'sub-123', user: { getUsername: () => email } });
      });

      const result = await CognitoAuthService.signUp('test@test.com', 'Pass123!');
      expect(result.error).toBeNull();
      expect(result.user?.id).toBe('sub-123');
    });

    it('should handle sign up error', async () => {
      mockSignUp.mockImplementation((email, pw, attrs, vd, cb) => {
        cb({ message: 'User exists' }, null);
      });

      const result = await CognitoAuthService.signUp('test@test.com', 'Pass123!');
      expect(result.error?.message).toBe('User exists');
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockSession = {
        getIdToken: () => ({ payload: { sub: 'user-123' } }),
        isValid: () => true,
      };

      mockAuthenticateUser.mockImplementation((details, callbacks) => {
        callbacks.onSuccess(mockSession);
      });

      mockGetUserAttributes.mockImplementation((cb) => {
        cb(null, [
          { getName: () => 'email', getValue: () => 'test@test.com' },
          { getName: () => 'email_verified', getValue: () => 'true' },
        ]);
      });

      const result = await CognitoAuthService.signIn('test@test.com', 'Pass123!');
      expect(result.error).toBeNull();
      expect(result.user?.id).toBe('user-123');
    });

    it('should handle sign in failure', async () => {
      mockAuthenticateUser.mockImplementation((details, callbacks) => {
        callbacks.onFailure({ message: 'Wrong password' });
      });

      const result = await CognitoAuthService.signIn('test@test.com', 'wrong');
      expect(result.error?.message).toBe('Wrong password');
    });
  });

  describe('getCurrentUserToken', () => {
    it('should return JWT token', async () => {
      const mockUser = {
        getSession: (cb: any) => cb(null, {
          isValid: () => true,
          getIdToken: () => ({ getJwtToken: () => 'jwt-token-123' }),
        }),
      };

      mockGetCurrentUser.mockReturnValue(mockUser);

      const token = await CognitoAuthService.getCurrentUserToken();
      expect(token).toBe('jwt-token-123');
    });

    it('should return null when no user', async () => {
      mockGetCurrentUser.mockReturnValue(null);
      const token = await CognitoAuthService.getCurrentUserToken();
      expect(token).toBeNull();
    });
  });
});
