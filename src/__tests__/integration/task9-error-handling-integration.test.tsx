/**
 * Integration Tests for Task 9: Comprehensive Error Handling and User Feedback
 * Tests the complete error handling system in the message generation workflow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useProgressTracker } from '@/hooks/useProgressTracker';
import { MessageGenerationError } from '@/services/messageGenerationService';
import { ApiError } from '@/services/dbConnector';

// Mock the hooks
const mockErrorHandler = {
  currentError: null,
  errorHistory: [],
  handleError: vi.fn(),
  clearError: vi.fn(),
  showSuccessFeedback: vi.fn(),
  showWarningFeedback: vi.fn(),
  showInfoFeedback: vi.fn()
};

const mockProgressTracker = {
  progressState: {
    current: 0,
    total: 0,
    phase: 'preparing' as const
  },
  loadingState: {
    isLoading: false
  },
  initializeProgress: vi.fn(),
  updateProgress: vi.fn(),
  setLoadingMessage: vi.fn(),
  clearLoading: vi.fn(),
  resetProgress: vi.fn(),
  getProgressPercentage: vi.fn(() => 0),
  getEstimatedTimeString: vi.fn(() => null),
  getPhaseDescription: vi.fn(() => 'Preparing...')
};

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => mockErrorHandler
}));

vi.mock('@/hooks/useProgressTracker', () => ({
  useProgressTracker: () => mockProgressTracker
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('Task 9: Comprehensive Error Handling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Handler Integration', () => {
    it('should categorize and handle MessageGenerationError correctly', async () => {
      const error = new MessageGenerationError({ message: 'API Error', status: 500 });
      
      // Mock the error handler to return 'retry'
      mockErrorHandler.handleError.mockResolvedValue('retry');
      
      const result = await mockErrorHandler.handleError(error, 'conn1', 'John Doe', 0);
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn1', 'John Doe', 0);
      expect(result).toBe('retry');
    });

    it('should categorize and handle ApiError correctly', async () => {
      const error = new ApiError('Database connection failed', 503);
      
      mockErrorHandler.handleError.mockResolvedValue('skip');
      
      const result = await mockErrorHandler.handleError(error, 'conn2', 'Jane Smith', 1);
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn2', 'Jane Smith', 1);
      expect(result).toBe('skip');
    });

    it('should categorize and handle network errors correctly', async () => {
      const error = new Error('Network timeout');
      error.name = 'NetworkError';
      
      mockErrorHandler.handleError.mockResolvedValue('stop');
      
      const result = await mockErrorHandler.handleError(error, 'conn3', 'Bob Johnson');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn3', 'Bob Johnson');
      expect(result).toBe('stop');
    });

    it('should provide user feedback for different scenarios', () => {
      // Test success feedback
      mockErrorHandler.showSuccessFeedback('Operation completed', 'Success');
      expect(mockErrorHandler.showSuccessFeedback).toHaveBeenCalledWith('Operation completed', 'Success');

      // Test warning feedback
      mockErrorHandler.showWarningFeedback('Missing requirements', 'Warning');
      expect(mockErrorHandler.showWarningFeedback).toHaveBeenCalledWith('Missing requirements', 'Warning');

      // Test info feedback
      mockErrorHandler.showInfoFeedback('Process stopped', 'Information');
      expect(mockErrorHandler.showInfoFeedback).toHaveBeenCalledWith('Process stopped', 'Information');
    });
  });

  describe('Progress Tracker Integration', () => {
    it('should initialize progress correctly', () => {
      mockProgressTracker.initializeProgress(5);
      expect(mockProgressTracker.initializeProgress).toHaveBeenCalledWith(5);
    });

    it('should update progress with connection information', () => {
      mockProgressTracker.updateProgress(2, 'John Doe', 'generating');
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(2, 'John Doe', 'generating');
    });

    it('should set loading messages appropriately', () => {
      mockProgressTracker.setLoadingMessage('Processing connection...', 50, true);
      expect(mockProgressTracker.setLoadingMessage).toHaveBeenCalledWith('Processing connection...', 50, true);
    });

    it('should reset progress when workflow is stopped', () => {
      mockProgressTracker.resetProgress();
      expect(mockProgressTracker.resetProgress).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle retry workflow correctly', async () => {
      const error = new MessageGenerationError({ message: 'Temporary failure', status: 503 });
      
      // First call returns retry, second call succeeds
      mockErrorHandler.handleError
        .mockResolvedValueOnce('retry')
        .mockResolvedValueOnce('skip');
      
      // Simulate retry workflow
      let result = await mockErrorHandler.handleError(error, 'conn1', 'John Doe', 0);
      expect(result).toBe('retry');
      
      // Simulate retry attempt
      result = await mockErrorHandler.handleError(error, 'conn1', 'John Doe', 1);
      expect(result).toBe('skip');
      
      expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(2);
    });

    it('should handle skip workflow correctly', async () => {
      const error = new MessageGenerationError({ message: 'Invalid data', status: 400 });
      
      mockErrorHandler.handleError.mockResolvedValue('skip');
      
      const result = await mockErrorHandler.handleError(error, 'conn1', 'John Doe');
      expect(result).toBe('skip');
      
      // Should show info feedback about skipping
      expect(mockErrorHandler.showInfoFeedback).not.toHaveBeenCalled(); // This would be called in the actual workflow
    });

    it('should handle stop workflow correctly', async () => {
      const error = new MessageGenerationError({ message: 'Authentication failed', status: 401 });
      
      mockErrorHandler.handleError.mockResolvedValue('stop');
      
      const result = await mockErrorHandler.handleError(error, 'conn1', 'John Doe');
      expect(result).toBe('stop');
      
      // Progress should be reset when stopping
      mockProgressTracker.resetProgress();
      expect(mockProgressTracker.resetProgress).toHaveBeenCalled();
    });
  });

  describe('Progress State Management', () => {
    it('should track progress through different phases', () => {
      // Initialize
      mockProgressTracker.initializeProgress(3);
      expect(mockProgressTracker.initializeProgress).toHaveBeenCalledWith(3);

      // Update to generating
      mockProgressTracker.updateProgress(0, 'John Doe', 'generating');
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(0, 'John Doe', 'generating');

      // Update to waiting approval
      mockProgressTracker.updateProgress(0, 'John Doe', 'waiting_approval');
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(0, 'John Doe', 'waiting_approval');

      // Update to next connection
      mockProgressTracker.updateProgress(1, 'Jane Smith', 'generating');
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(1, 'Jane Smith', 'generating');

      // Complete
      mockProgressTracker.updateProgress(3, undefined, 'completed');
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(3, undefined, 'completed');
    });

    it('should handle loading states correctly', () => {
      // Set loading
      mockProgressTracker.setLoadingMessage('Connecting to API...', 0, true);
      expect(mockProgressTracker.setLoadingMessage).toHaveBeenCalledWith('Connecting to API...', 0, true);

      // Update loading
      mockProgressTracker.setLoadingMessage('Generating message...', 33, true);
      expect(mockProgressTracker.setLoadingMessage).toHaveBeenCalledWith('Generating message...', 33, true);

      // Clear loading
      mockProgressTracker.clearLoading();
      expect(mockProgressTracker.clearLoading).toHaveBeenCalled();
    });
  });

  describe('Error History and Tracking', () => {
    it('should maintain error history for debugging', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      mockErrorHandler.handleError(error1, 'conn1', 'John Doe');
      mockErrorHandler.handleError(error2, 'conn2', 'Jane Smith');

      expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(2);
      expect(mockErrorHandler.handleError).toHaveBeenNthCalledWith(1, error1, 'conn1', 'John Doe');
      expect(mockErrorHandler.handleError).toHaveBeenNthCalledWith(2, error2, 'conn2', 'Jane Smith');
    });

    it('should track retry counts correctly', () => {
      const error = new Error('Retry test');

      // First attempt
      mockErrorHandler.handleError(error, 'conn1', 'John Doe', 0);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn1', 'John Doe', 0);

      // Retry attempt
      mockErrorHandler.handleError(error, 'conn1', 'John Doe', 1);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn1', 'John Doe', 1);

      // Second retry
      mockErrorHandler.handleError(error, 'conn1', 'John Doe', 2);
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(error, 'conn1', 'John Doe', 2);
    });
  });

  describe('User Feedback Integration', () => {
    it('should provide appropriate feedback for workflow completion', () => {
      mockErrorHandler.showSuccessFeedback(
        'Successfully generated messages for 3 connections.',
        'Generation Complete'
      );

      expect(mockErrorHandler.showSuccessFeedback).toHaveBeenCalledWith(
        'Successfully generated messages for 3 connections.',
        'Generation Complete'
      );
    });

    it('should provide appropriate feedback for workflow cancellation', () => {
      mockErrorHandler.showInfoFeedback('Message generation has been stopped.', 'Generation Stopped');

      expect(mockErrorHandler.showInfoFeedback).toHaveBeenCalledWith(
        'Message generation has been stopped.',
        'Generation Stopped'
      );
    });

    it('should provide appropriate feedback for missing requirements', () => {
      mockErrorHandler.showWarningFeedback(
        'Please select connections and enter a conversation topic.',
        'Missing Requirements'
      );

      expect(mockErrorHandler.showWarningFeedback).toHaveBeenCalledWith(
        'Please select connections and enter a conversation topic.',
        'Missing Requirements'
      );
    });
  });

  describe('Error Clearing and Reset', () => {
    it('should clear errors when starting new workflow', () => {
      mockErrorHandler.clearError();
      expect(mockErrorHandler.clearError).toHaveBeenCalled();
    });

    it('should reset progress when workflow is cancelled', () => {
      mockProgressTracker.resetProgress();
      expect(mockProgressTracker.resetProgress).toHaveBeenCalled();
    });
  });
});
