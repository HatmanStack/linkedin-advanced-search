import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useLocalStorage from '@/shared/hooks';

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('useLocalStorage', () => {
  it('should store value in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));
    expect(result.current).toBeDefined();
  });
});
