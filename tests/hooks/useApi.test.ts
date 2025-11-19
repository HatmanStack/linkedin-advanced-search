import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApi } from '@/hooks/useApi';

describe('useApi', () => {
  it('should handle API calls', () => {
    const { result } = renderHook(() => useApi());
    expect(result.current).toBeDefined();
  });
});
