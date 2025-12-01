import { createContext, useState, useContext, type ReactNode, useMemo, useEffect } from 'react';
import { lambdaApiService } from '@/shared/services';
import { useAuth } from '@/features/auth';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('UserProfileContext');

type LinkedInCredentialsCiphertext = string | null;

import type { UserProfile } from '@/shared/types';

interface UserProfileContextType {
  ciphertext: LinkedInCredentialsCiphertext;
  setCiphertext: (ciphertext: LinkedInCredentialsCiphertext) => void;
  
  userProfile: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  
  isLoading: boolean;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [ciphertext, setCiphertextState] = useState<LinkedInCredentialsCiphertext>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  let fetchedFlag = false;

  const fetchUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await lambdaApiService.getUserProfile();
      if (response.success && response.data) {
        setUserProfile(response.data);
        
        if (response.data.linkedin_credentials) {
          setCiphertextState(response.data.linkedin_credentials);
          try {
            sessionStorage.setItem('li_credentials_ciphertext', response.data.linkedin_credentials);
          } catch { /* ignored */ }
        }
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch { /* ignored */ }
        fetchedFlag = true;
      }
    } catch (error) {
      logger.error('Failed to fetch user profile', { error });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await lambdaApiService.updateUserProfile(updates);
      if (response.success) {
        await fetchUserProfile();
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch { /* ignored */ }
        fetchedFlag = true;
      } else {
        throw new Error(response.error || 'Failed to update profile');
      }
    } catch (error) {
      logger.error('Failed to update user profile', { error });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUserProfile = async () => {
    await fetchUserProfile();
  };

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('li_credentials_ciphertext');
      logger.debug('Loading credentials from sessionStorage', {
        hasStored: !!stored,
        startsWithPrefix: stored ? stored.startsWith('sealbox_x25519:b64:') : false,
        length: stored ? stored.length : 0
      });
      if (stored && (stored.startsWith('sealbox_x25519:b64:'))) {
        setCiphertextState(stored);
        logger.debug('Credentials loaded successfully');
      } else {
        logger.warn('No valid credentials found in sessionStorage');
      }
    } catch (err) {
      logger.error('Error loading credentials', { error: err });
    }

    if (user) {
      const alreadyFetched = (() => { try { return sessionStorage.getItem('profile_fetched') === 'true'; } catch { return false; } })();
      if (!alreadyFetched && !fetchedFlag) {
        fetchUserProfile();
        fetchedFlag = true;
        try { sessionStorage.setItem('profile_fetched', 'true'); } catch { /* ignored */ }
      }
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    ciphertext,
    setCiphertext: (value: LinkedInCredentialsCiphertext) => {
      logger.debug('setCiphertext called', {
        hasValue: !!value,
        startsWithPrefix: value ? value.startsWith('sealbox_x25519:b64:') : false
      });
      setCiphertextState(value);
      try {
        if (value && value.startsWith('sealbox_x25519:b64:')) {
          sessionStorage.setItem('li_credentials_ciphertext', value);
          logger.debug('Credentials saved to sessionStorage');
        } else {
          sessionStorage.removeItem('li_credentials_ciphertext');
          logger.debug('Credentials removed from sessionStorage');
        }
      } catch { /* ignored */ }
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
