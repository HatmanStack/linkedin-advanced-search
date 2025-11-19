import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnections } from '@/hooks/useConnections';

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
    getConnections: vi.fn(() => Promise.resolve({
      success: true,
      data: { connections: [] }
    })),
    createConnection: vi.fn(() => Promise.resolve({ success: true })),
    updateConnection: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('useConnections', () => {
  it('should initialize connections state', () => {
    const { result } = renderHook(() => useConnections());
    expect(result.current).toBeDefined();
    expect(result.current.connections).toBeDefined();
    expect(result.current.loading).toBeDefined();
  });
});
