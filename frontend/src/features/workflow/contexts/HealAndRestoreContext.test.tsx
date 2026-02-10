import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const { mockAddListener, mockRemoveListener, mockStartListening, mockStopListening, mockAuthorize, mockCancel } = vi.hoisted(() => ({
  mockAddListener: vi.fn(),
  mockRemoveListener: vi.fn(),
  mockStartListening: vi.fn(),
  mockStopListening: vi.fn(),
  mockAuthorize: vi.fn(),
  mockCancel: vi.fn(),
}));

vi.mock('@/features/workflow', () => ({
  healAndRestoreService: {
    addListener: mockAddListener,
    removeListener: mockRemoveListener,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    authorizeHealAndRestore: mockAuthorize,
    cancelHealAndRestore: mockCancel,
  },
  HealAndRestoreModal: () => null, // Stub the modal component
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { HealAndRestoreProvider, useHealAndRestore } from './HealAndRestoreContext';

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <HealAndRestoreProvider>{children}</HealAndRestoreProvider>
  );
}

describe('HealAndRestoreContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useHealAndRestore())).toThrow(
      'useHealAndRestore must be used within a HealAndRestoreProvider',
    );
    spy.mockRestore();
  });

  it('should register listener on mount', () => {
    renderHook(() => useHealAndRestore(), { wrapper: createWrapper() });

    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(mockAddListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should unregister listener and stop listening on unmount', () => {
    const { unmount } = renderHook(() => useHealAndRestore(), { wrapper: createWrapper() });

    unmount();

    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
    expect(mockStopListening).toHaveBeenCalledTimes(1);
  });

  it('should initialize with isListening false', () => {
    const { result } = renderHook(() => useHealAndRestore(), { wrapper: createWrapper() });

    expect(result.current.isListening).toBe(false);
  });

  describe('startListening / stopListening', () => {
    it('should delegate to service and update state', () => {
      const { result } = renderHook(() => useHealAndRestore(), { wrapper: createWrapper() });

      act(() => {
        result.current.startListening();
      });

      expect(mockStartListening).toHaveBeenCalled();
      expect(result.current.isListening).toBe(true);

      act(() => {
        result.current.stopListening();
      });

      expect(mockStopListening).toHaveBeenCalled();
      expect(result.current.isListening).toBe(false);
    });
  });
});
