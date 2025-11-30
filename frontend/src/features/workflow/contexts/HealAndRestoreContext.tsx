import React, { createContext, useContext, useEffect, useState } from 'react';
import { HealAndRestoreModal } from '@/features/workflow';
import { healAndRestoreService } from '@/features/workflow';
import type { HealAndRestoreNotification } from '@/features/workflow';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('HealAndRestoreContext');

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
        logger.info('Heal and restore authorized successfully');
      } else {
        logger.error('Failed to authorize heal and restore');
      }
    }

    setShowModal(false);
    setCurrentNotification(null);
  };

  const handleCancel = async () => {
    if (currentNotification?.sessionId) {
      // Inform backend and locally ignore this session id to prevent re-trigger
      await healAndRestoreService.cancelHealAndRestore(currentNotification.sessionId);
    }
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
