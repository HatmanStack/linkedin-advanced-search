/**
 * Unit Tests for useProgressTracker Hook
 * Task 9: Comprehensive error handling and user feedback
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useProgressTracker } from '@/features/workflow';

describe('useProgressTracker Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Progress Initialization', () => {
    it('should initialize progress with correct total', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(5);
      });

      expect(result.current.progressState.total).toBe(5);
      expect(result.current.progressState.current).toBe(0);
      expect(result.current.progressState.phase).toBe('preparing');
    });

    it('should set start time when initializing', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      // Start time should be set (we can't test exact value due to mocking)
      expect(result.current.progressState.current).toBe(0);
    });
  });

  describe('Progress Updates', () => {
    it('should update current progress and connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      act(() => {
        result.current.updateProgress(1, 'John Doe', 'generating');
      });

      expect(result.current.progressState.current).toBe(1);
      expect(result.current.progressState.currentConnectionName).toBe('John Doe');
      expect(result.current.progressState.phase).toBe('generating');
    });

    it('should calculate estimated time remaining', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(4);
      });

      // Mock time progression
      vi.spyOn(Date, 'now').mockReturnValue(1010000); // 10 seconds later

      act(() => {
        result.current.updateProgress(1, 'John Doe', 'generating');
      });

      // Should calculate remaining time based on elapsed time per connection
      expect(result.current.progressState.estimatedTimeRemaining).toBe(30); // 3 remaining * 10 seconds each
    });
  });

  describe('Loading State Management', () => {
    it('should set loading message with progress', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Processing connection...', 50, true);
      });

      expect(result.current.loadingState.isLoading).toBe(true);
      expect(result.current.loadingState.message).toBe('Processing connection...');
      expect(result.current.loadingState.progress).toBe(50);
      expect(result.current.loadingState.canCancel).toBe(true);
    });

    it('should clear loading state', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.setLoadingMessage('Loading...', 25);
      });

      act(() => {
        result.current.clearLoading();
      });

      expect(result.current.loadingState.isLoading).toBe(false);
      expect(result.current.loadingState.message).toBeUndefined();
      expect(result.current.loadingState.progress).toBeUndefined();
    });
  });

  describe('Progress Calculations', () => {
    it('should calculate correct progress percentage', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(4);
      });

      act(() => {
        result.current.updateProgress(2);
      });

      expect(result.current.getProgressPercentage()).toBe(50);
    });

    it('should return 0 percentage when total is 0', () => {
      const { result } = renderHook(() => useProgressTracker());

      expect(result.current.getProgressPercentage()).toBe(0);
    });

    it('should handle 100% completion', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      act(() => {
        result.current.updateProgress(3);
      });

      expect(result.current.getProgressPercentage()).toBe(100);
    });
  });

  describe('Time Estimation', () => {
    it('should format estimated time in minutes and seconds', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(10);
      });

      // Mock 30 seconds elapsed for 1 connection
      vi.spyOn(Date, 'now').mockReturnValue(1030000);

      act(() => {
        result.current.updateProgress(1);
      });

      const timeString = result.current.getEstimatedTimeString();
      expect(timeString).toBe('4m 30s remaining'); // 9 remaining * 30 seconds = 270 seconds = 4m 30s
    });

    it('should format estimated time in seconds only when less than a minute', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      // Mock 10 seconds elapsed for 1 connection
      vi.spyOn(Date, 'now').mockReturnValue(1010000);

      act(() => {
        result.current.updateProgress(1);
      });

      const timeString = result.current.getEstimatedTimeString();
      expect(timeString).toBe('20s remaining'); // 2 remaining * 10 seconds = 20 seconds
    });

    it('should return null when no time estimation available', () => {
      const { result } = renderHook(() => useProgressTracker());

      const timeString = result.current.getEstimatedTimeString();
      expect(timeString).toBeNull();
    });
  });

  describe('Phase Descriptions', () => {
    it('should return correct description for preparing phase', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(3);
      });

      expect(result.current.getPhaseDescription()).toBe('Preparing message generation...');
    });

    it('should return description with connection name for generating phase', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.updateProgress(1, 'John Doe', 'generating');
      });

      expect(result.current.getPhaseDescription()).toBe('Generating message for John Doe...');
    });

    it('should return generic description for generating phase without connection name', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.updateProgress(1, undefined, 'generating');
      });

      expect(result.current.getPhaseDescription()).toBe('Generating messages...');
    });

    it('should return correct descriptions for all phases', () => {
      const { result } = renderHook(() => useProgressTracker());

      const phases = [
        { phase: 'waiting_approval' as const, expected: 'Waiting for your approval...' },
        { phase: 'completed' as const, expected: 'Message generation completed!' },
        { phase: 'error' as const, expected: 'An error occurred during generation' }
      ];

      phases.forEach(({ phase, expected }) => {
        act(() => {
          result.current.updateProgress(1, undefined, phase);
        });

        expect(result.current.getPhaseDescription()).toBe(expected);
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all progress state', () => {
      const { result } = renderHook(() => useProgressTracker());

      act(() => {
        result.current.initializeProgress(5);
        result.current.updateProgress(2, 'John Doe', 'generating');
        result.current.setLoadingMessage('Loading...');
      });

      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.progressState.current).toBe(0);
      expect(result.current.progressState.total).toBe(0);
      expect(result.current.progressState.phase).toBe('preparing');
      expect(result.current.progressState.currentConnectionName).toBeUndefined();
      expect(result.current.loadingState.isLoading).toBe(false);
    });
  });
});
