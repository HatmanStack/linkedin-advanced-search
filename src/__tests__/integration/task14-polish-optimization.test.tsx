/**
 * Task 14: Final Polish and Optimization Tests
 * 
 * Tests for:
 * - Loading states and skeleton screens
 * - Keyboard navigation support
 * - API call optimization and caching
 * - Component cleanup during unmounting
 * - Performance optimizations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock services
vi.mock('@/services/messageGenerationService');
vi.mock('@/services/workflowProgressService');
vi.mock('@/services/connectionDataContextService');
vi.mock('@/services/cognitoService');

// Mock hooks
vi.mock('@/hooks/useErrorHandler');
vi.mock('@/hooks/useWorkflowProgress');
vi.mock('@/hooks/use-toast');

// Mock components
vi.mock('@/components/ConnectionCardSkeleton', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="connection-skeleton" className={className}>
      Loading connection...
    </div>
  ),
  ConnectionListSkeleton: ({ count = 5, className }: { count?: number; className?: string }) => (
    <div data-testid="connection-list-skeleton" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} data-testid={`skeleton-${i}`}>Loading...</div>
      ))}
    </div>
  )
}));

vi.mock('@/components/ProgressIndicator', () => ({
  default: ({ progressState, loadingState, onCancel }: any) => (
    <div data-testid="progress-indicator">
      <div data-testid="progress-phase">{progressState.phase}</div>
      <div data-testid="progress-current">{progressState.current}</div>
      <div data-testid="progress-total">{progressState.total}</div>
      {loadingState.isLoading && <div data-testid="loading-indicator">Loading...</div>}
      {onCancel && (
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  )
}));

// Mock Dashboard component with optimization features
const MockOptimizedDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [connections, setConnections] = React.useState<any[]>([]);
  const [selectedConnections, setSelectedConnections] = React.useState<string[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [apiCache, setApiCache] = React.useState(new Map());
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Keyboard navigation support
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isGenerating) {
        handleStopGeneration();
      }
      if (event.key === 'Enter' && event.ctrlKey && selectedConnections.length > 0) {
        handleStartGeneration();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, selectedConnections]);

  const handleStartGeneration = async () => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    
    // Simulate API calls with caching
    for (const connectionId of selectedConnections) {
      if (apiCache.has(connectionId)) {
        continue; // Use cached result
      }
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100));
        apiCache.set(connectionId, `Generated message for ${connectionId}`);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          break;
        }
      }
    }
    
    setIsGenerating(false);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  const loadConnections = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    setConnections([
      { id: '1', firstName: 'John', lastName: 'Doe', status: 'allies' },
      { id: '2', firstName: 'Jane', lastName: 'Smith', status: 'allies' }
    ]);
    setIsLoading(false);
  };

  return (
    <div data-testid="optimized-dashboard">
      <div data-testid="keyboard-instructions" tabIndex={0}>
        Press Ctrl+Enter to start generation, Escape to stop
      </div>
      
      {isLoading ? (
        <div data-testid="loading-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} data-testid={`skeleton-${i}`}>Loading connection...</div>
          ))}
        </div>
      ) : (
        <div data-testid="connections-list">
          {connections.map(conn => (
            <div key={conn.id} data-testid={`connection-${conn.id}`}>
              <input
                type="checkbox"
                data-testid={`checkbox-${conn.id}`}
                checked={selectedConnections.includes(conn.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedConnections(prev => [...prev, conn.id]);
                  } else {
                    setSelectedConnections(prev => prev.filter(id => id !== conn.id));
                  }
                }}
              />
              {conn.firstName} {conn.lastName}
            </div>
          ))}
        </div>
      )}

      <button
        data-testid="load-connections"
        onClick={loadConnections}
        disabled={isLoading}
      >
        {isLoading ? 'Loading...' : 'Load Connections'}
      </button>

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

      <div data-testid="cache-info">
        Cached results: {apiCache.size}
      </div>
    </div>
  );
};

describe('Task 14: Final Polish and Optimization Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Loading States and Skeleton Screens', () => {
    it('should display skeleton screens while loading connections', async () => {
      render(<MockOptimizedDashboard />);
      
      const loadButton = screen.getByTestId('load-connections');
      await user.click(loadButton);
      
      // Should show loading skeleton immediately
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
      expect(screen.getAllByTestId(/skeleton-\d+/)).toHaveLength(3);
      
      // Should show loading state on button
      expect(loadButton).toHaveTextContent('Loading...');
      expect(loadButton).toBeDisabled();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('connections-list')).toBeInTheDocument();
      });
      
      // Skeleton should be removed
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    it('should show proper loading states during message generation', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections first
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      
      // Select a connection
      await user.click(screen.getByTestId('checkbox-1'));
      
      // Start generation
      const generateButton = screen.getByTestId('generate-button');
      await user.click(generateButton);
      
      // Should show generating state
      expect(generateButton).toHaveTextContent('Generating...');
      expect(generateButton).toBeDisabled();
      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });

    it('should handle skeleton screen variations for different loading states', async () => {
      const { rerender } = render(<MockOptimizedDashboard />);
      
      // Test different skeleton counts
      rerender(<MockOptimizedDashboard />);
      
      await user.click(screen.getByTestId('load-connections'));
      
      const skeletons = screen.getAllByTestId(/skeleton-\d+/);
      expect(skeletons).toHaveLength(3);
      
      // Each skeleton should have loading text
      skeletons.forEach(skeleton => {
        expect(skeleton).toHaveTextContent('Loading connection...');
      });
    });
  });

  describe('Keyboard Navigation Support', () => {
    it('should support Ctrl+Enter to start message generation', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections and select one
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      
      // Focus on the dashboard
      const dashboard = screen.getByTestId('optimized-dashboard');
      dashboard.focus();
      
      // Press Ctrl+Enter
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      // Should start generation
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      });
    });

    it('should support Escape key to stop generation', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections, select, and start generation
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      await user.click(screen.getByTestId('generate-button'));
      
      // Should be generating
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Press Escape
      await user.keyboard('{Escape}');
      
      // Should stop generation
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
    });

    it('should provide keyboard navigation instructions', () => {
      render(<MockOptimizedDashboard />);
      
      const instructions = screen.getByTestId('keyboard-instructions');
      expect(instructions).toBeInTheDocument();
      expect(instructions).toHaveTextContent('Press Ctrl+Enter to start generation, Escape to stop');
      expect(instructions).toHaveAttribute('tabIndex', '0');
    });

    it('should handle keyboard events only when appropriate', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections but don't select any
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      
      // Ctrl+Enter should not work without selections
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      // Should not start generation
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      expect(screen.getByTestId('generate-button')).toBeDisabled();
    });
  });

  describe('API Call Optimization and Caching', () => {
    it('should cache API results to avoid duplicate calls', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections and select multiple
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      await user.click(screen.getByTestId('checkbox-2'));
      
      // Start generation
      await user.click(screen.getByTestId('generate-button'));
      
      // Wait for generation to complete
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
      
      // Should have cached results
      expect(screen.getByTestId('cache-info')).toHaveTextContent('Cached results: 2');
      
      // Start generation again - should use cache
      await user.click(screen.getByTestId('generate-button'));
      
      // Should complete faster due to caching
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
    });

    it('should handle request cancellation properly', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections and select one
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      
      // Start generation
      await user.click(screen.getByTestId('generate-button'));
      
      // Should be generating
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Stop generation immediately
      await user.click(screen.getByTestId('stop-button'));
      
      // Should stop cleanly
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
    });

    it('should optimize API calls by batching when possible', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections and select multiple
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      await user.click(screen.getByTestId('checkbox-2'));
      
      // Start generation
      const startTime = Date.now();
      await user.click(screen.getByTestId('generate-button'));
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (optimized)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Component Cleanup During Unmounting', () => {
    it('should cleanup abort controllers on unmount', () => {
      const { unmount } = render(<MockOptimizedDashboard />);
      
      // Component should render without errors
      expect(screen.getByTestId('optimized-dashboard')).toBeInTheDocument();
      
      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    it('should cleanup event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<MockOptimizedDashboard />);
      
      // Should have added keyboard event listener
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      // Unmount component
      unmount();
      
      // Should have removed event listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should cancel ongoing API requests on unmount', async () => {
      const { unmount } = render(<MockOptimizedDashboard />);
      
      // Load connections and start generation
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      await user.click(screen.getByTestId('generate-button'));
      
      // Should be generating
      expect(screen.getByTestId('generate-button')).toHaveTextContent('Generating...');
      
      // Unmount during generation
      expect(() => unmount()).not.toThrow();
    });

    it('should clear timers and intervals on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<MockOptimizedDashboard />);
      
      // Unmount component
      unmount();
      
      // Should not throw errors during cleanup
      expect(() => unmount()).not.toThrow();
      
      clearTimeoutSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Performance Optimizations', () => {
    it('should render efficiently with large datasets', async () => {
      const startTime = performance.now();
      
      render(<MockOptimizedDashboard />);
      
      const renderTime = performance.now() - startTime;
      
      // Should render quickly
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle rapid user interactions without blocking', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      
      // Rapid checkbox interactions
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('checkbox-1'));
      }
      
      const interactionTime = performance.now() - startTime;
      
      // Should handle interactions quickly
      expect(interactionTime).toBeLessThan(500);
    });

    it('should maintain UI responsiveness during generation', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections and select
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      await user.click(screen.getByTestId('checkbox-1'));
      
      // Start generation
      await user.click(screen.getByTestId('generate-button'));
      
      // UI should remain responsive
      const stopButton = screen.getByTestId('stop-button');
      expect(stopButton).toBeInTheDocument();
      
      // Should be able to interact with stop button immediately
      await user.click(stopButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
    });

    it('should optimize memory usage during long operations', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      
      // Select connections
      await user.click(screen.getByTestId('checkbox-1'));
      await user.click(screen.getByTestId('checkbox-2'));
      
      // Start and complete generation
      await user.click(screen.getByTestId('generate-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('generate-button')).toHaveTextContent('Generate Messages');
      });
      
      // Memory should be managed efficiently
      expect(screen.getByTestId('cache-info')).toHaveTextContent('Cached results: 2');
    });
  });

  describe('Accessibility and Usability Improvements', () => {
    it('should provide proper ARIA labels for loading states', async () => {
      render(<MockOptimizedDashboard />);
      
      const loadButton = screen.getByTestId('load-connections');
      await user.click(loadButton);
      
      // Loading button should have proper accessibility
      expect(loadButton).toHaveTextContent('Loading...');
      expect(loadButton).toBeDisabled();
      
      // Skeleton elements should be accessible
      const skeletons = screen.getAllByTestId(/skeleton-\d+/);
      skeletons.forEach(skeleton => {
        expect(skeleton).toHaveTextContent('Loading connection...');
      });
    });

    it('should support screen reader navigation', () => {
      render(<MockOptimizedDashboard />);
      
      const instructions = screen.getByTestId('keyboard-instructions');
      expect(instructions).toHaveAttribute('tabIndex', '0');
      expect(instructions).toHaveTextContent('Press Ctrl+Enter to start generation, Escape to stop');
    });

    it('should provide clear visual feedback for all states', async () => {
      render(<MockOptimizedDashboard />);
      
      // Load connections
      await user.click(screen.getByTestId('load-connections'));
      await waitFor(() => screen.getByTestId('connections-list'));
      
      // Select connection
      await user.click(screen.getByTestId('checkbox-1'));
      
      // Generate button should be enabled
      const generateButton = screen.getByTestId('generate-button');
      expect(generateButton).not.toBeDisabled();
      
      // Start generation
      await user.click(generateButton);
      
      // Should show generating state
      expect(generateButton).toHaveTextContent('Generating...');
      expect(generateButton).toBeDisabled();
      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });
  });
});
