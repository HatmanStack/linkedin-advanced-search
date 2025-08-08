// src/contexts/LinkedInCredentialsContext.tsx
import { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { lambdaApiService } from '@/services/lambdaApiService';
import { useAuth } from '@/contexts/AuthContext';

type LinkedInCredentialsCiphertext = string | null; // rsa_oaep_sha256:b64:<...>

interface LinkedInCredentialsContextType {
  ciphertext: LinkedInCredentialsCiphertext;
  setCiphertext: (ciphertext: LinkedInCredentialsCiphertext) => void;
}

const LinkedInCredentialsContext = createContext<LinkedInCredentialsContextType | undefined>(undefined);

export const LinkedInCredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [ciphertext, setCiphertextState] = useState<LinkedInCredentialsCiphertext>(null);
  const { user } = useAuth();

  // On mount, attempt to hydrate from sessionStorage, then from user profile
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('li_credentials_ciphertext');
      if (stored && stored.startsWith('rsa_oaep_sha256:b64:')) {
        setCiphertextState(stored);
      }
    } catch {}

    // Hydrate from profile when user is available (post-login) and we don't already have ciphertext
    (async () => {
      if (!user) return;
      try {
        const profile = await lambdaApiService.getUserProfile();
        const cred = profile.success ? profile.data?.linkedin_credentials : null;
        if (typeof cred === 'string' && cred.startsWith('rsa_oaep_sha256:b64:')) {
          setCiphertextState(cred);
          try {
            sessionStorage.setItem('li_credentials_ciphertext', cred);
          } catch {}
        }
      } catch {}
    })();
  }, [user]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ciphertext,
    setCiphertext: (value: LinkedInCredentialsCiphertext) => {
      setCiphertextState(value);
      try {
        if (value && value.startsWith('rsa_oaep_sha256:b64:')) {
          sessionStorage.setItem('li_credentials_ciphertext', value);
        } else {
          sessionStorage.removeItem('li_credentials_ciphertext');
        }
      } catch {}
    }
  }), [ciphertext]);

  return (
    <LinkedInCredentialsContext.Provider value={contextValue}>
      {children}
    </LinkedInCredentialsContext.Provider>
  );
};

export const useLinkedInCredentials = () => {
  const context = useContext(LinkedInCredentialsContext);
  if (context === undefined) {
    throw new Error('useLinkedInCredentials must be used within a LinkedInCredentialsProvider');
  }
  return context;
};
