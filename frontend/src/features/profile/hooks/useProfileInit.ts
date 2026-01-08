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
    // We no longer require plaintext here; ciphertext is attached by the API service

    setIsInitializing(true);
    setInitializationError('');
    setInitializationMessage('');

    try {
      // Prepare the request payload following the same structure as search
      // Note: JWT token is automatically handled by apiService via Authorization header
      // Payload can be empty; puppeteerApiService will attach ciphertext credentials

      // Make API call using the apiService
      const response = await puppeteerApiService.initializeProfileDatabase();

      if (!response.success) {
        throw new Error(response.error || 'Failed to initialize profile database');
      }

      // Handle successful response
      if (response.data?.success) {
        const successMessage = response.data.message || 'Profile database initialized successfully!';
        setInitializationMessage(successMessage);
        toast({
          title: "Success",
          description: "Profile database has been initialized successfully.",
        });
        // Flag connections as changed so dashboard can refresh once
        connectionChangeTracker.markChanged('init');
        // Call success callback if provided
        onSuccess?.();
      } else if (response.data?.healing) {
        // Handle healing/recovery response (202 status)
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
        // Call success callback if provided
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