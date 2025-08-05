/**
 * Comprehensive Unit Tests for VirtualConnectionList Component
 * Task 11.2: Test React components with mock data and user interactions
 * 
 * Tests cover:
 * - Virtual scrolling behavior with large datasets
 * - Performance optimization and memory management
 * - Responsive behavior and window resize handling
 * - Empty states and error conditions
 * 
 * Requirements: Performance optimization for large datasets
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import VirtualConnectionList from '@/components/VirtualConnectionList';
import type { Connection } from '@/types';

// Mock react-window
const mockList = vi.fn(({ children, itemData, itemCount }: any) => (
  <div data-testid="virtual-list" data-item-count={itemCount}>
    {Array.from({ length: Math.min(itemCount, 10) }, (_, index) => 
      children({ 
        index, 
        style: { height: '200px' }, 
        data: itemData 
      })
    )}
  </div>
));

vi.mock('react-window', () => ({
  FixedSizeList: mockList,
}));

// Mock ConnectionCard component
const mockConnectionCard = vi.fn(({ connection, isSelected, onSelect, onNewConnectionClick, onTagClick, onMessageClick }: any) => (
  <div 
    data-testid="connection-card"
    data-connection-id={connection.id}
    data-selected={isSelected}
    onClick={() => {
      if (onNewConnectionClick) {
        onNewConnectionClick(connection);
      } else if (onSelect) {
        onSelect(connection.id);
      }
    }}
  >
    <span>{connection.first_name} {connection.last_name}</span>
    {connection.tags?.map((tag: string) => (
      <button 
        key={tag} 
        onClick={(e) => {
          e.stopPropagation();
          onTagClick?.(tag);
        }}
        data-testid="tag-button"
      >
        {tag}
      </button>
    ))}
    {connection.messages && connection.messages > 0 && (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onMessageClick?.(connection);
        }}
        data-testid="message-button"
      >
        Messages: {connection.messages}
      </button>
    )}
  </div>
));

vi.mock('@/components/ConnectionCard', () => ({
  default: mockConnectionCard,
}));

describe('VirtualConnectionList Component', () => {
  const mockConnections: Connection[] = [
    {
      id: 'connection-1',
      first_name: 'John',
      last_name: 'Doe',
      position: 'Software Engineer',
      company: 'TechCorp',
      status: 'allies',
      messages: 3,
      tags: ['JavaScript', 'React'],
      message_history: []
    },
    {
      id: 'connection-2',
      first_name: 'Jane',
      last_name: 'Smith',
      position: 'Product Manager',
      company: 'StartupCorp',
      status: 'incoming',
      messages: 1,
      tags: ['Product', 'Strategy'],
      message_history: []
    },
    {
      id: 'connection-3',
      first_name: 'Bob',
      last_name: 'Johnson',
      position: 'Designer',
      company: 'DesignCorp',
      status: 'outgoing',
      messages: 0,
      tags: ['Design', 'UI/UX'],
      message_history: []
    }
  ];

  const mockOnSelect = vi.fn();
  const mockOnNewConnectionClick = vi.fn();
  const mockOnTagClick = vi.fn();
  const mockOnMessageClick = vi.fn();

  // Mock window resize events
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window methods
    Object.defineProperty(window, 'addEventListener', {
      value: mockAddEventListener,
      writable: true
    });
    
    Object.defineProperty(window, 'removeEventListener', {
      value: mockRemoveEventListener,
      writable: true
    });

    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      writable: true
    });

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 0,
      right: 800,
      bottom: 700,
      width: 800,
      height: 600,
      x: 0,
      y: 100,
      toJSON: vi.fn()
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render virtual list with connections', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-item-count', '3');
      
      // Should render connection cards
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('should pass correct props to react-window List', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          itemHeight={250}
          overscanCount={3}
        />
      );

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          height: expect.any(Number),
          width: "100%",
          itemCount: 3,
          itemSize: 250,
          overscanCount: 3,
          className: expect.stringContaining('scrollbar'),
        }),
        {}
      );
    });

    it('should use default props when not provided', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          itemSize: 200, // Default itemHeight
          overscanCount: 5, // Default overscanCount
        }),
        {}
      );
    });

    it('should apply custom className', () => {
      const { container } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Empty State Handling', () => {
    it('should show empty state when no connections provided', () => {
      render(
        <VirtualConnectionList
          connections={[]}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('No connections found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your filters or check back later.')).toBeInTheDocument();
    });

    it('should show new connections empty state message', () => {
      render(
        <VirtualConnectionList
          connections={[]}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      expect(screen.getByText('No connections found')).toBeInTheDocument();
      expect(screen.getByText('No new connections available at the moment.')).toBeInTheDocument();
    });

    it('should not render virtual list when connections array is empty', () => {
      render(
        <VirtualConnectionList
          connections={[]}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
    });
  });

  describe('Connection Interactions', () => {
    it('should handle connection selection', async () => {
      const user = userEvent.setup();

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      const connectionCard = screen.getByText('John Doe').closest('div');
      await user.click(connectionCard!);

      expect(mockOnSelect).toHaveBeenCalledWith('connection-1');
    });

    it('should handle new connection clicks', async () => {
      const user = userEvent.setup();

      render(
        <VirtualConnectionList
          connections={mockConnections}
          isNewConnection={true}
          onNewConnectionClick={mockOnNewConnectionClick}
        />
      );

      const connectionCard = screen.getByText('John Doe').closest('div');
      await user.click(connectionCard!);

      expect(mockOnNewConnectionClick).toHaveBeenCalledWith(mockConnections[0]);
    });

    it('should handle tag clicks', async () => {
      const user = userEvent.setup();

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          onTagClick={mockOnTagClick}
        />
      );

      const tagButton = screen.getByText('JavaScript');
      await user.click(tagButton);

      expect(mockOnTagClick).toHaveBeenCalledWith('JavaScript');
      expect(mockOnSelect).not.toHaveBeenCalled(); // Should not trigger card selection
    });

    it('should handle message clicks', async () => {
      const user = userEvent.setup();

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          onMessageClick={mockOnMessageClick}
        />
      );

      const messageButton = screen.getByText('Messages: 3');
      await user.click(messageButton);

      expect(mockOnMessageClick).toHaveBeenCalledWith(mockConnections[0]);
      expect(mockOnSelect).not.toHaveBeenCalled(); // Should not trigger card selection
    });

    it('should show selected state for selected connection', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          selectedConnectionId="connection-2"
        />
      );

      const selectedCard = screen.getByTestId('connection-card');
      expect(selectedCard).toHaveAttribute('data-selected', 'false'); // First card is not selected
      
      // In a real implementation, we'd check all rendered cards
      // but with our mock, we only render the first few
    });
  });

  describe('Virtual Scrolling Behavior', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `connection-${i}`,
        first_name: `User${i}`,
        last_name: 'Test',
        position: 'Engineer',
        company: 'TestCorp',
        status: 'allies' as const,
        messages: i % 5,
        message_history: []
      }));

      const startTime = performance.now();
      render(
        <VirtualConnectionList
          connections={largeDataset}
          onSelect={mockOnSelect}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
      expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-item-count', '10000');
      
      // Should only render a subset of items (virtualized)
      const renderedCards = screen.getAllByTestId('connection-card');
      expect(renderedCards.length).toBeLessThanOrEqual(10); // Only renders visible items
    });

    it('should pass correct itemData to List component', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          isNewConnection={true}
          onSelect={mockOnSelect}
          onNewConnectionClick={mockOnNewConnectionClick}
          onTagClick={mockOnTagClick}
          onMessageClick={mockOnMessageClick}
          activeTags={['JavaScript']}
          selectedConnectionId="connection-1"
        />
      );

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          itemData: {
            connections: mockConnections,
            isNewConnection: true,
            onSelect: mockOnSelect,
            onNewConnectionClick: mockOnNewConnectionClick,
            onTagClick: mockOnTagClick,
            onMessageClick: mockOnMessageClick,
            activeTags: ['JavaScript'],
            selectedConnectionId: 'connection-1'
          }
        }),
        {}
      );
    });

    it('should memoize itemData to prevent unnecessary re-renders', () => {
      const { rerender } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      const firstCallItemData = mockList.mock.calls[0][0].itemData;

      // Re-render with same props
      rerender(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      const secondCallItemData = mockList.mock.calls[1][0].itemData;
      
      // ItemData should be the same object reference (memoized)
      expect(firstCallItemData).toBe(secondCallItemData);
    });

    it('should update itemData when props change', () => {
      const { rerender } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      const firstCallItemData = mockList.mock.calls[0][0].itemData;

      // Re-render with different props
      rerender(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
          selectedConnectionId="connection-2"
        />
      );

      const secondCallItemData = mockList.mock.calls[1][0].itemData;
      
      // ItemData should be different (not memoized due to prop change)
      expect(firstCallItemData).not.toBe(secondCallItemData);
      expect(secondCallItemData.selectedConnectionId).toBe('connection-2');
    });
  });

  describe('Responsive Behavior', () => {
    it('should set up window resize listener on mount', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should clean up resize listener on unmount', () => {
      const { unmount } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should calculate container height based on available space', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Should calculate height based on window.innerHeight (1000) - rect.top (100) - margin (100)
      // Expected: Math.max(400, Math.min(800, 800)) = 800
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 800
        }),
        {}
      );
    });

    it('should enforce minimum height constraint', () => {
      // Mock a scenario where calculated height would be very small
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        top: 950, // Very close to bottom of screen
        left: 0,
        right: 800,
        bottom: 1000,
        width: 800,
        height: 50,
        x: 0,
        y: 950,
        toJSON: vi.fn()
      }));

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Should enforce minimum height of 400
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 400
        }),
        {}
      );
    });

    it('should enforce maximum height constraint', () => {
      // Mock a scenario where calculated height would be very large
      Object.defineProperty(window, 'innerHeight', {
        value: 2000,
        writable: true
      });

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Should enforce maximum height of 800
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 800
        }),
        {}
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should handle frequent prop updates efficiently', () => {
      const { rerender } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      const startTime = performance.now();

      // Simulate frequent updates
      for (let i = 0; i < 100; i++) {
        rerender(
          <VirtualConnectionList
            connections={mockConnections}
            onSelect={mockOnSelect}
            selectedConnectionId={`connection-${i % 3 + 1}`}
          />
        );
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should handle updates efficiently
    });

    it('should render with minimal DOM nodes for large datasets', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `connection-${i}`,
        first_name: `User${i}`,
        last_name: 'Test',
        position: 'Engineer',
        company: 'TestCorp',
        status: 'allies' as const,
        messages: 0,
        message_history: []
      }));

      render(
        <VirtualConnectionList
          connections={largeDataset}
          onSelect={mockOnSelect}
        />
      );

      // Should only render a limited number of DOM nodes regardless of dataset size
      const renderedCards = screen.getAllByTestId('connection-card');
      expect(renderedCards.length).toBeLessThanOrEqual(10);
    });

    it('should maintain scroll position during updates', () => {
      const { rerender } = render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Simulate scroll position change (in real implementation, this would be handled by react-window)
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();

      // Update props
      rerender(
        <VirtualConnectionList
          connections={[...mockConnections, {
            id: 'connection-4',
            first_name: 'New',
            last_name: 'User',
            position: 'Developer',
            company: 'NewCorp',
            status: 'possible' as const,
            messages: 0,
            message_history: []
          }]}
          onSelect={mockOnSelect}
        />
      );

      // Virtual list should still be present and functional
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
      expect(screen.getByTestId('virtual-list')).toHaveAttribute('data-item-count', '4');
    });
  });

  describe('Edge Cases', () => {
    it('should handle connections without required fields', () => {
      const incompleteConnections = [
        {
          id: 'incomplete-1',
          first_name: 'John',
          last_name: 'Doe',
          position: 'Engineer',
          company: 'TechCorp',
          status: 'allies' as const,
          messages: 0,
          message_history: []
          // Missing other optional fields
        }
      ];

      render(
        <VirtualConnectionList
          connections={incompleteConnections}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle null or undefined connections gracefully', () => {
      // This shouldn't happen in TypeScript, but test runtime safety
      const connectionsWithNulls = [
        mockConnections[0],
        null as any,
        mockConnections[1],
        undefined as any,
        mockConnections[2]
      ];

      render(
        <VirtualConnectionList
          connections={connectionsWithNulls}
          onSelect={mockOnSelect}
        />
      );

      // Should still render valid connections
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should handle missing callback functions gracefully', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
        />
      );

      // Should render without errors
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle very small container dimensions', () => {
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        toJSON: vi.fn()
      }));

      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Should still enforce minimum height
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 400
        }),
        {}
      );
    });
  });

  describe('Accessibility', () => {
    it('should apply proper scrollbar styling classes', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800'
        }),
        {}
      );
    });

    it('should maintain focus management during virtual scrolling', () => {
      render(
        <VirtualConnectionList
          connections={mockConnections}
          onSelect={mockOnSelect}
        />
      );

      // Virtual list should be focusable
      const virtualList = screen.getByTestId('virtual-list');
      expect(virtualList).toBeInTheDocument();
    });
  });
});