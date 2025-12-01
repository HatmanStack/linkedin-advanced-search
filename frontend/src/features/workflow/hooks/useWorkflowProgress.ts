

import { useState, useEffect, useCallback } from 'react';
import { workflowProgressService } from '@/features/workflow';
import type {
  WorkflowProgressState,
  CompletionCallback
} from '@/features/workflow';
import type { Connection } from '@/shared/types/index';

export interface UseWorkflowProgressReturn {
  
  progressState: WorkflowProgressState;
  
  currentConnectionName?: string;
  
  progressPercentage: number;
  
  isWorkflowActive: boolean;
  
  isWorkflowCompleted: boolean;
  
  hasWorkflowErrors: boolean;
  
  initializeWorkflow: (connections: Connection[]) => void;
  
  startProcessingConnection: (connection: Connection, index: number) => void;
  
  markConnectionSuccess: (connectionId: string) => void;
  
  markConnectionFailure: (connectionId: string, errorMessage?: string) => void;
  
  markConnectionSkipped: (connectionId: string) => void;
  
  stopWorkflow: () => void;
  
  resetWorkflow: () => void;
  
  onWorkflowComplete: (callback: CompletionCallback) => () => void;
}


export const useWorkflowProgress = (): UseWorkflowProgressReturn => {
  const [progressState, setProgressState] = useState<WorkflowProgressState>(
    workflowProgressService.getProgressState()
  );

  useEffect(() => {
    const unsubscribe = workflowProgressService.onProgressUpdate((state) => {
      setProgressState(state);
    });

    return unsubscribe;
  }, []);

  const initializeWorkflow = useCallback((connections: Connection[]) => {
    workflowProgressService.initializeWorkflow(connections);
  }, []);

  const startProcessingConnection = useCallback((connection: Connection, index: number) => {
    workflowProgressService.startProcessingConnection(connection, index);
  }, []);

  const markConnectionSuccess = useCallback((connectionId: string) => {
    workflowProgressService.markConnectionSuccess(connectionId);
  }, []);

  const markConnectionFailure = useCallback((connectionId: string, errorMessage?: string) => {
    workflowProgressService.markConnectionFailure(connectionId, errorMessage);
  }, []);

  const markConnectionSkipped = useCallback((connectionId: string) => {
    workflowProgressService.markConnectionSkipped(connectionId);
  }, []);

  const stopWorkflow = useCallback(() => {
    workflowProgressService.stopWorkflow();
  }, []);

  const resetWorkflow = useCallback(() => {
    workflowProgressService.resetWorkflow();
  }, []);

  const onWorkflowComplete = useCallback((callback: CompletionCallback) => {
    return workflowProgressService.onWorkflowComplete(callback);
  }, []);

  return {
    progressState,
    currentConnectionName: workflowProgressService.getCurrentConnectionName(),
    progressPercentage: workflowProgressService.getProgressPercentage(),
    isWorkflowActive: workflowProgressService.isWorkflowActive(),
    isWorkflowCompleted: workflowProgressService.isWorkflowCompleted(),
    hasWorkflowErrors: workflowProgressService.hasWorkflowErrors(),
    initializeWorkflow,
    startProcessingConnection,
    markConnectionSuccess,
    markConnectionFailure,
    markConnectionSkipped,
    stopWorkflow,
    resetWorkflow,
    onWorkflowComplete,
  };
};
