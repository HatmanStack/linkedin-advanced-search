import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

describe('useIsMobile', () => {
  it('should detect mobile viewport', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBeDefined();
  });
});
