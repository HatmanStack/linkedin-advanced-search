/**
 * Unit tests for message generation workflow state machine
 * 
 * Tests the workflow state transitions and error handling logic
 * for the message generation feature in Dashboard component.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the workflow state machine logic
type WorkflowState = 'idle' | 'generating' | 'awaiting_approval' | 'stopping' | 'completed' | 'error';

interface WorkflowContext {
  state: WorkflowState;
  selectedConnections: string[];
  conversationTopic: string;
  currentConnectionIndex: number;
  generationError: string | null;
}

class MessageGenerationWorkflow {
  private context: WorkflowContext;

  constructor() {
    this.context = {
      state: 'idle',
      selectedConnections: [],
      conversationTopic: '',
      currentConnectionIndex: 0,
      generationError: null
    };
  }

  getState(): WorkflowState {
    return this.context.state;
  }

  getContext(): WorkflowContext {
    return { ...this.context };
  }

  canStartGeneration(selectedConnections?: string[], topic?: string): boolean {
    const connections = selectedConnections || this.context.selectedConnections;
    const conversationTopic = topic || this.context.conversationTopic;
    
    return connections.length > 0 && 
           conversationTopic.trim() !== '' &&
           this.context.state === 'idle';
  }

  startGeneration(selectedConnections: string[], topic: string): void {
    if (!this.canStartGeneration(selectedConnections, topic)) {
      throw new Error('Cannot start generation: invalid state or missing requirements');
    }

    this.context.selectedConnections = selectedConnections;
    this.context.conversationTopic = topic;
    this.context.currentConnectionIndex = 0;
    this.context.generationError = null;
    this.context.state = 'generating';
  }

  moveToAwaitingApproval(): void {
    if (this.context.state !== 'generating') {
      throw new Error('Cannot move to awaiting approval from current state');
    }
    this.context.state = 'awaiting_approval';
  }

  approveAndNext(): void {
    if (this.context.state !== 'awaiting_approval') {
      throw new Error('Cannot approve from current state');
    }

    this.context.currentConnectionIndex++;
    
    if (this.context.currentConnectionIndex >= this.context.selectedConnections.length) {
      this.context.state = 'completed';
    } else {
      this.context.state = 'generating';
    }
  }

  skipConnection(): void {
    if (this.context.state !== 'awaiting_approval') {
      throw new Error('Cannot skip from current state');
    }
    this.approveAndNext(); // Same logic as approve
  }

  stopGeneration(): void {
    if (this.context.state === 'generating' || this.context.state === 'awaiting_approval') {
      this.context.state = 'stopping';
    }
  }

  handleError(error: string): void {
    this.context.generationError = error;
    this.context.state = 'error';
  }

  reset(): void {
    this.context = {
      state: 'idle',
      selectedConnections: [],
      conversationTopic: '',
      currentConnectionIndex: 0,
      generationError: null
    };
  }
}

describe('MessageGenerationWorkflow', () => {
  let workflow: MessageGenerationWorkflow;

  beforeEach(() => {
    workflow = new MessageGenerationWorkflow();
  });

  describe('Initial State', () => {
    it('should start in idle state', () => {
      expect(workflow.getState()).toBe('idle');
    });

    it('should have empty context initially', () => {
      const context = workflow.getContext();
      expect(context.selectedConnections).toEqual([]);
      expect(context.conversationTopic).toBe('');
      expect(context.currentConnectionIndex).toBe(0);
      expect(context.generationError).toBeNull();
    });
  });

  describe('Generation Start Validation', () => {
    it('should not allow generation without selected connections', () => {
      expect(workflow.canStartGeneration([], 'topic')).toBe(false);
    });

    it('should not allow generation without conversation topic', () => {
      expect(workflow.canStartGeneration(['conn1'], '')).toBe(false);
    });

    it('should allow generation with valid requirements', () => {
      expect(() => {
        workflow.startGeneration(['conn1', 'conn2'], 'Test topic');
      }).not.toThrow();
      
      expect(workflow.getState()).toBe('generating');
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      workflow.startGeneration(['conn1', 'conn2'], 'Test topic');
    });

    it('should transition from generating to awaiting_approval', () => {
      workflow.moveToAwaitingApproval();
      expect(workflow.getState()).toBe('awaiting_approval');
    });

    it('should transition from awaiting_approval to generating on approve', () => {
      workflow.moveToAwaitingApproval();
      workflow.approveAndNext();
      expect(workflow.getState()).toBe('generating');
      expect(workflow.getContext().currentConnectionIndex).toBe(1);
    });

    it('should transition to completed when all connections processed', () => {
      workflow.moveToAwaitingApproval();
      workflow.approveAndNext(); // Move to connection 1
      workflow.moveToAwaitingApproval();
      workflow.approveAndNext(); // Move to connection 2 (completed)
      expect(workflow.getState()).toBe('completed');
    });

    it('should handle skip connection same as approve', () => {
      workflow.moveToAwaitingApproval();
      workflow.skipConnection();
      expect(workflow.getState()).toBe('generating');
      expect(workflow.getContext().currentConnectionIndex).toBe(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      workflow.startGeneration(['conn1'], 'Test topic');
    });

    it('should transition to error state on error', () => {
      const errorMessage = 'API call failed';
      workflow.handleError(errorMessage);
      
      expect(workflow.getState()).toBe('error');
      expect(workflow.getContext().generationError).toBe(errorMessage);
    });
  });

  describe('Stop Generation', () => {
    it('should allow stopping from generating state', () => {
      workflow.startGeneration(['conn1'], 'Test topic');
      workflow.stopGeneration();
      expect(workflow.getState()).toBe('stopping');
    });

    it('should allow stopping from awaiting_approval state', () => {
      workflow.startGeneration(['conn1'], 'Test topic');
      workflow.moveToAwaitingApproval();
      workflow.stopGeneration();
      expect(workflow.getState()).toBe('stopping');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to initial state', () => {
      workflow.startGeneration(['conn1'], 'Test topic');
      workflow.moveToAwaitingApproval();
      workflow.reset();
      
      expect(workflow.getState()).toBe('idle');
      const context = workflow.getContext();
      expect(context.selectedConnections).toEqual([]);
      expect(context.conversationTopic).toBe('');
      expect(context.currentConnectionIndex).toBe(0);
      expect(context.generationError).toBeNull();
    });
  });

  describe('Invalid State Transitions', () => {
    it('should throw error when trying to approve from wrong state', () => {
      expect(() => {
        workflow.approveAndNext();
      }).toThrow('Cannot approve from current state');
    });

    it('should throw error when trying to move to awaiting approval from wrong state', () => {
      expect(() => {
        workflow.moveToAwaitingApproval();
      }).toThrow('Cannot move to awaiting approval from current state');
    });
  });
});
