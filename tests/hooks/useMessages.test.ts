import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMessages } from '@/features/messages';
import { AllTheProviders } from '../utils/testHelpers';

// Mock puppeteerApiService
vi.mock('@/services/puppeteerApiService', () => ({
  puppeteerApiService: {
    getMessages: vi.fn(() => Promise.resolve({
      success: true,
      data: { messages: [] }
    })),
    createMessage: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

describe('useMessages', () => {
  it('should initialize messages state', () => {
    const { result } = renderHook(() => useMessages(), {
      wrapper: AllTheProviders
    });
    expect(result.current).toBeDefined();
    expect(result.current.messages).toBeDefined();
    expect(result.current.loading).toBeDefined();
  });
});
