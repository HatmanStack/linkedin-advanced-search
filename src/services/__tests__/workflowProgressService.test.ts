import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowProgressService } from '../workflowProgressService';
import type { Connection } from '../../types/index';
import type { WorkflowProgressState, WorkflowCompletionStats } from '../workflowProgressService';

describe('WorkflowProgressService - Task 12 Core Functionality', () => {
  let service: WorkflowProgressService;

  const mockConnections: Connection[] = [
    {
      id: 'conn-1',
      first_name: 'John',
      last_name: 'Doe',
      position: 'Software Engineer',
      company: 'Tech Corp',
      status: 'allies',
    },
    {
      id: 'conn-2',
      first_name: 'Jane',
      last_name: 'Smith',
      position: 'Product Manager',
      company: 'StartupCo',
      status: 'allies',
    },
    {
      id: 'conn-3',
      first_name: 'Bob',
      last_name: 'Johnson',
      position: 'Designer',
      company: 'Creative Inc',
      status: 'allies',
    },
  ];

  beforeEach(() => {
    service = new WorkflowProgressService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Progress Indicators (Requirement 4.4)', () => {
    it('should initialize workflow with correct state', () => {
      service.initializeWorkflow(mockConnections);

      const state = service.getProgressState();
      expect(state.phase).toBe('preparing');
      expect(state.totalConnections).toBe(3);
      expect(state.currentIndex).toBe(0);
      expect(state.processedConnections).toEqual([]);
      expect(state.failedConnections).toEqual([]);
      expect(state.skippedConnections).toEqual([]);
      expect(state.startTime).toBeDefined();
    });

    it('should track current connection being processed', () => {
      service.initializeWorkflow(mockConnections);
      service.startProcessingConnection(mockConnections[0], 0);

      const state = service.getProgressState();
      expect(state.phase).toBe('generating');
      expect(state.currentConnection).toBe(mockConnections[0]);
      expect(state.currentIndex).toBe(0);
    });

    it('should provide current connection name', () => {
      service.initializeWorkflow(mockConnections);
      service.startProcessingConnection(mockConnections[0], 0);

      const connectionName = service.getCurrentConnectionName();
      expect(connectionName).toBe('John Doe');
    });

    it('should calculate progress percentage correctly', () => {
      service.initializeWorkflow(mockConnections);
      
      // Initially 0%
      expect(service.getProgressPercentage()).toBe(0);

      // After processing one connection
      service.markConnectionSuccess('conn-1');
      expect(service.getProgressPercentage()).toBe(33); // 1/3 = 33%

      // After processing two connections
      service.markConnectionFailure('conn-2');
      expect(service.getProgressPercentage()).toBe(67); // 2/3 = 67%

      // After processing all connections
      service.markConnectionSkipped('conn-3');
      expect(service.getProgressPercentage()).toBe(100); // 3/3 = 100%
    });

    it('should track workflow state correctly', () => {
      service.initializeWorkflow(mockConnections);
      
      expect(service.isWorkflowActive()).toBe(true);
      expect(service.isWorkflowCompleted()).toBe(false);

      service.startProcessingConnection(mockConnections[0], 0);
      expect(service.isWorkflowActive()).toBe(true);

      // Complete all connections
      service.markConnectionSuccess('conn-1');
      service.markConnectionSuccess('conn-2');
      service.markConnectionSuccess('conn-3');

      expect(service.isWorkflowActive()).toBe(false);
      expect(service.isWorkflowCompleted()).toBe(true);
    });
  });

  describe('Connection Processing Tracking', () => {
    it('should track successful connection processing', () => {
      service.initializeWorkflow(mockConnections);
      service.markConnectionSuccess('conn-1');

      const state = service.getProgressState();
      expect(state.processedConnections).toContain('conn-1');
      expect(state.failedConnections).not.toContain('conn-1');
    });

    it('should track failed connection processing', () => {
      service.initializeWorkflow(mockConnections);
      service.markConnectionFailure('conn-1', 'API Error');

      const state = service.getProgressState();
      expect(state.failedConnections).toContain('conn-1');
      expect(state.processedConnections).not.toContain('conn-1');
      expect(state.errorMessage).toBe('API Error');
      expect(service.hasWorkflowErrors()).toBe(true);
    });

    it('should track skipped connection processing', () => {
      service.initializeWorkflow(mockConnections);
      service.markConnectionSkipped('conn-1');

      const state = service.getProgressState();
      expect(state.skippedConnections).toContain('conn-1');
      expect(state.processedConnections).not.toContain('conn-1');
      expect(state.failedConnections).not.toContain('conn-1');
    });
  });

  describe('Workflow Completion (Requirement 4.4)', () => {
    it('should automatically complete workflow when all connections processed', () => {
      const completionCallback = vi.fn();
      service.onWorkflowComplete(completionCallback);
      
      service.initializeWorkflow(mockConnections);
      
      // Process all connections
      service.markConnectionSuccess('conn-1');
      service.markConnectionSuccess('conn-2');
      service.markConnectionSuccess('conn-3');

      const state = service.getProgressState();
      expect(state.phase).toBe('completed');
      expect(state.currentConnection).toBeUndefined();
      expect(state.estimatedTimeRemaining).toBeUndefined();
      expect(completionCallback).toHaveBeenCalledOnce();
    });

    it('should provide completion statistics', () => {
      const completionCallback = vi.fn();
      service.onWorkflowComplete(completionCallback);
      
      service.initializeWorkflow(mockConnections);
      
      // Simulate some time passing
      vi.advanceTimersByTime(5000); // 5 seconds
      
      // Process connections with mixed results
      service.markConnectionSuccess('conn-1');
      service.markConnectionFailure('conn-2', 'Network error');
      service.markConnectionSkipped('conn-3');

      expect(completionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalProcessed: 3,
          successful: 1,
          failed: 1,
          skipped: 1,
          totalTime: 5,
          successRate: 33, // 1/3 = 33%
        })
      );
    });

    it('should reset workflow to initial state', () => {
      service.initializeWorkflow(mockConnections);
      service.startProcessingConnection(mockConnections[0], 0);
      service.markConnectionSuccess('conn-1');

      service.resetWorkflow();

      const state = service.getProgressState();
      expect(state.phase).toBe('idle');
      expect(state.currentIndex).toBe(0);
      expect(state.totalConnections).toBe(0);
      expect(state.processedConnections).toEqual([]);
      expect(state.currentConnection).toBeUndefined();
    });
  });

  describe('Error Handling and Workflow Stop (Requirement 4.5)', () => {
    it('should stop workflow when requested', () => {
      service.initializeWorkflow(mockConnections);
      service.startProcessingConnection(mockConnections[0], 0);
      
      service.stopWorkflow();

      const state = service.getProgressState();
      expect(state.phase).toBe('stopped');
      expect(state.currentConnection).toBeUndefined();
      expect(state.estimatedTimeRemaining).toBeUndefined();
    });

    it('should handle workflow errors appropriately', () => {
      service.initializeWorkflow(mockConnections);
      service.markConnectionFailure('conn-1', 'Critical API failure');

      const state = service.getProgressState();
      expect(state.errorMessage).toBe('Critical API failure');
      expect(service.hasWorkflowErrors()).toBe(true);
    });

    it('should complete workflow even with errors', () => {
      const completionCallback = vi.fn();
      service.onWorkflowComplete(completionCallback);
      
      service.initializeWorkflow(mockConnections);
      
      // All connections fail
      service.markConnectionFailure('conn-1', 'Error 1');
      service.markConnectionFailure('conn-2', 'Error 2');
      service.markConnectionFailure('conn-3', 'Error 3');

      const state = service.getProgressState();
      expect(state.phase).toBe('completed');
      expect(completionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          successful: 0,
          failed: 3,
          successRate: 0,
        })
      );
    });
  });

  describe('Progress Update Callbacks', () => {
    it('should notify progress update callbacks', () => {
      const progressCallback = vi.fn();
      const unsubscribe = service.onProgressUpdate(progressCallback);

      service.initializeWorkflow(mockConnections);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'preparing',
          totalConnections: 3,
        })
      );

      service.startProcessingConnection(mockConnections[0], 0);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: 'generating',
          currentConnection: mockConnections[0],
        })
      );

      // Test unsubscribe
      unsubscribe();
      progressCallback.mockClear();
      
      service.markConnectionSuccess('conn-1');
      expect(progressCallback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.onProgressUpdate(errorCallback);
      service.initializeWorkflow(mockConnections);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in progress update callback:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Time Estimation', () => {
    it('should calculate estimated time remaining', () => {
      service.initializeWorkflow(mockConnections);
      
      // Process first connection
      service.startProcessingConnection(mockConnections[0], 0);
      vi.advanceTimersByTime(2000); // 2 seconds
      service.markConnectionSuccess('conn-1');
      
      // Start second connection - now estimation should be available
      service.startProcessingConnection(mockConnections[1], 1);

      const state = service.getProgressState();
      expect(state.estimatedTimeRemaining).toBeDefined();
      expect(typeof state.estimatedTimeRemaining).toBe('number');
    });

    it('should not provide time estimation for first connection', () => {
      service.initializeWorkflow(mockConnections);
      service.startProcessingConnection(mockConnections[0], 0);

      const state = service.getProgressState();
      expect(state.estimatedTimeRemaining).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty connection list', () => {
      service.initializeWorkflow([]);

      const state = service.getProgressState();
      expect(state.totalConnections).toBe(0);
      expect(service.getProgressPercentage()).toBe(0);
      expect(service.isWorkflowCompleted()).toBe(false);
    });

    it('should handle connection without name', () => {
      const connectionWithoutName: Connection = {
        id: 'conn-no-name',
        first_name: '',
        last_name: '',
        position: 'Unknown',
        company: 'Unknown',
        status: 'allies',
      };

      service.initializeWorkflow([connectionWithoutName]);
      service.startProcessingConnection(connectionWithoutName, 0);

      const connectionName = service.getCurrentConnectionName();
      expect(connectionName).toBe(' '); // Empty first and last name
    });
  });
});
