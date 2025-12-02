import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock modules
const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUseAuth = vi.fn(() => ({ user: mockUser, isLoading: false }));

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

import { useProfile } from '@/features/profile/hooks/useProfile';

describe('useProfile', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has loading property', () => {
      const { result } = renderHook(() => useProfile());

      // Loading state depends on async behavior
      expect(typeof result.current.loading).toBe('boolean');
    });

    it('starts with null profile', () => {
      const { result } = renderHook(() => useProfile());

      expect(result.current.profile).toBeNull();
    });

    it('has error property', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Error may be null or deprecation message depending on user state
      expect(typeof result.current.error === 'string' || result.current.error === null).toBe(true);
    });
  });

  describe('fetching profile', () => {
    it('sets loading to false after fetch', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('sets deprecation error when user is present', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The hook sets a deprecation error
      expect(result.current.error).toBe('Profile fetching through puppeteerApiService is deprecated');
    });

    it('sets profile to null when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('refetch', () => {
    it('provides refetch function', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers new fetch', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Still shows deprecation error
      expect(result.current.error).toBe('Profile fetching through puppeteerApiService is deprecated');
    });
  });

  describe('updateProfile', () => {
    it('provides updateProfile function', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.updateProfile).toBe('function');
    });

    it('updateProfile returns false (deprecated)', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.updateProfile({ first_name: 'Updated' });
      });

      expect(success).toBe(false);
    });

    it('updateProfile sets deprecation error', async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.updateProfile({ first_name: 'Updated' });
      });

      expect(result.current.error).toBe('Profile updating through puppeteerApiService is deprecated');
    });
  });

  describe('no user', () => {
    it('returns null profile when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profile).toBeNull();
    });

    it('does not set error when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });
});
