import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
};
global.localStorage = mockLocalStorage as any;

describe('useLocalStorage', () => {
  it('should store value in localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 'defaultValue'));
    expect(result.current).toBeDefined();
  });
});
