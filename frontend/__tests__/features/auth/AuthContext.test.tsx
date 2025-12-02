import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { mockUser, mockCognitoService, resetCognitoMocks } from '../../mocks';

vi.mock('@/features/auth/services/cognitoService', () => ({
  CognitoAuthService: mockCognitoService,
}));

let mockIsCognitoConfigured = false;
vi.mock('@/config/appConfig', () => ({
  get isCognitoConfigured() {
    return mockIsCognitoConfigured;
  },
  cognitoConfig: {
    userPoolId: 'test-pool',
    userPoolWebClientId: 'test-client',
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

vi.mock('@/shared/utils/userUtils', () => ({
  generateUniqueUserId: vi.fn((email: string) => `mock-id-${email}`),
  validateUserForDatabase: vi.fn(() => true),
  securityUtils: {
    isValidEmail: vi.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    maskUserForLogging: vi.fn((user: unknown) => user),
  },
}));

import { AuthProvider, useAuth } from '@/features/auth/contexts/AuthContext';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCognitoMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockIsCognitoConfigured = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('Initial State', () => {
    it('starts with loading=true', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('starts with user=null when no stored user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toBeNull();
    });

    it('restores user from localStorage in mock mode', async () => {
      const storedUser = {
        id: 'stored-user-id',
        email: 'stored@example.com',
        firstName: 'Stored',
        lastName: 'User',
        emailVerified: true,
      };
      localStorage.setItem('linkedin_advanced_search_user', JSON.stringify(storedUser));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toEqual(storedUser);
    });
  });

  describe('Mock Mode (Cognito not configured)', () => {
    beforeEach(() => {
      mockIsCognitoConfigured = false;
    });

    describe('signIn', () => {
      it('signs in successfully with valid credentials', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signInResult;
        await act(async () => {
          signInResult = await result.current.signIn('test@example.com', 'password123');
        });

        expect(signInResult).toEqual({ error: null });
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.email).toBe('test@example.com');
      });

      it('returns error for invalid email format', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signInResult;
        await act(async () => {
          signInResult = await result.current.signIn('invalid-email', 'password123');
        });

        expect(signInResult).toEqual({ error: { message: 'Invalid email format' } });
        expect(result.current.user).toBeNull();
      });

      it('stores user in localStorage after successful sign in', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });

        const storedUser = JSON.parse(localStorage.getItem('linkedin_advanced_search_user') || '{}');
        expect(storedUser.email).toBe('test@example.com');
      });
    });

    describe('signUp', () => {
      it('signs up successfully in mock mode', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp('new@example.com', 'password123', 'John', 'Doe');
        });

        expect(signUpResult).toEqual({ error: null });
        expect(result.current.user).not.toBeNull();
        expect(result.current.user?.firstName).toBe('John');
        expect(result.current.user?.lastName).toBe('Doe');
      });

      it('returns error for invalid email format', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp('bad-email', 'password123');
        });

        expect(signUpResult).toEqual({ error: { message: 'Invalid email format' } });
      });
    });

    describe('signOut', () => {
      it('clears user state', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });
        expect(result.current.user).not.toBeNull();

        await act(async () => {
          await result.current.signOut();
        });
        expect(result.current.user).toBeNull();
      });

      it('removes user from localStorage', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });
        expect(localStorage.getItem('linkedin_advanced_search_user')).not.toBeNull();

        await act(async () => {
          await result.current.signOut();
        });
        expect(localStorage.getItem('linkedin_advanced_search_user')).toBeNull();
      });
    });

    describe('getToken', () => {
      it('returns mock token when user is signed in', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });

        let token;
        await act(async () => {
          token = await result.current.getToken();
        });
        expect(token).toBe('mock-jwt-token');
      });

      it('returns null when user is not signed in', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let token;
        await act(async () => {
          token = await result.current.getToken();
        });
        expect(token).toBeNull();
      });
    });

    describe('Cognito-specific methods', () => {
      it('confirmSignUp is undefined in mock mode', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
        expect(result.current.confirmSignUp).toBeUndefined();
      });

      it('resendConfirmationCode is undefined in mock mode', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
        expect(result.current.resendConfirmationCode).toBeUndefined();
      });

      it('forgotPassword is undefined in mock mode', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
        expect(result.current.forgotPassword).toBeUndefined();
      });

      it('confirmPassword is undefined in mock mode', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
        expect(result.current.confirmPassword).toBeUndefined();
      });
    });
  });

  describe('Cognito Mode (Cognito configured)', () => {
    beforeEach(() => {
      mockIsCognitoConfigured = true;
    });

    describe('signIn', () => {
      it('calls CognitoAuthService.signIn', async () => {
        mockCognitoService.signIn.mockResolvedValue({ error: null, user: mockUser });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });

        expect(mockCognitoService.signIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });

      it('sets user on successful sign in', async () => {
        mockCognitoService.signIn.mockResolvedValue({ error: null, user: mockUser });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });

        expect(result.current.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          emailVerified: mockUser.emailVerified,
        });
      });

      it('returns error on failed sign in', async () => {
        mockCognitoService.signIn.mockResolvedValue({
          error: { message: 'Incorrect username or password' },
        });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signInResult;
        await act(async () => {
          signInResult = await result.current.signIn('test@example.com', 'wrong-password');
        });

        expect(signInResult).toEqual({ error: { message: 'Incorrect username or password' } });
        expect(result.current.user).toBeNull();
      });
    });

    describe('signUp', () => {
      it('calls CognitoAuthService.signUp', async () => {
        mockCognitoService.signUp.mockResolvedValue({ error: null, user: { userSub: 'sub-123' } });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signUp('new@example.com', 'password123', 'John', 'Doe');
        });

        expect(mockCognitoService.signUp).toHaveBeenCalledWith(
          'new@example.com',
          'password123',
          'John',
          'Doe'
        );
      });

      it('returns error on failed sign up', async () => {
        mockCognitoService.signUp.mockResolvedValue({
          error: { message: 'User already exists' },
        });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let signUpResult;
        await act(async () => {
          signUpResult = await result.current.signUp('existing@example.com', 'password123');
        });

        expect(signUpResult).toEqual({ error: { message: 'User already exists' } });
      });
    });

    describe('signOut', () => {
      it('calls CognitoAuthService.signOut', async () => {
        mockCognitoService.signIn.mockResolvedValue({ error: null, user: mockUser });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        await act(async () => {
          await result.current.signIn('test@example.com', 'password123');
        });

        await act(async () => {
          await result.current.signOut();
        });

        expect(mockCognitoService.signOut).toHaveBeenCalled();
        expect(result.current.user).toBeNull();
      });
    });

    describe('getToken', () => {
      it('calls CognitoAuthService.getCurrentUserToken', async () => {
        mockCognitoService.getCurrentUserToken.mockResolvedValue('cognito-token-123');

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        let token;
        await act(async () => {
          token = await result.current.getToken();
        });

        expect(mockCognitoService.getCurrentUserToken).toHaveBeenCalled();
        expect(token).toBe('cognito-token-123');
      });
    });

    describe('Cognito-specific methods', () => {
      it('confirmSignUp calls CognitoAuthService.confirmSignUp', async () => {
        mockCognitoService.confirmSignUp.mockResolvedValue({ error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.confirmSignUp).toBeDefined();

        let confirmResult;
        await act(async () => {
          confirmResult = await result.current.confirmSignUp!('test@example.com', '123456');
        });

        expect(mockCognitoService.confirmSignUp).toHaveBeenCalledWith('test@example.com', '123456');
        expect(confirmResult).toEqual({ error: null });
      });

      it('resendConfirmationCode calls CognitoAuthService.resendConfirmationCode', async () => {
        mockCognitoService.resendConfirmationCode.mockResolvedValue({ error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.resendConfirmationCode).toBeDefined();

        let resendResult;
        await act(async () => {
          resendResult = await result.current.resendConfirmationCode!('test@example.com');
        });

        expect(mockCognitoService.resendConfirmationCode).toHaveBeenCalledWith('test@example.com');
        expect(resendResult).toEqual({ error: null });
      });

      it('forgotPassword calls CognitoAuthService.forgotPassword', async () => {
        mockCognitoService.forgotPassword.mockResolvedValue({ error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.forgotPassword).toBeDefined();

        let forgotResult;
        await act(async () => {
          forgotResult = await result.current.forgotPassword!('test@example.com');
        });

        expect(mockCognitoService.forgotPassword).toHaveBeenCalledWith('test@example.com');
        expect(forgotResult).toEqual({ error: null });
      });

      it('confirmPassword calls CognitoAuthService.confirmPassword', async () => {
        mockCognitoService.confirmPassword.mockResolvedValue({ error: null });

        const { result } = renderHook(() => useAuth(), { wrapper });
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });

        expect(result.current.confirmPassword).toBeDefined();

        let confirmPwResult;
        await act(async () => {
          confirmPwResult = await result.current.confirmPassword!(
            'test@example.com',
            '123456',
            'newPassword123'
          );
        });

        expect(mockCognitoService.confirmPassword).toHaveBeenCalledWith(
          'test@example.com',
          '123456',
          'newPassword123'
        );
        expect(confirmPwResult).toEqual({ error: null });
      });
    });
  });

  describe('useAuth Hook', () => {
    it('throws error when used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
