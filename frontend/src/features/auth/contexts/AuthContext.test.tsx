import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Hoisted mocks for CognitoAuthService
const {
  mockGetCurrentUser,
  mockGetCurrentUserToken,
  mockSignIn,
  mockSignUp,
  mockSignOut,
  mockConfirmSignUp,
  mockResendConfirmationCode,
  mockForgotPassword,
  mockConfirmPassword,
  mockIsCognitoConfigured,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentUserToken: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockConfirmSignUp: vi.fn(),
  mockResendConfirmationCode: vi.fn(),
  mockForgotPassword: vi.fn(),
  mockConfirmPassword: vi.fn(),
  mockIsCognitoConfigured: { value: false },
}));

vi.mock('../services/cognitoService', () => ({
  CognitoAuthService: {
    getCurrentUser: mockGetCurrentUser,
    getCurrentUserToken: mockGetCurrentUserToken,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: mockSignOut,
    confirmSignUp: mockConfirmSignUp,
    resendConfirmationCode: mockResendConfirmationCode,
    forgotPassword: mockForgotPassword,
    confirmPassword: mockConfirmPassword,
  },
}));

vi.mock('@/config/appConfig', () => ({
  get isCognitoConfigured() {
    return mockIsCognitoConfigured.value;
  },
  cognitoConfig: {
    userPoolId: 'test-pool',
    userPoolWebClientId: 'test-client',
  },
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import { AuthProvider, useAuth } from './AuthContext';

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockIsCognitoConfigured.value = false;
    mockGetCurrentUser.mockResolvedValue(null);
  });

  describe('useAuth outside provider', () => {
    it('should throw when used outside AuthProvider', () => {
      // Suppress console.error for expected error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
      spy.mockRestore();
    });
  });

  describe('mock mode (Cognito not configured)', () => {
    beforeEach(() => {
      mockIsCognitoConfigured.value = false;
    });

    it('should initialize with no user and finish loading', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should hydrate user from localStorage', async () => {
      const storedUser = {
        id: 'mock-123',
        email: 'test@example.com',
        firstName: 'Demo',
        lastName: 'User',
        emailVerified: true,
      };
      localStorage.setItem('linkedin_advanced_search_user', JSON.stringify(storedUser));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.email).toBe('test@example.com');
    });

    it('should clear invalid stored user', async () => {
      localStorage.setItem('linkedin_advanced_search_user', JSON.stringify({ id: '', email: '' }));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('linkedin_advanced_search_user')).toBeNull();
    });

    it('should clear corrupted stored user', async () => {
      localStorage.setItem('linkedin_advanced_search_user', 'not-json');

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('linkedin_advanced_search_user')).toBeNull();
    });

    it('should sign in with mock user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: { error: unknown };
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password');
      });

      expect(signInResult!.error).toBeNull();
      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.email).toBe('test@example.com');
      expect(localStorage.getItem('linkedin_advanced_search_user')).not.toBeNull();
    });

    it('should reject invalid email on sign in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: { error: unknown };
      await act(async () => {
        signInResult = await result.current.signIn('not-an-email', 'password');
      });

      expect(signInResult!.error).toEqual({ message: 'Invalid email format' });
      expect(result.current.user).toBeNull();
    });

    it('should sign out and clear localStorage', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password');
      });
      expect(result.current.user).not.toBeNull();

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('linkedin_advanced_search_user')).toBeNull();
    });

    it('should return mock token when signed in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password');
      });

      const token = await result.current.getToken();
      expect(token).toBe('mock-jwt-token');
    });

    it('should return null token when not signed in', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const token = await result.current.getToken();
      expect(token).toBeNull();
    });

    it('should sign up with mock user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signUpResult: { error: unknown };
      await act(async () => {
        signUpResult = await result.current.signUp('new@example.com', 'Password1!', 'Jane', 'Doe');
      });

      expect(signUpResult!.error).toBeNull();
      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.email).toBe('new@example.com');
    });

    it('should not expose Cognito-specific methods', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.confirmSignUp).toBeUndefined();
      expect(result.current.resendConfirmationCode).toBeUndefined();
      expect(result.current.forgotPassword).toBeUndefined();
      expect(result.current.confirmPassword).toBeUndefined();
    });
  });

  describe('Cognito mode', () => {
    beforeEach(() => {
      mockIsCognitoConfigured.value = true;
    });

    it('should hydrate user from Cognito session', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'cognito-sub-123',
        email: 'cognito@example.com',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.id).toBe('cognito-sub-123');
      expect(result.current.user!.email).toBe('cognito@example.com');
    });

    it('should handle no existing Cognito session', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should handle Cognito session error gracefully', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should sign in via Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockSignIn.mockResolvedValue({
        error: null,
        user: {
          id: 'cognito-sub-456',
          email: 'user@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          emailVerified: true,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: { error: unknown };
      await act(async () => {
        signInResult = await result.current.signIn('user@example.com', 'Password1!');
      });

      expect(signInResult!.error).toBeNull();
      expect(result.current.user).not.toBeNull();
      expect(result.current.user!.id).toBe('cognito-sub-456');
    });

    it('should return Cognito sign-in error', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockSignIn.mockResolvedValue({
        error: { message: 'Incorrect username or password.', code: 'NotAuthorizedException' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult: { error: { message: string } | null };
      await act(async () => {
        signInResult = await result.current.signIn('user@example.com', 'wrong');
      });

      expect(signInResult!.error).not.toBeNull();
      expect(signInResult!.error!.message).toBe('Incorrect username or password.');
      expect(result.current.user).toBeNull();
    });

    it('should sign out via Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'sub-1',
        email: 'user@example.com',
        firstName: 'Test',
        emailVerified: true,
      });
      mockSignOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should get token from Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockGetCurrentUserToken.mockResolvedValue('real-jwt-token');

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const token = await result.current.getToken();
      expect(token).toBe('real-jwt-token');
    });

    it('should sign up via Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockSignUp.mockResolvedValue({ error: null, user: { id: 'new-sub', email: 'new@example.com' } });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signUpResult: { error: unknown };
      await act(async () => {
        signUpResult = await result.current.signUp('new@example.com', 'Password1!', 'New', 'User');
      });

      expect(signUpResult!.error).toBeNull();
      // Cognito signUp doesn't set user - needs email verification first
      expect(result.current.user).toBeNull();
    });

    it('should expose Cognito-specific methods', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.confirmSignUp).toBeDefined();
      expect(result.current.resendConfirmationCode).toBeDefined();
      expect(result.current.forgotPassword).toBeDefined();
      expect(result.current.confirmPassword).toBeDefined();
    });

    it('should delegate confirmSignUp to Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockConfirmSignUp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let confirmResult: { error: unknown };
      await act(async () => {
        confirmResult = await result.current.confirmSignUp!('test@example.com', '123456');
      });

      expect(confirmResult!.error).toBeNull();
      expect(mockConfirmSignUp).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should delegate forgotPassword to Cognito', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      mockForgotPassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let fpResult: { error: unknown };
      await act(async () => {
        fpResult = await result.current.forgotPassword!('test@example.com');
      });

      expect(fpResult!.error).toBeNull();
      expect(mockForgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });
});
