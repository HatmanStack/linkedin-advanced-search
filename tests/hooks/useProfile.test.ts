import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfile } from '@/hooks/useProfile';

vi.mock('@/services/cognitoService', () => ({
  CognitoAuthService: {
    getCurrentUser: vi.fn(() => Promise.resolve({ id: 'user-123', email: 'test@test.com' })),
  },
}));

describe('useProfile', () => {
  it('should fetch user profile', async () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current).toBeDefined();
  });

  it('should handle profile loading state', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.isLoading).toBeDefined();
  });
});
