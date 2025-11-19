import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnections } from '@/features/connections';
import { AllTheProviders } from '../utils/testHelpers';

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
    const { result } = renderHook(() => useConnections(), {
      wrapper: AllTheProviders
    });
    expect(result.current).toBeDefined();
    expect(result.current.connections).toBeDefined();
    expect(result.current.loading).toBeDefined();
  });
});
