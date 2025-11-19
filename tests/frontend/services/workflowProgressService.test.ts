import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowProgressService } from '@/services/workflowProgressService';

describe('WorkflowProgressService', () => {
  let service: WorkflowProgressService;
  let callback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new WorkflowProgressService();
    callback = vi.fn();
  });

  it('should initialize with idle state', () => {
    const state = service.getState();
    expect(state.phase).toBe('idle');
    expect(state.processedConnections).toEqual([]);
  });

  it('should start workflow', () => {
    service.onProgress(callback);
    service.startWorkflow(10);

    const state = service.getState();
    expect(state.phase).toBe('preparing');
    expect(state.totalConnections).toBe(10);
    expect(callback).toHaveBeenCalled();
  });

  it('should track processed connections', () => {
    service.startWorkflow(3);
    service.markProcessed('conn-1');
    service.markProcessed('conn-2');

    const state = service.getState();
    expect(state.processedConnections).toContain('conn-1');
    expect(state.processedConnections).toContain('conn-2');
  });

  it('should track failed connections', () => {
    service.startWorkflow(2);
    service.markFailed('conn-fail');

    const state = service.getState();
    expect(state.failedConnections).toContain('conn-fail');
  });

  it('should complete workflow with stats', () => {
    const completionCb = vi.fn();
    service.onCompletion(completionCb);
    service.startWorkflow(5);
    service.markProcessed('c1');
    service.markProcessed('c2');
    service.markFailed('c3');

    service.completeWorkflow();

    expect(completionCb).toHaveBeenCalledWith(
      expect.objectContaining({
        successful: 2,
        failed: 1,
      })
    );
  });

  it('should reset workflow state', () => {
    service.startWorkflow(5);
    service.markProcessed('c1');
    service.reset();

    const state = service.getState();
    expect(state.phase).toBe('idle');
    expect(state.processedConnections).toEqual([]);
  });
});
