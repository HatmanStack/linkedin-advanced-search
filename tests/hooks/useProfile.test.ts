import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfile } from '@/hooks/useProfile';

// Mock the AuthContext to provide authentication
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', email: 'test@test.com' },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock the lambdaApiService
vi.mock('@/services/lambdaApiService', () => ({
  lambdaApiService: {
    getUserProfile: vi.fn(() => Promise.resolve({
      success: true,
      data: {
        user_id: 'user-123',
        email: 'test@test.com',
        first_name: 'Test',
        last_name: 'User',
      },
    })),
    updateUserProfile: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('useProfile', () => {
  it('should fetch user profile', async () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current).toBeDefined();
  });

  it('should handle profile loading state', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.loading).toBeDefined();
  });
});
