import { useState, useCallback } from 'react';
import { apiService } from '@/services/apiService';
import { useLinkedInCredentials } from '@/contexts/LinkedInCredentialsContext';
import { useToast } from '@/hooks/use-toast';

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
  
  const { credentials } = useLinkedInCredentials();
  const { toast } = useToast();

  const initializeProfile = useCallback(async (onSuccess?: () => void) => {
    // Check if LinkedIn credentials are available
    if (!credentials.email || !credentials.password) {
      const errorMessage = 'LinkedIn credentials are required. Please set them in your profile settings.';
      setInitializationError(errorMessage);
      toast({
        title: "Credentials Required",
        description: "Please set your LinkedIn credentials in profile settings before initializing the database.",
        variant: "destructive",
      });
      return;
    }

    setIsInitializing(true);
    setInitializationError('');
    setInitializationMessage('');

    try {
      // Get JWT token from session storage or Cognito
      const token = sessionStorage.getItem('jwt_token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Prepare the request payload following the same structure as search
      const requestPayload = {
        searchName: credentials.email,
        searchPassword: credentials.password,
        jwtToken: token,
      };

      // Make API call using the apiService
      const response = await apiService.initializeProfileDatabase(requestPayload);

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
  }, [credentials, toast]);

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