import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowProgressService } from '@/features/workflow';
import type { Connection } from '@/shared/types/index';

describe('WorkflowProgressService', () => {
  let service: WorkflowProgressService;
  let callback: ReturnType<typeof vi.fn>;

  const mockConnections: Connection[] = [
    { id: 'conn-1', first_name: 'John', last_name: 'Doe', position: 'Engineer', company: 'Tech Co' } as Connection,
    { id: 'conn-2', first_name: 'Jane', last_name: 'Smith', position: 'Manager', company: 'Biz Inc' } as Connection,
    { id: 'conn-3', first_name: 'Bob', last_name: 'Johnson', position: 'Designer', company: 'Creative LLC' } as Connection,
  ];

  beforeEach(() => {
    service = new WorkflowProgressService();
    callback = vi.fn();
  });

  it('should initialize with idle state', () => {
    const state = service.getProgressState();
    expect(state.phase).toBe('idle');
    expect(state.processedConnections).toEqual([]);
  });

  it('should start workflow', () => {
    service.onProgressUpdate(callback);
    service.initializeWorkflow(mockConnections.slice(0, 2));

    const state = service.getProgressState();
    expect(state.phase).toBe('preparing');
    expect(state.totalConnections).toBe(2);
    expect(callback).toHaveBeenCalled();
  });

  it('should track processed connections', () => {
    service.initializeWorkflow(mockConnections);
    service.markConnectionSuccess('conn-1');
    service.markConnectionSuccess('conn-2');

    const state = service.getProgressState();
    expect(state.processedConnections).toContain('conn-1');
    expect(state.processedConnections).toContain('conn-2');
  });

  it('should track failed connections', () => {
    service.initializeWorkflow(mockConnections.slice(0, 2));
    service.markConnectionFailure('conn-fail', 'Test error');

    const state = service.getProgressState();
    expect(state.failedConnections).toContain('conn-fail');
  });

  it('should complete workflow with stats', () => {
    const completionCb = vi.fn();
    service.onWorkflowComplete(completionCb);
    service.initializeWorkflow(mockConnections);
    service.markConnectionSuccess('conn-1');
    service.markConnectionSuccess('conn-2');
    service.markConnectionFailure('conn-3', 'Test error');

    // Completion happens automatically when all connections are processed
    expect(completionCb).toHaveBeenCalledWith(
      expect.objectContaining({
        successful: 2,
        failed: 1,
      })
    );
  });

  it('should reset workflow state', () => {
    service.initializeWorkflow(mockConnections);
    service.markConnectionSuccess('conn-1');
    service.resetWorkflow();

    const state = service.getProgressState();
    expect(state.phase).toBe('idle');
    expect(state.processedConnections).toEqual([]);
  });
});
