import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowStateMachine } from './useWorkflowStateMachine';

describe('useWorkflowStateMachine', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    expect(result.current.state).toBe('idle');
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.isAwaitingApproval).toBe(false);
  });

  it('transitions to generating on startGenerating', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });

    expect(result.current.state).toBe('generating');
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.currentIndex).toBe(0);
  });

  it('transitions to awaiting_approval on awaitApproval', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.awaitApproval();
    });

    expect(result.current.state).toBe('awaiting_approval');
    expect(result.current.isAwaitingApproval).toBe(true);
  });

  it('increments currentIndex on approveAndContinue', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.awaitApproval();
    });
    act(() => {
      result.current.approveAndContinue();
    });

    expect(result.current.state).toBe('generating');
    expect(result.current.currentIndex).toBe(1);
  });

  it('transitions to stopping on stop', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.state).toBe('stopping');
    expect(result.current.isStopping).toBe(true);
  });

  it('transitions to completed on complete', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.complete();
    });

    expect(result.current.state).toBe('completed');
  });

  it('transitions to error on setError', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.setError();
    });

    expect(result.current.state).toBe('error');
  });

  it('resets state on reset', () => {
    const { result } = renderHook(() => useWorkflowStateMachine());

    act(() => {
      result.current.startGenerating();
    });
    act(() => {
      result.current.approveAndContinue();
    });
    act(() => {
      result.current.approveAndContinue();
    });

    expect(result.current.currentIndex).toBe(2);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.currentIndex).toBe(0);
  });
});
