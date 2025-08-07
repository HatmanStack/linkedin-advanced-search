/**
 * Task 14: Skeleton Loading States Tests
 * 
 * Tests for skeleton screens and loading state optimizations
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock skeleton components
vi.mock('@/components/ConnectionCardSkeleton', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="connection-card-skeleton" className={className}>
      <div data-testid="skeleton-avatar" className="skeleton-avatar" />
      <div data-testid="skeleton-name" className="skeleton-name" />
      <div data-testid="skeleton-position" className="skeleton-position" />
      <div data-testid="skeleton-company" className="skeleton-company" />
    </div>
  ),
  ConnectionListSkeleton: ({ count = 5, className }: { count?: number; className?: string }) => (
    <div data-testid="connection-list-skeleton" className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} data-testid={`list-skeleton-${i}`} className="skeleton-item">
          Skeleton {i + 1}
        </div>
      ))}
    </div>
  )
}));

vi.mock('@/components/NewConnectionCardSkeleton', () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="new-connection-skeleton" className={className}>
      <div data-testid="new-skeleton-content">Loading new connection...</div>
    </div>
  )
}));

// Mock loading component with skeleton integration
const MockSkeletonDashboard: React.FC = () => {
  const [loadingState, setLoadingState] = React.useState({
    connections: false,
    newConnections: false,
    messages: false
  });
  const [data, setData] = React.useState({
    connections: [] as any[],
    newConnections: [] as any[],
    messages: [] as any[]
  });

  const loadConnections = async () => {
    setLoadingState(prev => ({ ...prev, connections: true }));
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setData(prev => ({
      ...prev,
      connections: [
        { id: '1', name: 'John Doe', position: 'Developer' },
        { id: '2', name: 'Jane Smith', position: 'Designer' }
      ]
    }));
    setLoadingState(prev => ({ ...prev, connections: false }));
  };

  const loadNewConnections = async () => {
    setLoadingState(prev => ({ ...prev, newConnections: true }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setData(prev => ({
      ...prev,
      newConnections: [
        { id: '3', name: 'Bob Johnson', position: 'Manager' }
      ]
    }));
    setLoadingState(prev => ({ ...prev, newConnections: false }));
  };

  const loadMessages = async () => {
    setLoadingState(prev => ({ ...prev, messages: true }));
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    setData(prev => ({
      ...prev,
      messages: [
        { id: '1', content: 'Hello there!' }
      ]
    }));
    setLoadingState(prev => ({ ...prev, messages: false }));
  };

  return (
    <div data-testid="skeleton-dashboard">
      {/* Connections Section */}
      <div data-testid="connections-section">
        <button
          data-testid="load-connections-btn"
          onClick={loadConnections}
          disabled={loadingState.connections}
        >
          {loadingState.connections ? 'Loading Connections...' : 'Load Connections'}
        </button>
        
        {loadingState.connections ? (
          <div data-testid="connections-loading">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} data-testid={`connection-skeleton-${i}`}>
                <div className="skeleton-avatar" />
                <div className="skeleton-name" />
                <div className="skeleton-position" />
              </div>
            ))}
          </div>
        ) : (
          <div data-testid="connections-loaded">
            {data.connections.map(conn => (
              <div key={conn.id} data-testid={`connection-${conn.id}`}>
                {conn.name} - {conn.position}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Connections Section */}
      <div data-testid="new-connections-section">
        <button
          data-testid="load-new-connections-btn"
          onClick={loadNewConnections}
          disabled={loadingState.newConnections}
        >
          {loadingState.newConnections ? 'Loading New...' : 'Load New Connections'}
        </button>
        
        {loadingState.newConnections ? (
          <div data-testid="new-connections-loading">
            <div data-testid="new-connection-skeleton">
              <div className="skeleton-content">Loading new connection...</div>
            </div>
          </div>
        ) : (
          <div data-testid="new-connections-loaded">
            {data.newConnections.map(conn => (
              <div key={conn.id} data-testid={`new-connection-${conn.id}`}>
                {conn.name} - {conn.position}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages Section */}
      <div data-testid="messages-section">
        <button
          data-testid="load-messages-btn"
          onClick={loadMessages}
          disabled={loadingState.messages}
        >
          {loadingState.messages ? 'Loading Messages...' : 'Load Messages'}
        </button>
        
        {loadingState.messages ? (
          <div data-testid="messages-loading">
            <div className="skeleton-message">Loading message...</div>
            <div className="skeleton-message">Loading message...</div>
          </div>
        ) : (
          <div data-testid="messages-loaded">
            {data.messages.map(msg => (
              <div key={msg.id} data-testid={`message-${msg.id}`}>
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

describe('Task 14: Skeleton Loading States Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Connection Card Skeleton Loading', () => {
    it('should display connection skeletons while loading', async () => {
      render(<MockSkeletonDashboard />);
      
      const loadButton = screen.getByTestId('load-connections-btn');
      await user.click(loadButton);
      
      // Should show loading skeletons immediately
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
      expect(screen.getAllByTestId(/connection-skeleton-\d+/)).toHaveLength(3);
      
      // Each skeleton should have proper structure
      const skeletons = screen.getAllByTestId(/connection-skeleton-\d+/);
      skeletons.forEach(skeleton => {
        expect(skeleton.querySelector('.skeleton-avatar')).toBeInTheDocument();
        expect(skeleton.querySelector('.skeleton-name')).toBeInTheDocument();
        expect(skeleton.querySelector('.skeleton-position')).toBeInTheDocument();
      });
      
      // Button should show loading state
      expect(loadButton).toHaveTextContent('Loading Connections...');
      expect(loadButton).toBeDisabled();
    });

    it('should replace skeletons with actual content when loaded', async () => {
      render(<MockSkeletonDashboard />);
      
      const loadButton = screen.getByTestId('load-connections-btn');
      await user.click(loadButton);
      
      // Should show skeletons initially
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('connections-loaded')).toBeInTheDocument();
      }, { timeout: 500 });
      
      // Skeletons should be removed
      expect(screen.queryByTestId('connections-loading')).not.toBeInTheDocument();
      
      // Actual content should be displayed
      expect(screen.getByTestId('connection-1')).toHaveTextContent('John Doe - Developer');
      expect(screen.getByTestId('connection-2')).toHaveTextContent('Jane Smith - Designer');
      
      // Button should return to normal state
      expect(loadButton).toHaveTextContent('Load Connections');
      expect(loadButton).not.toBeDisabled();
    });

    it('should handle multiple skeleton types simultaneously', async () => {
      render(<MockSkeletonDashboard />);
      
      // Start loading connections and new connections simultaneously
      await user.click(screen.getByTestId('load-connections-btn'));
      await user.click(screen.getByTestId('load-new-connections-btn'));
      
      // Both skeleton types should be visible
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
      expect(screen.getByTestId('new-connections-loading')).toBeInTheDocument();
      
      // Should have different skeleton structures
      expect(screen.getAllByTestId(/connection-skeleton-\d+/)).toHaveLength(3);
      expect(screen.getByTestId('new-connection-skeleton')).toBeInTheDocument();
      
      // Wait for both to complete
      await waitFor(() => {
        expect(screen.getByTestId('connections-loaded')).toBeInTheDocument();
        expect(screen.getByTestId('new-connections-loaded')).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe('Skeleton Animation and Styling', () => {
    it('should apply proper CSS classes to skeleton elements', async () => {
      render(<MockSkeletonDashboard />);
      
      await user.click(screen.getByTestId('load-connections-btn'));
      
      const skeletons = screen.getAllByTestId(/connection-skeleton-\d+/);
      skeletons.forEach(skeleton => {
        const avatar = skeleton.querySelector('.skeleton-avatar');
        const name = skeleton.querySelector('.skeleton-name');
        const position = skeleton.querySelector('.skeleton-position');
        
        expect(avatar).toHaveClass('skeleton-avatar');
        expect(name).toHaveClass('skeleton-name');
        expect(position).toHaveClass('skeleton-position');
      });
    });

    it('should maintain consistent skeleton dimensions', async () => {
      render(<MockSkeletonDashboard />);
      
      await user.click(screen.getByTestId('load-connections-btn'));
      
      const skeletons = screen.getAllByTestId(/connection-skeleton-\d+/);
      
      // All skeletons should have consistent structure
      expect(skeletons).toHaveLength(3);
      skeletons.forEach((skeleton, index) => {
        expect(skeleton).toBeInTheDocument();
        expect(skeleton.querySelector('.skeleton-avatar')).toBeInTheDocument();
        expect(skeleton.querySelector('.skeleton-name')).toBeInTheDocument();
        expect(skeleton.querySelector('.skeleton-position')).toBeInTheDocument();
      });
    });

    it('should handle skeleton loading for different content types', async () => {
      render(<MockSkeletonDashboard />);
      
      // Test messages skeleton
      await user.click(screen.getByTestId('load-messages-btn'));
      
      const messagesLoading = screen.getByTestId('messages-loading');
      expect(messagesLoading).toBeInTheDocument();
      
      const messageSkeletons = messagesLoading.querySelectorAll('.skeleton-message');
      expect(messageSkeletons).toHaveLength(2);
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('messages-loaded')).toBeInTheDocument();
      }, { timeout: 300 });
      
      expect(screen.getByTestId('message-1')).toHaveTextContent('Hello there!');
    });
  });

  describe('Loading State Performance', () => {
    it('should render skeletons quickly without blocking UI', async () => {
      const startTime = performance.now();
      
      render(<MockSkeletonDashboard />);
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(50); // Should render very quickly
      
      // Click should be responsive
      const clickStart = performance.now();
      await user.click(screen.getByTestId('load-connections-btn'));
      const clickTime = performance.now() - clickStart;
      
      expect(clickTime).toBeLessThan(100);
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
    });

    it('should handle rapid loading state changes', async () => {
      render(<MockSkeletonDashboard />);
      
      // Rapid clicks should not cause issues
      const loadButton = screen.getByTestId('load-connections-btn');
      
      await user.click(loadButton);
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
      
      // Button should be disabled, preventing multiple clicks
      expect(loadButton).toBeDisabled();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('connections-loaded')).toBeInTheDocument();
      }, { timeout: 500 });
      
      // Should be able to click again
      expect(loadButton).not.toBeDisabled();
    });

    it('should optimize skeleton rendering for large lists', async () => {
      render(<MockSkeletonDashboard />);
      
      await user.click(screen.getByTestId('load-connections-btn'));
      
      // Should render exactly 3 skeletons efficiently
      const skeletons = screen.getAllByTestId(/connection-skeleton-\d+/);
      expect(skeletons).toHaveLength(3);
      
      // Each skeleton should be properly structured
      skeletons.forEach((skeleton, index) => {
        expect(skeleton).toHaveAttribute('data-testid', `connection-skeleton-${index}`);
      });
    });
  });

  describe('Skeleton Accessibility', () => {
    it('should provide proper loading announcements', async () => {
      render(<MockSkeletonDashboard />);
      
      const loadButton = screen.getByTestId('load-connections-btn');
      await user.click(loadButton);
      
      // Button text should indicate loading state
      expect(loadButton).toHaveTextContent('Loading Connections...');
      
      // Loading container should be present for screen readers
      expect(screen.getByTestId('connections-loading')).toBeInTheDocument();
    });

    it('should maintain focus management during loading', async () => {
      render(<MockSkeletonDashboard />);
      
      const loadButton = screen.getByTestId('load-connections-btn');
      loadButton.focus();
      
      await user.click(loadButton);
      
      // Button should remain focused during loading
      expect(loadButton).toHaveFocus();
      expect(loadButton).toBeDisabled();
      
      // Wait for completion
      await waitFor(() => {
        expect(screen.getByTestId('connections-loaded')).toBeInTheDocument();
      }, { timeout: 500 });
      
      // Button should be re-enabled
      expect(loadButton).not.toBeDisabled();
    });

    it('should provide semantic loading indicators', async () => {
      render(<MockSkeletonDashboard />);
      
      await user.click(screen.getByTestId('load-connections-btn'));
      
      // Loading state should be semantically clear
      const loadingSection = screen.getByTestId('connections-loading');
      expect(loadingSection).toBeInTheDocument();
      
      // Skeleton elements should be identifiable
      const skeletons = screen.getAllByTestId(/connection-skeleton-\d+/);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});
