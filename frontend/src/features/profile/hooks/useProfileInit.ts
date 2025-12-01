import { useState, useCallback } from 'react';
import { puppeteerApiService } from '@/shared/services';
import { useToast } from '@/shared/hooks';
import { connectionChangeTracker } from '@/features/connections';

interface UseProfileInitReturn {
  isInitializing: boolean;
  initializationMessage: string;
  initializationError: string;
  initializeProfile: (onSuccess?: () => void) => Promise<void>;
  clearMessages: () => void;
}

export const useProfileInit = (): UseProfileInitReturn => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationMessage, setInitializationMessage] = useState<string>('');
  const [initializationError, setInitializationError] = useState<string>('');
  
  const { toast } = useToast();

  const initializeProfile = useCallback(async (onSuccess?: () => void) => {

    setIsInitializing(true);
    setInitializationError('');
    setInitializationMessage('');

    try {
      const requestPayload = {};

      const response = await puppeteerApiService.initializeProfileDatabase(requestPayload);

      if (!response.success) {
        throw new Error(response.error || 'Failed to initialize profile database');
      }

      if (response.data?.success) {
        const successMessage = response.data.message || 'Profile database initialized successfully!';
        setInitializationMessage(successMessage);
        toast({
          title: "Success",
          description: "Profile database has been initialized successfully.",
        });
        connectionChangeTracker.markChanged('init');
        onSuccess?.();
      } else if (response.data?.healing) {
        const healingMessage = response.data.message || 'Profile initialization is in progress with healing...';
        setInitializationMessage(healingMessage);
        toast({
          title: "Processing",
          description: "Profile initialization is in progress. This may take a few minutes.",
        });
      } else {
        const successMessage = response.message || 'Profile database initialized successfully!';
        setInitializationMessage(successMessage);
        toast({
          title: "Success",
          description: "Profile database has been initialized successfully.",
        });
        onSuccess?.();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize profile database';
      setInitializationError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  }, [toast]);

  const clearMessages = useCallback(() => {
    setInitializationMessage('');
    setInitializationError('');
  }, []);

  return {
    isInitializing,
    initializationMessage,
    initializationError,
    initializeProfile,
    clearMessages,
  };
};