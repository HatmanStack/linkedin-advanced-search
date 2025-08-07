/**
 * Progress Tracker Hook for Message Generation Workflow
 * Task 9: Comprehensive error handling and user feedback
 */

import { useState, useCallback, useEffect } from 'react';
import type { ProgressState, LoadingState } from '@/types/errorTypes';

export const useProgressTracker = () => {
  const [progressState, setProgressState] = useState<ProgressState>({
    current: 0,
    total: 0,
    phase: 'preparing'
  });
  
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false
  });

  const [startTime, setStartTime] = useState<number | null>(null);

  const initializeProgress = useCallback((total: number) => {
    setProgressState({
      current: 0,
      total,
      phase: 'preparing'
    });
    setStartTime(Date.now());
  }, []);

  const updateProgress = useCallback((
    current: number,
    connectionName?: string,
    phase: ProgressState['phase'] = 'generating'
  ) => {
    setProgressState(prev => {
      const newState = {
        ...prev,
        current,
        currentConnectionName: connectionName,
        phase
      };

      // Calculate estimated time remaining
      if (startTime && current > 0) {
        const elapsed = Date.now() - startTime;
        const avgTimePerConnection = elapsed / current;
        const remaining = prev.total - current;
        newState.estimatedTimeRemaining = Math.round((avgTimePerConnection * remaining) / 1000);
      }

      return newState;
    });
  }, [startTime]);

  const setLoadingMessage = useCallback((message: string, progress?: number, canCancel: boolean = true) => {
    setLoadingState({
      isLoading: true,
      message,
      progress,
      canCancel
    });
  }, []);

  const clearLoading = useCallback(() => {
    setLoadingState({
      isLoading: false
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgressState({
      current: 0,
      total: 0,
      phase: 'preparing'
    });
    setStartTime(null);
    clearLoading();
  }, [clearLoading]);

  const getProgressPercentage = useCallback(() => {
    if (progressState.total === 0) return 0;
    return Math.round((progressState.current / progressState.total) * 100);
  }, [progressState]);

  const getEstimatedTimeString = useCallback(() => {
    if (!progressState.estimatedTimeRemaining) return null;
    
    const minutes = Math.floor(progressState.estimatedTimeRemaining / 60);
    const seconds = progressState.estimatedTimeRemaining % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    } else {
      return `${seconds}s remaining`;
    }
  }, [progressState.estimatedTimeRemaining]);

  const getPhaseDescription = useCallback(() => {
    switch (progressState.phase) {
      case 'preparing':
        return 'Preparing message generation...';
      case 'generating':
        return progressState.currentConnectionName 
          ? `Generating message for ${progressState.currentConnectionName}...`
          : 'Generating messages...';
      case 'waiting_approval':
        return 'Waiting for your approval...';
      case 'completed':
        return 'Message generation completed!';
      case 'error':
        return 'An error occurred during generation';
      default:
        return 'Processing...';
    }
  }, [progressState]);

  return {
    progressState,
    loadingState,
    initializeProgress,
    updateProgress,
    setLoadingMessage,
    clearLoading,
    resetProgress,
    getProgressPercentage,
    getEstimatedTimeString,
    getPhaseDescription
  };
};
