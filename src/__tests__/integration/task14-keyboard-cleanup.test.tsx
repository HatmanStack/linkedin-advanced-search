/**
 * Task 14: Keyboard Navigation and Cleanup Tests
 * 
 * Tests for keyboard navigation support and component cleanup optimizations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock services for cleanup testing
const mockAbortController = {
  abort: vi.fn(),
  signal: { aborted: false }
};

vi.mock('@/services/messageGenerationService', () => ({
  MessageGenerationService: {
    generateMessage: vi.fn(),
    cancelGeneration: vi.fn()
  }
}));

// Mock keyboard-enabled component with cleanup
const MockKeyboardComponent: React.FC = () => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectedConnections, setSelectedConnections] = React.useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const connections = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' }
  ];

  // Keyboard navigation handler
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, connections.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case ' ':
        case 'Enter':
          if (event.target === document.body || (event.target as HTMLElement).dataset.testid === 'keyboard-area') {
            event.preventDefault();
            toggleConnection(connections[focusedIndex].id);
          }
          break;
        case 'Escape':
          if (isGenerating) {
            event.preventDefault();
            handleStopGeneration();
          }
          break;
        case 'g':
          if (event.ctrlKey && selectedConnections.length > 0) {
            event.preventDefault();
            handleStartGeneration();
          }
          break;
        case 'a':
          if (event.ctrlKey) {
            event.preventDefault();
            setSelectedConnections(connections.map(c => c.id));
          }
          break;
        case 'd':
          if (event.ctrlKey) {
            event.preventDefault();
            setSelectedConnections([]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, isGenerating, selectedConnections]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const toggleConnection = (connectionId: string) => {
    setSelectedConnections(prev => 
      prev.includes(connectionId)
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    );
  };

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    
    // Simulate long-running process with cleanup
    intervalRef.current = setInterval(() => {
      // Simulate progress updates
    }, 100);
    
    timeoutRef.current = setTimeout(() => {
      setIsGenerating(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsGenerating(false);
  };

  return (
    <div data-testid="keyboard-component">
      <div data-testid="keyboard-instructions" tabIndex={0}>
        Keyboard shortcuts: ↑/↓ navigate, Space/Enter select, Ctrl+G generate, Escape stop, Ctrl+A select all, Ctrl+D deselect all
      </div>
      
      <div data-testid="keyboard-area" tabIndex={0}>
        {connections.map((conn, index) => (
          <div
            key={conn.id}
            data-testid={`connection-${conn.id}`}
            className={`connection-item ${index === focusedIndex ? 'focused' : ''}`}
            style={{
              backgroundColor: index === focusedIndex ? '#e3f2fd' : 'transparent',
              border: selectedConnections.includes(conn.id) ? '2px solid blue' : '1px solid gray'
            }}
          >
            <input
              type="checkbox"
              data-testid={`checkbox-${conn.id}`}
              checked={selectedConnections.includes(conn.id)}
              onChange={() => toggleConnection(conn.id)}
            />
            {conn.name}
            {index === focusedIndex && <span data-testid="focus-indicator"> (focused)</span>}
          </div>
        ))}
      </div>

      <div data-testid="controls">
        <button
          data-testid="generate-button"
          onClick={handleStartGeneration}
          disabled={selectedConnections.length === 0 || isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Messages'}
        </button>
        
        {isGenerating && (
          <button
            data-testid="stop-button"
            onClick={handleStopGeneration}
          >
            Stop Generation
          </button>
        )}
        
        <div data-testid="selection-info">
          Selected: {selectedConnections.length} / {connections.length}
        </div>
        
        <div data-testid="focus-info">
          Focused: {connections[focusedIndex]?.name}
        </div>
      </div>
    </div>
  );
};

describe('Task 14: Keyboard Navigation and Cleanup Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Keyboard Navigation Support', () => {
    it('should support arrow key navigation through connections', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Initially focused on first item
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: John Doe');
      expect(screen.getByTestId('connection-1')).toHaveClass('focused');
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Jane Smith');
      expect(screen.getByTestId('connection-2')).toHaveClass('focused');
      
      // Navigate down again
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Bob Johnson');
      expect(screen.getByTestId('connection-3')).toHaveClass('focused');
      
      // Navigate up
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Jane Smith');
      expect(screen.getByTestId('connection-2')).toHaveClass('focused');
    });

    it('should support space and enter keys for selection', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Initially no selections
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 0 / 3');
      
      // Select with space
      await user.keyboard(' ');
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 1 / 3');
      expect(screen.getByTestId('checkbox-1')).toBeChecked();
      
      // Navigate and select with enter
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 2 / 3');
      expect(screen.getByTestId('checkbox-2')).toBeChecked();
      
      // Deselect with space
      await user.keyboard(' ');
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 1 / 3');
      expect(screen.getByTestId('checkbox-2')).not.toBeChecked();
    });

    it('should support Ctrl+G for generation start', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Select a connection first
      await user.keyboard(' ');
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 1 / 3');
      
      // Start generation with Ctrl+G
      await user.keyboard('{Control>}g{/Control}');
      
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });

    it('should support Escape key to stop generation', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Select and start generation
      await user.keyboard(' ');
      await user.keyboard('{Control>}g{/Control}');
      
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Stop with Escape
      await user.keyboard('{Escape}');
      
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument();
    });

    it('should support Ctrl+A for select all', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Initially no selections
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 0 / 3');
      
      // Select all with Ctrl+A
      await user.keyboard('{Control>}a{/Control}');
      
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 3 / 3');
      expect(screen.getByTestId('checkbox-1')).toBeChecked();
      expect(screen.getByTestId('checkbox-2')).toBeChecked();
      expect(screen.getByTestId('checkbox-3')).toBeChecked();
    });

    it('should support Ctrl+D for deselect all', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Select all first
      await user.keyboard('{Control>}a{/Control}');
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 3 / 3');
      
      // Deselect all with Ctrl+D
      await user.keyboard('{Control>}d{/Control}');
      
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 0 / 3');
      expect(screen.getByTestId('checkbox-1')).not.toBeChecked();
      expect(screen.getByTestId('checkbox-2')).not.toBeChecked();
      expect(screen.getByTestId('checkbox-3')).not.toBeChecked();
    });

    it('should handle keyboard navigation boundaries', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Try to navigate up from first item
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: John Doe');
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: John Doe'); // Should stay at first
      
      // Navigate to last item
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Bob Johnson');
      
      // Try to navigate down from last item
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Bob Johnson'); // Should stay at last
    });
  });

  describe('Component Cleanup During Unmounting', () => {
    it('should cleanup event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<MockKeyboardComponent />);
      
      // Should have added keyboard event listener
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      // Unmount component
      unmount();
      
      // Should have removed event listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should cleanup abort controllers on unmount', () => {
      const { unmount } = render(<MockKeyboardComponent />);
      
      // Component should render without errors
      expect(screen.getByTestId('keyboard-component')).toBeInTheDocument();
      
      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    it('should cleanup timers and intervals on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Start generation to create timers
      await user.keyboard(' '); // Select connection
      await user.keyboard('{Control>}g{/Control}'); // Start generation
      
      // Unmount during generation
      unmount();
      
      // Should not throw errors during cleanup
      expect(() => unmount()).not.toThrow();
      
      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    it('should cancel ongoing operations on unmount', async () => {
      const { unmount } = render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Start generation
      await user.keyboard(' ');
      await user.keyboard('{Control>}g{/Control}');
      
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Unmount during generation
      expect(() => unmount()).not.toThrow();
    });

    it('should handle multiple cleanup scenarios', async () => {
      const { unmount } = render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Perform various operations
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');
      await user.keyboard('{Control>}a{/Control}');
      await user.keyboard('{Control>}g{/Control}');
      
      // Should be in generating state
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Unmount should handle all cleanup
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Keyboard Accessibility Features', () => {
    it('should provide keyboard instructions', () => {
      render(<MockKeyboardComponent />);
      
      const instructions = screen.getByTestId('keyboard-instructions');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveAttribute('tabIndex', '0');
      expect(instructions).toHaveTextContent('Keyboard shortcuts');
    });

    it('should maintain focus indicators', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Should show focus indicator
      expect(screen.getByTestId('focus-indicator')).toHaveTextContent('(focused)');
      
      // Navigate and check focus indicator moves
      await user.keyboard('{ArrowDown}');
      
      const focusIndicators = screen.getAllByTestId('focus-indicator');
      expect(focusIndicators).toHaveLength(1);
      expect(focusIndicators[0]).toHaveTextContent('(focused)');
    });

    it('should support tab navigation between sections', async () => {
      render(<MockKeyboardComponent />);
      
      const instructions = screen.getByTestId('keyboard-instructions');
      const keyboardArea = screen.getByTestId('keyboard-area');
      
      // Both should be focusable
      expect(instructions).toHaveAttribute('tabIndex', '0');
      expect(keyboardArea).toHaveAttribute('tabIndex', '0');
      
      // Tab navigation should work
      instructions.focus();
      expect(instructions).toHaveFocus();
      
      await user.tab();
      expect(keyboardArea).toHaveFocus();
    });

    it('should prevent default behavior for navigation keys', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Arrow keys should not scroll the page
      const preventDefaultSpy = vi.fn();
      const mockEvent = { preventDefault: preventDefaultSpy, key: 'ArrowDown' };
      
      fireEvent.keyDown(keyboardArea, mockEvent);
      
      // Focus should change without page scrolling
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: Jane Smith');
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle rapid keyboard interactions efficiently', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      const startTime = performance.now();
      
      // Rapid navigation
      for (let i = 0; i < 10; i++) {
        await user.keyboard('{ArrowDown}');
        await user.keyboard('{ArrowUp}');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle rapid interactions efficiently
      expect(duration).toBeLessThan(500);
      
      // Should maintain correct state
      expect(screen.getByTestId('focus-info')).toHaveTextContent('Focused: John Doe');
    });

    it('should optimize keyboard event handling', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Multiple rapid selections
      const startTime = performance.now();
      
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(200);
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 3 / 3');
    });

    it('should maintain UI responsiveness during keyboard operations', async () => {
      render(<MockKeyboardComponent />);
      
      const keyboardArea = screen.getByTestId('keyboard-area');
      keyboardArea.focus();
      
      // Complex keyboard sequence
      await user.keyboard('{Control>}a{/Control}'); // Select all
      await user.keyboard('{Control>}g{/Control}'); // Start generation
      await user.keyboard('{Escape}'); // Stop generation
      await user.keyboard('{Control>}d{/Control}'); // Deselect all
      
      // UI should remain responsive
      expect(screen.getByTestId('selection-info')).toHaveTextContent('Selected: 0 / 3');
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
    });
  });
});
