import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfileInit } from '@/features/profile';

describe('useProfileInit', () => {
  it('should initialize profile', () => {
    const { result } = renderHook(() => useProfileInit());
    expect(result.current).toBeDefined();
  });
});
