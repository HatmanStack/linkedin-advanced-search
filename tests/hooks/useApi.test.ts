import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useApi from '@/shared/hooks';

describe('useApi', () => {
  it('should handle API calls', () => {
    const mockApiFunction = vi.fn().mockResolvedValue({ data: 'test' });
    const { result } = renderHook(() => useApi(mockApiFunction));
    expect(result.current).toBeDefined();
    expect(result.current.execute).toBeDefined();
    expect(result.current.reset).toBeDefined();
  });
});
