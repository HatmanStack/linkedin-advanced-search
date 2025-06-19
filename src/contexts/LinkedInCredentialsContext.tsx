// src/contexts/LinkedInCredentialsContext.tsx
import { createContext, useState, useContext, ReactNode, useMemo } from 'react';

interface LinkedInCredentials {
  email: string;
  password: string;
}

interface LinkedInCredentialsContextType {
  credentials: LinkedInCredentials;
  setCredentials: (credentials: LinkedInCredentials) => void;
}

const LinkedInCredentialsContext = createContext<LinkedInCredentialsContextType | undefined>(undefined);

export const LinkedInCredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [credentials, setCredentialsState] = useState<LinkedInCredentials>({
    email: '',
    password: '',
  });

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    credentials,
    setCredentials: (newCredentials: LinkedInCredentials) => {
      // In a real production app, consider encrypting before storing if you were to use localStorage.
      // However, storing raw passwords client-side, even encrypted, is highly discouraged.
      // This example keeps credentials in-memory for the session.
      setCredentialsState(newCredentials);
    }
  }), [credentials]);

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
