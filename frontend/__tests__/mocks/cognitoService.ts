import { vi } from 'vitest';
import type { CognitoUserData } from '@/features/auth/services/cognitoService';

export const mockUser: CognitoUserData = {
  id: 'mock-user-id-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  emailVerified: true,
};

export const mockCognitoService = {
  signUp: vi.fn().mockResolvedValue({ error: null, user: { userSub: 'mock-user-sub' } }),
  signIn: vi.fn().mockResolvedValue({ error: null, user: mockUser }),
  signOut: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getCurrentUserToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  confirmSignUp: vi.fn().mockResolvedValue({ error: null }),
  resendConfirmationCode: vi.fn().mockResolvedValue({ error: null }),
  forgotPassword: vi.fn().mockResolvedValue({ error: null }),
  confirmPassword: vi.fn().mockResolvedValue({ error: null }),
};

export const resetCognitoMocks = () => {
  Object.values(mockCognitoService).forEach((mock) => mock.mockReset());
  mockCognitoService.signUp.mockResolvedValue({ error: null, user: { userSub: 'mock-user-sub' } });
  mockCognitoService.signIn.mockResolvedValue({ error: null, user: mockUser });
  mockCognitoService.signOut.mockResolvedValue(undefined);
  mockCognitoService.getCurrentUser.mockResolvedValue(null);
  mockCognitoService.getCurrentUserToken.mockResolvedValue('mock-jwt-token');
  mockCognitoService.confirmSignUp.mockResolvedValue({ error: null });
  mockCognitoService.resendConfirmationCode.mockResolvedValue({ error: null });
  mockCognitoService.forgotPassword.mockResolvedValue({ error: null });
  mockCognitoService.confirmPassword.mockResolvedValue({ error: null });
};

export const createMockCognitoService = () => ({
  CognitoAuthService: mockCognitoService,
});
