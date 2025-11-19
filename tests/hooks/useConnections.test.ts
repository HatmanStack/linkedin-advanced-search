import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConnections } from '@/hooks/useConnections';

describe('useConnections', () => {
  it('should initialize connections state', () => {
    const { result } = renderHook(() => useConnections());
    expect(result.current).toBeDefined();
  });
});
