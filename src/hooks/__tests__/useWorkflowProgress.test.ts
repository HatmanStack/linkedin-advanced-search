import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowProgress } from '../useWorkflowProgress';
import type { Connection } from '../../types/index';

describe('useWorkflowProgress - Task 12 Core Functionality', () => {
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
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Hook Integration', () => {
    it('should initialize with idle state', () => {
      const { result } = renderHook(() => useWorkflowProgress());

      expect(result.current.progressState.phase).toBe('idle');
      expect(result.current.isWorkflowActive).toBe(false);
      expect(result.current.isWorkflowCompleted).toBe(false);
      expect(result.current.progressPercentage).toBe(0);
    });

    it('should initialize workflow correctly', () => {
      const { result } = renderHook(() => useWorkflowProgress());

      act(() => {
        result.current.initializeWorkflow(mockConnections);
      });

      expect(result.current.progressState.phase).toBe('preparing');
      expect(result.current.progressState.totalConnections).toBe(2);
      expect(result.current.isWorkflowActive).toBe(true);
    });

    it('should track connection processing', () => {
      const { result } = renderHook(() => useWorkflowProgress());

      act(() => {
        result.current.initializeWorkflow(mockConnections);
        result.current.startProcessingConnection(mockConnections[0], 0);
      });

      expect(result.current.progressState.phase).toBe('generating');
      expect(result.current.currentConnectionName).toBe('John Doe');
      expect(result.current.progressState.currentConnection).toBe(mockConnections[0]);
    });

    it('should complete workflow and reset', () => {
      const { result } = renderHook(() => useWorkflowProgress());

      act(() => {
        result.current.initializeWorkflow(mockConnections);
        result.current.markConnectionSuccess('conn-1');
        result.current.markConnectionSuccess('conn-2');
      });

      expect(result.current.isWorkflowCompleted).toBe(true);
      expect(result.current.progressPercentage).toBe(100);

      act(() => {
        result.current.resetWorkflow();
      });

      expect(result.current.progressState.phase).toBe('idle');
      expect(result.current.progressPercentage).toBe(0);
    });

    it('should handle workflow completion callback', () => {
      const { result } = renderHook(() => useWorkflowProgress());
      const completionCallback = vi.fn();

      act(() => {
        result.current.onWorkflowComplete(completionCallback);
        result.current.initializeWorkflow(mockConnections);
        result.current.markConnectionSuccess('conn-1');
        result.current.markConnectionSuccess('conn-2');
      });

      expect(completionCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalProcessed: 2,
          successful: 2,
          failed: 0,
          skipped: 0,
        })
      );
    });

    it('should handle workflow stop', () => {
      const { result } = renderHook(() => useWorkflowProgress());

      act(() => {
        result.current.initializeWorkflow(mockConnections);
        result.current.startProcessingConnection(mockConnections[0], 0);
        result.current.stopWorkflow();
      });

      expect(result.current.progressState.phase).toBe('stopped');
      expect(result.current.isWorkflowActive).toBe(false);
    });
  });
});
