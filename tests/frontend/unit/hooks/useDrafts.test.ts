import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrafts } from '@/features/posts';
import { AllTheProviders } from '../utils/testHelpers';

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
    const { result } = renderHook(() => useDrafts(), {
      wrapper: AllTheProviders
    });
    expect(result.current).toBeDefined();
    expect(result.current.drafts).toBeDefined();
    expect(result.current.loading).toBeDefined();
  });
});
