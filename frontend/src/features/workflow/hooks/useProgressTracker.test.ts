import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressTracker } from './useProgressTracker';

describe('useProgressTracker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeProgress', () => {
    it('should set total and reset current to 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
      });

      expect(result.current.progressState.total).toBe(10);
      expect(result.current.progressState.current).toBe(0);
      expect(result.current.progressState.phase).toBe('preparing');
    });
  });

  describe('updateProgress', () => {
    it('should update current, connectionName, and phase', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(5);
      });

      act(() => {
        result.current.updateProgress(2, 'Alice Smith', 'generating');
      });

      expect(result.current.progressState.current).toBe(2);
      expect(result.current.progressState.currentConnectionName).toBe('Alice Smith');
      expect(result.current.progressState.phase).toBe('generating');
    });

    it('should default phase to generating', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      act(() => {
        result.current.updateProgress(1);
      });

      expect(result.current.progressState.phase).toBe('generating');
    });
  });

  describe('getProgressPercentage', () => {
    it('should return 0 when total is 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getProgressPercentage()).toBe(0);
    });

    it('should return correct percentage', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(4);
      });

      act(() => {
        result.current.updateProgress(1);
      });

      expect(result.current.getProgressPercentage()).toBe(25);
    });

    it('should return 100 when complete', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(2);
      });

      act(() => {
        result.current.updateProgress(2);
      });

      expect(result.current.getProgressPercentage()).toBe(100);
    });
  });

  describe('getEstimatedTimeString', () => {
    it('should return null when no estimate available', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getEstimatedTimeString()).toBeNull();
    });

    it('should format seconds only', () => {
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // initializeProgress startTime
        .mockReturnValueOnce(11000); // updateProgress: elapsed = 10s

      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(4);
      });

      act(() => {
        result.current.updateProgress(1, 'Test');
      });

      // elapsed=10s, 1 done, avg=10s, 3 remaining = 30s
      expect(result.current.getEstimatedTimeString()).toBe('30s remaining');
    });

    it('should format minutes and seconds', () => {
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(61000); // elapsed = 60s

      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      act(() => {
        result.current.updateProgress(1, 'Test');
      });

      // elapsed=60s, 1 done, avg=60s, 2 remaining = 120s = 2m 0s
      expect(result.current.getEstimatedTimeString()).toBe('2m 0s remaining');
    });
  });

  describe('getPhaseDescription', () => {
    it('should return preparing description', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getPhaseDescription()).toBe('Preparing message generation...');
    });

    it('should return generating description with connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(1);
      });

      act(() => {
        result.current.updateProgress(0, 'Bob Jones', 'generating');
      });

      expect(result.current.getPhaseDescription()).toBe('Generating message for Bob Jones...');
    });

    it('should return generic generating when no connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(1);
      });

      act(() => {
        result.current.updateProgress(0, undefined, 'generating');
      });

      expect(result.current.getPhaseDescription()).toBe('Generating messages...');
    });

    it('should return completed description', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(1);
      });

      act(() => {
        result.current.updateProgress(1, undefined, 'completed');
      });

      expect(result.current.getPhaseDescription()).toBe('Message generation completed!');
    });

    it('should return error description', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(1);
      });

      act(() => {
        result.current.updateProgress(0, undefined, 'error');
      });

      expect(result.current.getPhaseDescription()).toBe('An error occurred during generation');
    });
  });

  describe('resetProgress', () => {
    it('should reset all state', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(5);
      });

      act(() => {
        result.current.updateProgress(3, 'Test', 'generating');
        result.current.setLoadingMessage('Working...', 60);
      });

      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.progressState.current).toBe(0);
      expect(result.current.progressState.total).toBe(0);
      expect(result.current.progressState.phase).toBe('preparing');
      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });

  describe('setLoadingMessage / clearLoading', () => {
    it('should set loading state with message', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Processing...', 50, true);
      });

      expect(result.current.loadingState.isLoading).toBe(true);
      expect(result.current.loadingState.message).toBe('Processing...');
      expect(result.current.loadingState.progress).toBe(50);
      expect(result.current.loadingState.canCancel).toBe(true);
    });

    it('should clear loading state', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Working...');
      });

      act(() => {
        result.current.clearLoading();
      });

      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });
});
