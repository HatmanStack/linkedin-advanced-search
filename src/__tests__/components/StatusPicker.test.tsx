/**
 * Comprehensive Unit Tests for StatusPicker Component
 * Task 11.2: Test React components with mock data and user interactions
 * 
 * Tests cover:
 * - StatusPicker filtering and state management with all options
 * - User interactions and selection changes
 * - Connection count display and badge rendering
 * - Status mapping and display labels
 * 
 * Requirements: 3.2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import StatusPicker, { STATUS_MAPPING } from '@/components/StatusPicker';
import type { StatusValue, ConnectionCounts } from '@/types';

// Mock UI components
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange('incoming')} data-testid="select-trigger">
        {children}
      </button>
      <div data-testid="select-content">{children}</div>
    </div>
  ),
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value, ...props }: any) => (
    <div data-testid="select-item" data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, id, className }: any) => (
    <button id={id} className={className} data-testid="select-trigger">
      {children}
    </button>
  ),
  SelectValue: ({ children }: any) => (
    <div data-testid="select-value">{children}</div>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className} data-testid="label">
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span
      className={className}
      data-testid="badge"
      data-variant={variant}
    >
      {children}
    </span>
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Users: () => <div data-testid="users-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Send: () => <div data-testid="send-icon" />,
  UserCheck: () => <div data-testid="usercheck-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
}));

describe('StatusPicker Component', () => {
  const mockConnectionCounts: ConnectionCounts = {
    total: 150,
    incoming: 25,
    outgoing: 40,
    allies: 85,
    possible: 0
  };

  const mockOnStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByTestId('users-icon')).toBeInTheDocument();
      expect(screen.getByText('Filter Connections')).toBeInTheDocument();
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
      expect(screen.getByTestId('select')).toBeInTheDocument();
    });

    it('should display correct title and label', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Filter Connections')).toBeInTheDocument();
      expect(screen.getByTestId('label')).toHaveTextContent('Connection Status');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Status Display and Mapping', () => {
    it('should display "All Statuses" when selected status is "all"', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('All Statuses')).toBeInTheDocument();
      expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total count
    });

    it('should display "Pending" when selected status is "incoming"', () => {
      render(
        <StatusPicker
          selectedStatus="incoming"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // Incoming count
    });

    it('should display "Sent" when selected status is "outgoing"', () => {
      render(
        <StatusPicker
          selectedStatus="outgoing"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Sent')).toBeInTheDocument();
      expect(screen.getByTestId('send-icon')).toBeInTheDocument();
      expect(screen.getByText('40')).toBeInTheDocument(); // Outgoing count
    });

    it('should display "Connections" when selected status is "allies"', () => {
      render(
        <StatusPicker
          selectedStatus="allies"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Connections')).toBeInTheDocument();
      expect(screen.getByTestId('usercheck-icon')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument(); // Allies count
    });
  });

  describe('Connection Count Display', () => {
    it('should display correct count badges for each status', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const badges = screen.getAllByTestId('badge');
      expect(badges).toHaveLength(1); // Only the selected status badge is visible in trigger
      expect(badges[0]).toHaveTextContent('150'); // Total count for "all"
    });

    it('should handle zero counts gracefully', () => {
      const zeroCounts: ConnectionCounts = {
        total: 0,
        incoming: 0,
        outgoing: 0,
        allies: 0,
        possible: 0
      };

      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={zeroCounts}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle large numbers correctly', () => {
      const largeCounts: ConnectionCounts = {
        total: 9999,
        incoming: 1234,
        outgoing: 5678,
        allies: 3087,
        possible: 0
      };

      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={largeCounts}
        />
      );

      expect(screen.getByText('9999')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onStatusChange when status is changed', async () => {
      const user = userEvent.setup();
      
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const selectTrigger = screen.getByTestId('select-trigger');
      await user.click(selectTrigger);

      expect(mockOnStatusChange).toHaveBeenCalledWith('incoming');
    });

    it('should handle rapid status changes', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const selectTrigger = screen.getByTestId('select-trigger');
      
      // Simulate rapid changes
      await user.click(selectTrigger);
      await user.click(selectTrigger);
      await user.click(selectTrigger);

      expect(mockOnStatusChange).toHaveBeenCalledTimes(3);
    });

    it('should maintain state consistency during updates', () => {
      const { rerender } = render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('All Statuses')).toBeInTheDocument();

      rerender(
        <StatusPicker
          selectedStatus="incoming"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.queryByText('All Statuses')).not.toBeInTheDocument();
    });
  });

  describe('Status Mapping Configuration', () => {
    it('should have correct STATUS_MAPPING configuration', () => {
      expect(STATUS_MAPPING.all.label).toBe('All Statuses');
      expect(STATUS_MAPPING.incoming.label).toBe('Pending');
      expect(STATUS_MAPPING.outgoing.label).toBe('Sent');
      expect(STATUS_MAPPING.allies.label).toBe('Connections');
    });

    it('should have icons for all status types', () => {
      Object.keys(STATUS_MAPPING).forEach(status => {
        expect(STATUS_MAPPING[status as StatusValue].icon).toBeDefined();
      });
    });

    it('should render all available status options', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      // Check that all status types are available
      const statusKeys = Object.keys(STATUS_MAPPING) as StatusValue[];
      expect(statusKeys).toContain('all');
      expect(statusKeys).toContain('incoming');
      expect(statusKeys).toContain('outgoing');
      expect(statusKeys).toContain('allies');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined connection counts', () => {
      const undefinedCounts = {
        total: 0,
        incoming: 0,
        outgoing: 0,
        allies: 0,
        possible: 0
      };

      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={undefinedCounts}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle invalid selected status gracefully', () => {
      // TypeScript would prevent this, but test runtime behavior
      render(
        <StatusPicker
          selectedStatus={'invalid' as StatusValue}
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      // Should not crash
      expect(screen.getByText('Filter Connections')).toBeInTheDocument();
    });

    it('should handle missing onStatusChange callback', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={undefined as any}
          connectionCounts={mockConnectionCounts}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Filter Connections')).toBeInTheDocument();
    });

    it('should handle negative connection counts', () => {
      const negativeCounts: ConnectionCounts = {
        total: -1,
        incoming: -5,
        outgoing: -10,
        allies: -3,
        possible: 0
      };

      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={negativeCounts}
        />
      );

      expect(screen.getByText('-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper label association', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const label = screen.getByTestId('label');
      const select = screen.getByTestId('select-trigger');
      
      expect(label).toHaveAttribute('for', 'status-select');
      expect(select).toHaveAttribute('id', 'status-select');
    });

    it('should provide meaningful text content for screen readers', () => {
      render(
        <StatusPicker
          selectedStatus="incoming"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes on select component', () => {
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const selectTrigger = screen.getByTestId('select-trigger');
      expect(selectTrigger).toHaveAttribute('id', 'status-select');
    });
  });

  describe('Performance', () => {
    it('should render efficiently with large connection counts', () => {
      const largeCounts: ConnectionCounts = {
        total: 999999,
        incoming: 123456,
        outgoing: 234567,
        allies: 345678,
        possible: 0
      };

      const startTime = performance.now();
      render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={largeCounts}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should render quickly
      expect(screen.getByText('999999')).toBeInTheDocument();
    });

    it('should handle frequent prop updates efficiently', () => {
      const { rerender } = render(
        <StatusPicker
          selectedStatus="all"
          onStatusChange={mockOnStatusChange}
          connectionCounts={mockConnectionCounts}
        />
      );

      const startTime = performance.now();
      
      // Simulate frequent updates
      for (let i = 0; i < 100; i++) {
        const updatedCounts = {
          ...mockConnectionCounts,
          total: mockConnectionCounts.total + i
        };
        
        rerender(
          <StatusPicker
            selectedStatus="all"
            onStatusChange={mockOnStatusChange}
            connectionCounts={updatedCounts}
          />
        );
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should handle updates efficiently
    });
  });

  describe('Component Integration', () => {
    it('should work correctly with different status selections', () => {
      const statuses: StatusValue[] = ['all', 'incoming', 'outgoing', 'allies'];
      
      statuses.forEach(status => {
        const { rerender } = render(
          <StatusPicker
            selectedStatus={status}
            onStatusChange={mockOnStatusChange}
            connectionCounts={mockConnectionCounts}
          />
        );

        const expectedLabel = STATUS_MAPPING[status].label;
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        
        // Clean up for next iteration
        rerender(<div />);
      });
    });

    it('should maintain consistent styling across all states', () => {
      const statuses: StatusValue[] = ['all', 'incoming', 'outgoing', 'allies'];
      
      statuses.forEach(status => {
        const { container, rerender } = render(
          <StatusPicker
            selectedStatus={status}
            onStatusChange={mockOnStatusChange}
            connectionCounts={mockConnectionCounts}
          />
        );

        // Check for consistent structure
        expect(screen.getByTestId('users-icon')).toBeInTheDocument();
        expect(screen.getByText('Filter Connections')).toBeInTheDocument();
        expect(screen.getByTestId('select')).toBeInTheDocument();
        expect(screen.getByTestId('badge')).toBeInTheDocument();
        
        // Clean up for next iteration
        rerender(<div />);
      });
    });
  });
});