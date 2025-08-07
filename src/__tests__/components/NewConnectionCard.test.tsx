/**
 * Comprehensive Unit Tests for NewConnectionCard Component
 * Task 11.2: Test React components with mock data and user interactions
 * 
 * Tests cover:
 * - NewConnectionCard rendering and remove functionality with various states
 * - User interactions including click events and confirmation dialogs
 * - Loading states and error handling
 * - Data validation and edge cases
 * 
 * Requirements: 2.1, 2.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import NewConnectionCard from '@/components/NewConnectionCard';
import { dbConnector } from '@/services/dbConnector';
import type { Connection } from '@/types';

// Mock the dbConnector service
vi.mock('@/services/dbConnector', () => ({
  dbConnector: {
    updateConnectionStatus: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status?: number, public code?: string) {
      super(message);
      this.name = 'ApiError';
    }
  }
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock error handling utilities
vi.mock('@/utils/errorHandling', () => ({
  transformErrorForUser: vi.fn((error, defaultMessage, actions) => ({
    userMessage: error.message || defaultMessage,
    severity: 'error' as const,
    actions: actions || []
  })),
  getToastVariant: vi.fn((severity) => severity === 'error' ? 'destructive' : 'default'),
  ERROR_MESSAGES: {
    REMOVE_CONNECTION: 'Failed to remove connection'
  }
}));

// Mock UI components
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-testid="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={className} data-testid="progress" data-value={value}>
      <div style={{ width: `${value}%` }} />
    </div>
  ),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="alert-dialog" data-open={open}>
      {open && children}
    </div>
  ),
  AlertDialogTrigger: ({ children }: any) => (
    <div data-testid="alert-dialog-trigger">{children}</div>
  ),
  AlertDialogContent: ({ children }: any) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: any) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: any) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: any) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: any) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({ children, onClick, className }: any) => (
    <button
      onClick={onClick}
      className={className}
      data-testid="alert-dialog-action"
    >
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, onClick }: any) => (
    <button onClick={onClick} data-testid="alert-dialog-cancel">
      {children}
    </button>
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  User: () => <div data-testid="user-icon" />,
  Building: () => <div data-testid="building-icon" />,
  MapPin: () => <div data-testid="mappin-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
  X: () => <div data-testid="x-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  UserPlus: () => <div data-testid="userplus-icon" />,
}));

describe('NewConnectionCard Component', () => {
  const mockConnection: Connection = {
    id: 'test-connection-1',
    first_name: 'John',
    last_name: 'Doe',
    position: 'Software Engineer',
    company: 'TechCorp',
    location: 'San Francisco, CA',
    headline: 'Building great software solutions',
    recent_activity: 'Posted about React development',
    common_interests: ['JavaScript', 'React', 'Node.js'],
    messages: 0,
    date_added: '2024-01-01T00:00:00Z',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    tags: ['JavaScript', 'React'],
    last_action_summary: 'Sent connection request',
    status: 'possible',
    conversion_likelihood: 75,
    message_history: []
  };

  const mockOnRemove = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbConnector.updateConnectionStatus).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render connection information correctly', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={mockOnSelect}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('TechCorp')).toBeInTheDocument();
      expect(screen.getByText('San Francisco, CA')).toBeInTheDocument();
      expect(screen.getByText('Building great software solutions')).toBeInTheDocument();
    });

    it('should display conversion likelihood progress bar', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Conversion Likelihood')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress');
      expect(progressBar).toHaveAttribute('data-value', '75');
    });

    it('should display common interests as badges', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    it('should show demo data badge when isFakeData is true', () => {
      const demoConnection = { ...mockConnection, isFakeData: true };
      
      render(
        <NewConnectionCard
          connection={demoConnection}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Demo Data')).toBeInTheDocument();
    });

    it('should display formatted date added', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText(/Added: 1\/1\/2024/)).toBeInTheDocument();
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalConnection: Connection = {
        id: 'minimal-1',
        first_name: 'Jane',
        last_name: 'Smith',
        position: 'Developer',
        company: 'StartupCorp',
        status: 'possible',
        messages: 0,
        message_history: []
      };

      render(
        <NewConnectionCard
          connection={minimalConnection}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('StartupCorp')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onSelect when card is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByText('John Doe').closest('div');
      await user.click(card!);

      expect(mockOnSelect).toHaveBeenCalledWith(mockConnection);
    });

    it('should not call onSelect when card is clicked during removal', async () => {
      const user = userEvent.setup();
      
      // Mock a slow API call
      vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={mockOnSelect}
        />
      );

      // Start removal process
      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);
      
      const confirmButton = screen.getByTestId('alert-dialog-action');
      await user.click(confirmButton);

      // Try to click card while removing
      const card = screen.getByText('John Doe').closest('div');
      await user.click(card!);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should open confirmation dialog when remove button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);

      expect(screen.getByTestId('alert-dialog-title')).toHaveTextContent('Remove Connection');
      expect(screen.getByTestId('alert-dialog-description')).toHaveTextContent(
        'Are you sure you want to remove John Doe from your new connections?'
      );
    });

    it('should prevent event bubbling when remove button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={mockOnSelect}
        />
      );

      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);

      // onSelect should not be called when remove button is clicked
      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('Remove Functionality', () => {
    it('should successfully remove connection and show success toast', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      // Click remove button
      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);

      // Confirm removal
      const confirmButton = screen.getByTestId('alert-dialog-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(dbConnector.updateConnectionStatus).toHaveBeenCalledWith(
          'test-connection-1',
          'processed'
        );
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Connection Removed",
        description: expect.any(Object),
        variant: "default",
      });

      expect(mockOnRemove).toHaveBeenCalledWith('test-connection-1');
    });

    it('should show loading state during removal', async () => {
      const user = userEvent.setup();
      
      // Mock slow API call
      vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      // Start removal
      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);
      
      const confirmButton = screen.getByTestId('alert-dialog-action');
      await user.click(confirmButton);

      // Check for loading state
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      
      // Card should have disabled styling
      const card = screen.getByText('John Doe').closest('div');
      expect(card).toHaveClass('opacity-50');

      await waitFor(() => {
        expect(mockOnRemove).toHaveBeenCalled();
      });
    });

    it('should handle removal errors and show error toast', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      
      vi.mocked(dbConnector.updateConnectionStatus).mockRejectedValue(error);

      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      // Start removal
      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);
      
      const confirmButton = screen.getByTestId('alert-dialog-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Remove Failed",
          description: "Network error",
          variant: "destructive",
        });
      });

      // onRemove should not be called on error
      expect(mockOnRemove).not.toHaveBeenCalled();
    });

    it('should cancel removal when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      // Open dialog
      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);

      // Cancel removal
      const cancelButton = screen.getByTestId('alert-dialog-cancel');
      await user.click(cancelButton);

      // API should not be called
      expect(dbConnector.updateConnectionStatus).not.toHaveBeenCalled();
      expect(mockOnRemove).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle connection without conversion likelihood', () => {
      const connectionWithoutLikelihood = { 
        ...mockConnection, 
        conversion_likelihood: undefined 
      };
      
      render(
        <NewConnectionCard
          connection={connectionWithoutLikelihood}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.queryByText('Conversion Likelihood')).not.toBeInTheDocument();
    });

    it('should handle connection without common interests', () => {
      const connectionWithoutInterests = { 
        ...mockConnection, 
        common_interests: undefined 
      };
      
      render(
        <NewConnectionCard
          connection={connectionWithoutInterests}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.queryByTestId('tag-icon')).not.toBeInTheDocument();
    });

    it('should handle empty common interests array', () => {
      const connectionWithEmptyInterests = { 
        ...mockConnection, 
        common_interests: [] 
      };
      
      render(
        <NewConnectionCard
          connection={connectionWithEmptyInterests}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.queryByTestId('tag-icon')).not.toBeInTheDocument();
    });

    it('should show "more" badge when there are more than 3 interests', () => {
      const connectionWithManyInterests = { 
        ...mockConnection, 
        common_interests: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'] 
      };
      
      render(
        <NewConnectionCard
          connection={connectionWithManyInterests}
          onRemove={mockOnRemove}
        />
      );

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should handle invalid date gracefully', () => {
      const connectionWithInvalidDate = { 
        ...mockConnection, 
        date_added: 'invalid-date' 
      };
      
      render(
        <NewConnectionCard
          connection={connectionWithInvalidDate}
          onRemove={mockOnRemove}
        />
      );

      // Should not crash and should still render other content
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should handle missing onRemove callback', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={undefined}
        />
      );

      // Should render without crashing
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
    });

    it('should handle missing onSelect callback', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={undefined}
        />
      );

      const card = screen.getByText('John Doe').closest('div');
      await user.click(card!);

      // Should not crash
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button accessibility', () => {
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      const removeButton = screen.getByTestId('x-icon').closest('button');
      expect(removeButton).toBeInTheDocument();
      expect(removeButton).not.toBeDisabled();
    });

    it('should disable remove button during loading', async () => {
      const user = userEvent.setup();
      
      vi.mocked(dbConnector.updateConnectionStatus).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);
      
      const confirmButton = screen.getByTestId('alert-dialog-action');
      await user.click(confirmButton);

      const loadingButton = screen.getByTestId('loader-icon').closest('button');
      expect(loadingButton).toBeDisabled();
    });

    it('should provide proper dialog accessibility', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
        />
      );

      const removeButton = screen.getByTestId('x-icon').closest('button');
      await user.click(removeButton!);

      expect(screen.getByTestId('alert-dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-description')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-action')).toBeInTheDocument();
      expect(screen.getByTestId('alert-dialog-cancel')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render efficiently with large interest arrays', () => {
      const connectionWithManyInterests = {
        ...mockConnection,
        common_interests: Array.from({ length: 100 }, (_, i) => `Interest${i}`)
      };

      const startTime = performance.now();
      render(
        <NewConnectionCard
          connection={connectionWithManyInterests}
          onRemove={mockOnRemove}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should render quickly
      
      // Should only show first 3 interests plus "more" badge
      expect(screen.getByText('Interest0')).toBeInTheDocument();
      expect(screen.getByText('Interest1')).toBeInTheDocument();
      expect(screen.getByText('Interest2')).toBeInTheDocument();
      expect(screen.getByText('+97 more')).toBeInTheDocument();
    });

    it('should handle rapid click events gracefully', async () => {
      const user = userEvent.setup();
      
      render(
        <NewConnectionCard
          connection={mockConnection}
          onRemove={mockOnRemove}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByText('John Doe').closest('div');
      
      // Rapid clicks
      await user.click(card!);
      await user.click(card!);
      await user.click(card!);

      // Should handle gracefully without errors
      expect(mockOnSelect).toHaveBeenCalledTimes(3);
    });
  });
});