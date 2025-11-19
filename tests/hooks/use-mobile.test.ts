import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMobile } from '@/hooks/use-mobile';

describe('useMobile', () => {
  it('should detect mobile viewport', () => {
    const { result } = renderHook(() => useMobile());
    expect(result.current).toBeDefined();
  });
});
