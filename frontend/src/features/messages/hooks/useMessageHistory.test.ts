import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Message } from '@/types';

// Mock cognito service to prevent UserPool init error
vi.mock('@/features/auth/services/cognitoService', () => ({
  default: {
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    getToken: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, signIn: vi.fn(), signOut: vi.fn() }),
  CognitoAuthService: { getToken: vi.fn().mockResolvedValue(null) },
}));

import { useMessageHistory } from './useMessageHistory';

describe('useMessageHistory', () => {
  it('starts with empty messages', () => {
    const { result } = renderHook(() => useMessageHistory());

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches history for connection', async () => {
    const { result } = renderHook(() => useMessageHistory());

    await act(async () => {
      await result.current.fetchHistory('conn-1');
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Currently returns empty (matches original behavior)
    expect(result.current.messages).toEqual([]);
  });

  it('clears messages when connection is null', async () => {
    const { result } = renderHook(() => useMessageHistory());

    // Add a message first
    const testMessage: Message = {
      id: 'msg-1',
      content: 'Hello',
      timestamp: new Date().toISOString(),
      sender: 'user',
    };

    act(() => {
      result.current.addMessage(testMessage);
    });

    expect(result.current.messages.length).toBe(1);

    // Fetch with null clears
    await act(async () => {
      await result.current.fetchHistory(null);
    });

    expect(result.current.messages).toEqual([]);
  });

  it('adds message to history', () => {
    const { result } = renderHook(() => useMessageHistory());

    const testMessage: Message = {
      id: 'msg-1',
      content: 'Hello',
      timestamp: new Date().toISOString(),
      sender: 'user',
    };

    act(() => {
      result.current.addMessage(testMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello');
  });

  it('clears history', () => {
    const { result } = renderHook(() => useMessageHistory());

    const testMessage: Message = {
      id: 'msg-1',
      content: 'Hello',
      timestamp: new Date().toISOString(),
      sender: 'user',
    };

    act(() => {
      result.current.addMessage(testMessage);
    });

    expect(result.current.messages.length).toBe(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
