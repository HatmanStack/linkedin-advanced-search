import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrafts } from '@/hooks/useDrafts';

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', email: 'test@test.com' },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

// Mock puppeteerApiService
vi.mock('@/services/puppeteerApiService', () => ({
  puppeteerApiService: {
    getDrafts: vi.fn(() => Promise.resolve({
      success: true,
      data: []
    })),
    createDraft: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('useDrafts', () => {
  it('should manage draft state', () => {
    const { result } = renderHook(() => useDrafts());
    expect(result.current).toBeDefined();
    expect(result.current.drafts).toBeDefined();
    expect(result.current.loading).toBeDefined();
  });
});
