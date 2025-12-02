import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock modules
const mockGetUserProfile = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUseAuth = vi.fn(() => ({ user: mockUser, isLoading: false }));

vi.mock('@/features/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/shared/services', () => ({
  lambdaApiService: {
    getUserProfile: () => mockGetUserProfile(),
    updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  },
}));

import { UserProfileProvider, useUserProfile } from '@/features/profile/contexts/UserProfileContext';

describe('UserProfileContext', () => {
  beforeEach(() => {
    mockGetUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false });
    sessionStorage.clear();

    // Default successful response
    mockGetUserProfile.mockResolvedValue({
      success: true,
      data: {
        id: 'profile-1',
        email: 'test@example.com',
        linkedin_credentials: null,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <UserProfileProvider>{children}</UserProfileProvider>
  );

  describe('useUserProfile hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useUserProfile());
      }).toThrow('useUserProfile must be used within a UserProfileProvider');
    });

    it('provides context when used inside provider', () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current.setCiphertext).toBe('function');
      expect(typeof result.current.updateUserProfile).toBe('function');
      expect(typeof result.current.refreshUserProfile).toBe('function');
    });
  });

  describe('initial state', () => {
    it('starts with null ciphertext', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      expect(result.current.ciphertext).toBeNull();
    });

    it('starts with null userProfile', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      expect(result.current.userProfile).toBeNull();
    });

    it('has isLoading property', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      // isLoading may be true or false depending on whether fetch has started
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  describe('profile loading', () => {
    it('fetches profile on mount when user is present', async () => {
      renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(mockGetUserProfile).toHaveBeenCalled();
      });
    });

    it('does not fetch profile when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      renderHook(() => useUserProfile(), { wrapper });

      // Wait a bit to ensure no calls happen
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGetUserProfile).not.toHaveBeenCalled();
    });

    it('populates userProfile on successful fetch', async () => {
      const profileData = {
        id: 'profile-1',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockGetUserProfile.mockResolvedValueOnce({
        success: true,
        data: profileData,
      });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.userProfile).toEqual(profileData);
      });
    });

    it('stores linkedin_credentials as ciphertext on fetch', async () => {
      const credentials = 'sealbox_x25519:b64:testcredentials';
      mockGetUserProfile.mockResolvedValueOnce({
        success: true,
        data: {
          id: 'profile-1',
          email: 'test@example.com',
          linkedin_credentials: credentials,
        },
      });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.ciphertext).toBe(credentials);
      });
    });

    it('handles fetch error gracefully', async () => {
      mockGetUserProfile.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not crash, profile remains null
      expect(result.current.userProfile).toBeNull();
    });
  });

  describe('setCiphertext', () => {
    it('updates ciphertext value', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const credentials = 'sealbox_x25519:b64:newcredentials';

      act(() => {
        result.current.setCiphertext(credentials);
      });

      expect(result.current.ciphertext).toBe(credentials);
    });

    it('stores valid credentials in sessionStorage', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const credentials = 'sealbox_x25519:b64:newcredentials';

      act(() => {
        result.current.setCiphertext(credentials);
      });

      expect(sessionStorage.getItem('li_credentials_ciphertext')).toBe(credentials);
    });

    it('removes sessionStorage entry when ciphertext is null', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      // First set a value
      act(() => {
        result.current.setCiphertext('sealbox_x25519:b64:test');
      });

      // Then clear it
      act(() => {
        result.current.setCiphertext(null);
      });

      expect(sessionStorage.getItem('li_credentials_ciphertext')).toBeNull();
    });

    it('removes sessionStorage for invalid prefix', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      act(() => {
        result.current.setCiphertext('invalid_prefix:test');
      });

      expect(sessionStorage.getItem('li_credentials_ciphertext')).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('calls API with updates', async () => {
      mockUpdateUserProfile.mockResolvedValueOnce({ success: true });
      mockGetUserProfile.mockResolvedValue({
        success: true,
        data: { id: 'profile-1', email: 'test@example.com', first_name: 'Updated' },
      });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateUserProfile({ first_name: 'Updated' });
      });

      expect(mockUpdateUserProfile).toHaveBeenCalledWith({ first_name: 'Updated' });
    });

    it('refreshes profile after successful update', async () => {
      mockUpdateUserProfile.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
      });

      mockGetUserProfile.mockClear();

      await act(async () => {
        await result.current.updateUserProfile({ first_name: 'Updated' });
      });

      expect(mockGetUserProfile).toHaveBeenCalled();
    });

    it('throws error on failed update', async () => {
      mockUpdateUserProfile.mockResolvedValueOnce({
        success: false,
        error: 'Update failed',
      });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updateUserProfile({ first_name: 'Updated' });
        })
      ).rejects.toThrow('Update failed');
    });

    it('does nothing when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await act(async () => {
        await result.current.updateUserProfile({ first_name: 'Updated' });
      });

      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('refreshUserProfile', () => {
    it('triggers a new API call', async () => {
      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
      });

      mockGetUserProfile.mockClear();

      await act(async () => {
        await result.current.refreshUserProfile();
      });

      expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('sessionStorage hydration', () => {
    it('loads credentials from sessionStorage on mount', async () => {
      const storedCredentials = 'sealbox_x25519:b64:storedcreds';
      sessionStorage.setItem('li_credentials_ciphertext', storedCredentials);

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.ciphertext).toBe(storedCredentials);
      });
    });

    it('ignores invalid credentials in sessionStorage', async () => {
      sessionStorage.setItem('li_credentials_ciphertext', 'invalid_format');

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not load invalid credentials
      expect(result.current.ciphertext).toBeNull();
    });
  });
});
