import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';

describe('useToast', () => {
  it('should show toast notifications', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current).toBeDefined();
  });
});
