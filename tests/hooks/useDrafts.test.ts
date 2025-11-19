import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDrafts } from '@/hooks/useDrafts';

describe('useDrafts', () => {
  it('should manage draft state', () => {
    const { result } = renderHook(() => useDrafts());
    expect(result.current).toBeDefined();
  });
});
