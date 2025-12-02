import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressTracker } from '@/features/workflow/hooks/useProgressTracker';

describe('useProgressTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with current 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.progressState.current).toBe(0);
    });

    it('starts with total 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.progressState.total).toBe(0);
    });

    it('starts in preparing phase', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.progressState.phase).toBe('preparing');
    });

    it('starts with loading false', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });

  describe('initializeProgress', () => {
    it('sets total correctly', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
      });

      expect(result.current.progressState.total).toBe(10);
    });

    it('resets current to 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(5);
      });

      act(() => {
        result.current.initializeProgress(20);
      });

      expect(result.current.progressState.current).toBe(0);
    });

    it('sets phase to preparing', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(5, 'John Doe', 'generating');
      });

      act(() => {
        result.current.initializeProgress(20);
      });

      expect(result.current.progressState.phase).toBe('preparing');
    });
  });

  describe('updateProgress', () => {
    it('updates current value', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(5);
      });

      expect(result.current.progressState.current).toBe(5);
    });

    it('sets connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3, 'Jane Smith');
      });

      expect(result.current.progressState.currentConnectionName).toBe('Jane Smith');
    });

    it('defaults phase to generating', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3, 'Jane');
      });

      expect(result.current.progressState.phase).toBe('generating');
    });

    it('sets custom phase', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(10, undefined, 'completed');
      });

      expect(result.current.progressState.phase).toBe('completed');
    });

    it('calculates estimated time remaining', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
      });

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
        result.current.updateProgress(5);
      });

      // 5 seconds for 5 items = 1 second each
      // 5 remaining items = 5 seconds remaining
      expect(result.current.progressState.estimatedTimeRemaining).toBe(5);
    });
  });

  describe('setLoadingMessage', () => {
    it('sets isLoading to true', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...');
      });

      expect(result.current.loadingState.isLoading).toBe(true);
    });

    it('sets message', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Processing data...');
      });

      expect(result.current.loadingState.message).toBe('Processing data...');
    });

    it('sets progress when provided', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...', 50);
      });

      expect(result.current.loadingState.progress).toBe(50);
    });

    it('sets canCancel to true by default', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...');
      });

      expect(result.current.loadingState.canCancel).toBe(true);
    });

    it('sets canCancel to false when specified', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...', undefined, false);
      });

      expect(result.current.loadingState.canCancel).toBe(false);
    });
  });

  describe('clearLoading', () => {
    it('sets isLoading to false', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...');
      });

      expect(result.current.loadingState.isLoading).toBe(true);

      act(() => {
        result.current.clearLoading();
      });

      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });

  describe('resetProgress', () => {
    it('resets current to 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(5);
        result.current.resetProgress();
      });

      expect(result.current.progressState.current).toBe(0);
    });

    it('resets total to 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.resetProgress();
      });

      expect(result.current.progressState.total).toBe(0);
    });

    it('resets phase to preparing', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(10, undefined, 'completed');
        result.current.resetProgress();
      });

      expect(result.current.progressState.phase).toBe('preparing');
    });

    it('clears loading state', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...');
        result.current.resetProgress();
      });

      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });

  describe('getProgressPercentage', () => {
    it('returns 0 when total is 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getProgressPercentage()).toBe(0);
    });

    it('calculates percentage correctly', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(5);
      });

      expect(result.current.getProgressPercentage()).toBe(50);
    });

    it('rounds to whole number', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
        result.current.updateProgress(1);
      });

      expect(result.current.getProgressPercentage()).toBe(33);
    });
  });

  describe('getEstimatedTimeString', () => {
    it('returns null when no estimated time', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getEstimatedTimeString()).toBeNull();
    });

    it('returns seconds only format', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
      });

      act(() => {
        vi.advanceTimersByTime(10000); // 10 seconds for 5 items
        result.current.updateProgress(5);
      });

      // 5 remaining, 2 seconds each = 10s remaining
      expect(result.current.getEstimatedTimeString()).toBe('10s remaining');
    });

    it('returns minutes and seconds format', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(100);
      });

      act(() => {
        vi.advanceTimersByTime(100000); // 100 seconds for 50 items
        result.current.updateProgress(50);
      });

      // 50 remaining, 2 seconds each = 100s = 1m 40s remaining
      expect(result.current.getEstimatedTimeString()).toBe('1m 40s remaining');
    });
  });

  describe('getPhaseDescription', () => {
    it('returns preparing description', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getPhaseDescription()).toBe('Preparing message generation...');
    });

    it('returns generating description with connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3, 'John Doe');
      });

      expect(result.current.getPhaseDescription()).toBe('Generating message for John Doe...');
    });

    it('returns generic generating description without name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3);
      });

      expect(result.current.getPhaseDescription()).toBe('Generating messages...');
    });

    it('returns waiting_approval description', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3, undefined, 'waiting_approval');
      });

      expect(result.current.getPhaseDescription()).toBe('Waiting for your approval...');
    });

    it('returns completed description', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(10, undefined, 'completed');
      });

      expect(result.current.getPhaseDescription()).toBe('Message generation completed!');
    });

    it('returns error description', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
        result.current.updateProgress(3, undefined, 'error');
      });

      expect(result.current.getPhaseDescription()).toBe('An error occurred during generation');
    });
  });
});
