/**
 * Workflow Progress Hook for Message Generation
 * Task 12: Add workflow progress tracking and UI updates
 */

import { useState, useEffect, useCallback } from 'react';
import { workflowProgressService } from '../services/workflowProgressService';
import type { 
  WorkflowProgressState, 
  WorkflowCompletionStats,
  ProgressUpdateCallback,
  CompletionCallback 
} from '../services/workflowProgressService';
import type { Connection } from '../types/index';

export interface UseWorkflowProgressReturn {
  /** Current workflow progress state */
  progressState: WorkflowProgressState;
  /** Current connection name being processed */
  currentConnectionName?: string;
  /** Progress percentage (0-100) */
  progressPercentage: number;
  /** Whether workflow is currently active */
  isWorkflowActive: boolean;
  /** Whether workflow is completed */
  isWorkflowCompleted: boolean;
  /** Whether workflow has errors */
  hasWorkflowErrors: boolean;
  /** Initialize workflow with connections */
  initializeWorkflow: (connections: Connection[]) => void;
  /** Start processing a connection */
  startProcessingConnection: (connection: Connection, index: number) => void;
  /** Mark connection as successful */
  markConnectionSuccess: (connectionId: string) => void;
  /** Mark connection as failed */
  markConnectionFailure: (connectionId: string, errorMessage?: string) => void;
  /** Mark connection as skipped */
  markConnectionSkipped: (connectionId: string) => void;
  /** Stop the workflow */
  stopWorkflow: () => void;
  /** Reset workflow to initial state */
  resetWorkflow: () => void;
  /** Subscribe to completion notifications */
  onWorkflowComplete: (callback: CompletionCallback) => () => void;
}

/**
 * Hook for managing workflow progress tracking and UI updates
 * 
 * This hook provides a React interface to the WorkflowProgressService,
 * managing state updates and providing UI-friendly data transformations.
 */
export const useWorkflowProgress = (): UseWorkflowProgressReturn => {
  const [progressState, setProgressState] = useState<WorkflowProgressState>(
    workflowProgressService.getProgressState()
  );

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = workflowProgressService.onProgressUpdate((state) => {
      setProgressState(state);
    });

    return unsubscribe;
  }, []);

  // Initialize workflow
  const initializeWorkflow = useCallback((connections: Connection[]) => {
    workflowProgressService.initializeWorkflow(connections);
  }, []);

  // Start processing connection
  const startProcessingConnection = useCallback((connection: Connection, index: number) => {
    workflowProgressService.startProcessingConnection(connection, index);
  }, []);

  // Mark connection success
  const markConnectionSuccess = useCallback((connectionId: string) => {
    workflowProgressService.markConnectionSuccess(connectionId);
  }, []);

  // Mark connection failure
  const markConnectionFailure = useCallback((connectionId: string, errorMessage?: string) => {
    workflowProgressService.markConnectionFailure(connectionId, errorMessage);
  }, []);

  // Mark connection skipped
  const markConnectionSkipped = useCallback((connectionId: string) => {
    workflowProgressService.markConnectionSkipped(connectionId);
  }, []);

  // Stop workflow
  const stopWorkflow = useCallback(() => {
    workflowProgressService.stopWorkflow();
  }, []);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    workflowProgressService.resetWorkflow();
  }, []);

  // Subscribe to completion notifications
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
