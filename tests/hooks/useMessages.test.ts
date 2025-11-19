import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMessages } from '@/hooks/useMessages';

describe('useMessages', () => {
  it('should initialize messages state', () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current).toBeDefined();
  });
});
