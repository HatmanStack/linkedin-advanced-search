import React, { createContext, useContext, useEffect, useState } from 'react';
import { HealAndRestoreModal } from '@/components/HealAndRestoreModal';
import { healAndRestoreService, HealAndRestoreNotification } from '@/services/healAndRestoreService';

interface HealAndRestoreContextType {
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

const HealAndRestoreContext = createContext<HealAndRestoreContextType | undefined>(undefined);

export const useHealAndRestore = () => {
  const context = useContext(HealAndRestoreContext);
  if (context === undefined) {
    throw new Error('useHealAndRestore must be used within a HealAndRestoreProvider');
  }
  return context;
};

interface HealAndRestoreProviderProps {
  children: React.ReactNode;
}

export const HealAndRestoreProvider: React.FC<HealAndRestoreProviderProps> = ({ children }) => {
  const [isListening, setIsListening] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<HealAndRestoreNotification | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handleNotification = (notification: HealAndRestoreNotification) => {
      setCurrentNotification(notification);
      setShowModal(true);
    };

    healAndRestoreService.addListener(handleNotification);

    return () => {
      healAndRestoreService.removeListener(handleNotification);
      healAndRestoreService.stopListening();
    };
  }, []);

  const startListening = () => {
    healAndRestoreService.startListening();
    setIsListening(true);
  };

  const stopListening = () => {
    healAndRestoreService.stopListening();
    setIsListening(false);
  };

  const handleAuthorize = async (autoApprove: boolean) => {
    if (currentNotification) {
      const success = await healAndRestoreService.authorizeHealAndRestore(
        currentNotification.sessionId,
        autoApprove
      );
      
      if (success) {
        console.log('Heal and restore authorized successfully');
      } else {
        console.error('Failed to authorize heal and restore');
      }
    }
    
    setShowModal(false);
    setCurrentNotification(null);
  };

  const handleCancel = () => {
    setShowModal(false);
    setCurrentNotification(null);
  };

  return (
    <HealAndRestoreContext.Provider
      value={{
        isListening,
        startListening,
        stopListening,
      }}
    >
      {children}
      
      {showModal && currentNotification && (
        <HealAndRestoreModal
          isOpen={showModal}
          onAuthorize={handleAuthorize}
          onCancel={handleCancel}
          sessionId={currentNotification.sessionId}
        />
      )}
    </HealAndRestoreContext.Provider>
  );
};
