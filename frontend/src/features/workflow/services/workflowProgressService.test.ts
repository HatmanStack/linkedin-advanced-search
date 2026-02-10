import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection } from '@/shared/types/index';

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { WorkflowProgressService } from './workflowProgressService';

const mockConnection = (id: string, firstName: string = 'John', lastName: string = 'Doe'): Connection => ({
  id,
  first_name: firstName,
  last_name: lastName,
  position: 'Engineer',
  company: 'Corp',
  status: 'ally',
});

describe('WorkflowProgressService', () => {
  let service: WorkflowProgressService;

  beforeEach(() => {
    service = new WorkflowProgressService();
  });

  describe('initializeWorkflow', () => {
    it('should set up connection tracking', () => {
      const connections = [mockConnection('1'), mockConnection('2'), mockConnection('3')];
      service.initializeWorkflow(connections);

      const state = service.getProgressState();
      expect(state.phase).toBe('preparing');
      expect(state.totalConnections).toBe(3);
      expect(state.currentIndex).toBe(0);
      expect(state.processedConnections).toEqual([]);
      expect(state.startTime).toBeDefined();
    });
  });

  describe('startProcessingConnection', () => {
    it('should update current connection and phase', () => {
      const connections = [mockConnection('1', 'Alice', 'Smith')];
      service.initializeWorkflow(connections);
      service.startProcessingConnection(connections[0], 0);

      const state = service.getProgressState();
      expect(state.phase).toBe('generating');
      expect(state.currentIndex).toBe(0);
      expect(service.getCurrentConnectionName()).toBe('Alice Smith');
    });
  });

  describe('markConnectionSuccess', () => {
    it('should add to processed connections', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2')]);
      service.markConnectionSuccess('1');

      const state = service.getProgressState();
      expect(state.processedConnections).toEqual(['1']);
    });
  });

  describe('markConnectionFailure', () => {
    it('should add to failed connections with error message', () => {
      service.initializeWorkflow([mockConnection('1')]);
      service.markConnectionFailure('1', 'API timeout');

      const state = service.getProgressState();
      expect(state.failedConnections).toEqual(['1']);
      expect(state.errorMessage).toBe('API timeout');
    });
  });

  describe('markConnectionSkipped', () => {
    it('should add to skipped connections', () => {
      service.initializeWorkflow([mockConnection('1')]);
      service.markConnectionSkipped('1');

      const state = service.getProgressState();
      expect(state.skippedConnections).toEqual(['1']);
    });
  });

  describe('getProgressPercentage', () => {
    it('should return 0 with no connections', () => {
      expect(service.getProgressPercentage()).toBe(0);
    });

    it('should calculate percentage correctly', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2'), mockConnection('3'), mockConnection('4')]);
      service.markConnectionSuccess('1');
      service.markConnectionFailure('2');

      expect(service.getProgressPercentage()).toBe(50);
    });

    it('should include skipped in percentage', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2')]);
      service.markConnectionSkipped('1');

      expect(service.getProgressPercentage()).toBe(50);
    });

    it('should return 100 when all complete', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2')]);
      service.markConnectionSuccess('1');
      service.markConnectionSuccess('2');

      expect(service.getProgressPercentage()).toBe(100);
    });
  });

  describe('auto-completion', () => {
    it('should set phase to completed when all connections processed', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2')]);
      service.markConnectionSuccess('1');
      service.markConnectionSuccess('2');

      const state = service.getProgressState();
      expect(state.phase).toBe('completed');
    });

    it('should complete with mixed success/failure/skipped', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2'), mockConnection('3')]);
      service.markConnectionSuccess('1');
      service.markConnectionFailure('2');
      service.markConnectionSkipped('3');

      expect(service.getProgressState().phase).toBe('completed');
    });
  });

  describe('onProgressUpdate', () => {
    it('should call callback on progress changes', () => {
      const callback = vi.fn();
      service.onProgressUpdate(callback);

      service.initializeWorkflow([mockConnection('1')]);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ phase: 'preparing' }));
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = service.onProgressUpdate(callback);

      service.initializeWorkflow([mockConnection('1')]);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      service.markConnectionSuccess('1');
      // Still 1 call (from initializeWorkflow) - the completion notification should not reach callback
      // But completion triggers notifyProgressUpdate too, check that unsubscribe worked
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('onWorkflowComplete', () => {
    it('should call callback with stats on completion', () => {
      const callback = vi.fn();
      service.onWorkflowComplete(callback);

      service.initializeWorkflow([mockConnection('1'), mockConnection('2'), mockConnection('3')]);
      service.markConnectionSuccess('1');
      service.markConnectionFailure('2');
      service.markConnectionSkipped('3');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        totalProcessed: 3,
        successful: 1,
        failed: 1,
        skipped: 1,
        successRate: 33,
      }));
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = service.onWorkflowComplete(callback);
      unsubscribe();

      service.initializeWorkflow([mockConnection('1')]);
      service.markConnectionSuccess('1');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('resetWorkflow', () => {
    it('should clear all state', () => {
      service.initializeWorkflow([mockConnection('1'), mockConnection('2')]);
      service.markConnectionSuccess('1');
      service.resetWorkflow();

      const state = service.getProgressState();
      expect(state.phase).toBe('idle');
      expect(state.totalConnections).toBe(0);
      expect(state.processedConnections).toEqual([]);
      expect(state.failedConnections).toEqual([]);
      expect(state.skippedConnections).toEqual([]);
    });
  });

  describe('stopWorkflow', () => {
    it('should set phase to stopped', () => {
      service.initializeWorkflow([mockConnection('1')]);
      service.startProcessingConnection(mockConnection('1'), 0);
      service.stopWorkflow();

      const state = service.getProgressState();
      expect(state.phase).toBe('stopped');
      expect(state.currentConnection).toBeUndefined();
    });
  });

  describe('status helpers', () => {
    it('isWorkflowActive should return true during generating', () => {
      service.initializeWorkflow([mockConnection('1')]);
      expect(service.isWorkflowActive()).toBe(true); // preparing

      service.startProcessingConnection(mockConnection('1'), 0);
      expect(service.isWorkflowActive()).toBe(true); // generating
    });

    it('isWorkflowCompleted should return true after all processed', () => {
      service.initializeWorkflow([mockConnection('1')]);
      service.markConnectionSuccess('1');
      expect(service.isWorkflowCompleted()).toBe(true);
    });

    it('hasWorkflowErrors should return true with failures', () => {
      service.initializeWorkflow([mockConnection('1')]);
      expect(service.hasWorkflowErrors()).toBe(false);

      service.markConnectionFailure('1');
      expect(service.hasWorkflowErrors()).toBe(true);
    });
  });
});
