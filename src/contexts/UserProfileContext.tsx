// src/contexts/UserProfileContext.tsx
import { createContext, useState, useContext, type ReactNode, useMemo, useEffect } from 'react';
import { lambdaApiService } from '@/services/lambdaApiService';
import { useAuth } from '@/contexts/AuthContext';

type LinkedInCredentialsCiphertext = string | null; // sealbox_x25519:b64:<...>

import type { UserProfile } from '@/types';

interface UserProfileContextType {
  // LinkedIn credentials
  ciphertext: LinkedInCredentialsCiphertext;
  setCiphertext: (ciphertext: LinkedInCredentialsCiphertext) => void;
  
  // General user profile
  userProfile: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  
  // Loading states
  isLoading: boolean;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [ciphertext, setCiphertextState] = useState<LinkedInCredentialsCiphertext>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Avoid redundant fetches within a single session
  // This ensures we fetch once (e.g., from Dashboard) and reuse across the app
  let fetchedFlag = false;

  // Fetch user profile from API
  const fetchUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await lambdaApiService.getUserProfile();
      if (response.success && response.data) {
        setUserProfile(response.data);
        
        // Also set LinkedIn credentials if available
        if (response.data.linkedin_credentials) {
          setCiphertextState(response.data.linkedin_credentials);
          try {
            sessionStorage.setItem('li_credentials_ciphertext', response.data.linkedin_credentials);
          } catch {}
        }
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch {}
        fetchedFlag = true;
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update user profile
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await lambdaApiService.updateUserProfile(updates);
      if (response.success) {
        // Refresh the profile to get updated data
        await fetchUserProfile();
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch {}
        fetchedFlag = true;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user profile
  const refreshUserProfile = async () => {
    await fetchUserProfile();
  };

  // On mount, hydrate ciphertext from sessionStorage. Defer profile fetch to Dashboard,
  // but allow a guarded fetch if not fetched yet (for direct navigation fallbacks)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('li_credentials_ciphertext');
      if (stored && (stored.startsWith('sealbox_x25519:b64:'))) {
        setCiphertextState(stored);
      }
    } catch {}

    if (user) {
      const alreadyFetched = (() => { try { return sessionStorage.getItem('profile_fetched') === 'true'; } catch { return false; } })();
      if (!alreadyFetched && !fetchedFlag) {
        // Guarded fetch for non-dashboard entry points
        fetchUserProfile();
        fetchedFlag = true;
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch {}
      }
    }
  }, [user]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ciphertext,
    setCiphertext: (value: LinkedInCredentialsCiphertext) => {
      setCiphertextState(value);
      try {
        if (value && value.startsWith('sealbox_x25519:b64:')) {
          sessionStorage.setItem('li_credentials_ciphertext', value);
        } else {
          sessionStorage.removeItem('li_credentials_ciphertext');
        }
      } catch {}
    },
    userProfile,
    updateUserProfile,
    refreshUserProfile,
    isLoading
  }), [ciphertext, userProfile, isLoading]);

  return (
    <UserProfileContext.Provider value={contextValue}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
