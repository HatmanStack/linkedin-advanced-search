import { useState, useCallback } from 'react';
import type { Connection } from '@/types';

export function useMessageModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);

  const openModal = useCallback((connection: Connection) => {
    setSelectedConnection(connection);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedConnection(null);
  }, []);

  return {
    isOpen,
    selectedConnection,
    openModal,
    closeModal,
  };
}
