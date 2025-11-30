/**
 * Unit Tests for ProgressIndicator Component
 * Task 9: Comprehensive error handling and user feedback
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProgressIndicator from '@/features/workflow/components/ProgressIndicator';
import type { ProgressState, LoadingState } from '@/shared/types/errorTypes';

// Mock UI components
vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress-bar" data-value={value} className={className}>
      Progress: {value}%
    </div>
  )
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button 
      onClick={onClick} 
      data-variant={variant} 
      data-size={size} 
      className={className}
      data-testid="cancel-button"
    >
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="progress-card">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className} data-testid="card-content">{children}</div>
  )
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Loader2: ({ className }: any) => <div className={className} data-testid="loader-icon" />,
  Square: ({ className }: any) => <div className={className} data-testid="square-icon" />,
  Clock: ({ className }: any) => <div className={className} data-testid="clock-icon" />,
  CheckCircle: ({ className }: any) => <div className={className} data-testid="check-circle-icon" />,
  AlertCircle: ({ className }: any) => <div className={className} data-testid="alert-circle-icon" />
}));

describe('ProgressIndicator Component', () => {
  const mockOnCancel = vi.fn();

  const defaultProgressState: ProgressState = {
    current: 0,
    total: 0,
    phase: 'preparing'
  };

  const defaultLoadingState: LoadingState = {
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering Conditions', () => {
    it('should not render when not loading and in preparing phase', () => {
      const { container } = render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={defaultLoadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when loading is true', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        message: 'Processing...'
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('progress-card')).toBeInTheDocument();
    });

    it('should render when not in preparing phase', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'generating',
        currentConnectionName: 'John Doe'
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={defaultLoadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('progress-card')).toBeInTheDocument();
    });
  });

  describe('Phase Icons and Descriptions', () => {
    it('should show loader icon and correct description for preparing phase', () => {
      const progressState: ProgressState = {
        current: 0,
        total: 3,
        phase: 'preparing'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      expect(screen.getByText('Preparing message generation...')).toBeInTheDocument();
    });

    it('should show loader icon and connection name for generating phase', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'generating',
        currentConnectionName: 'John Doe'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      expect(screen.getByText('Generating message for John Doe...')).toBeInTheDocument();
    });

    it('should show clock icon for waiting_approval phase', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'waiting_approval'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
      expect(screen.getByText('Waiting for your approval...')).toBeInTheDocument();
    });

    it('should show check circle icon for completed phase', () => {
      const progressState: ProgressState = {
        current: 3,
        total: 3,
        phase: 'completed'
      };

      const loadingState: LoadingState = {
        isLoading: false
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('Message generation completed!')).toBeInTheDocument();
    });

    it('should show alert circle icon for error phase', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'error'
      };

      const loadingState: LoadingState = {
        isLoading: false
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      expect(screen.getByText('An error occurred during generation')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should show progress bar when total > 0', () => {
      const progressState: ProgressState = {
        current: 2,
        total: 5,
        phase: 'generating'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('data-value', '40'); // 2/5 * 100 = 40%
    });

    it('should show correct progress text', () => {
      const progressState: ProgressState = {
        current: 3,
        total: 7,
        phase: 'generating'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('3 of 7 connections')).toBeInTheDocument();
      expect(screen.getByText('43%')).toBeInTheDocument(); // Math.round(3/7 * 100) = 43%
    });

    it('should not show progress bar when total is 0', () => {
      const progressState: ProgressState = {
        current: 0,
        total: 0,
        phase: 'preparing'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });
  });

  describe('Loading Message', () => {
    it('should display loading message when provided', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        message: 'Connecting to API...'
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Connecting to API...')).toBeInTheDocument();
    });

    it('should not display loading message when not provided', () => {
      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText('Connecting to API...')).not.toBeInTheDocument();
    });
  });

  describe('Estimated Time', () => {
    it('should display estimated time when available', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'generating',
        estimatedTimeRemaining: 125 // 2 minutes 5 seconds
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('2m 5s remaining')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('should display seconds only when less than a minute', () => {
      const progressState: ProgressState = {
        current: 2,
        total: 3,
        phase: 'generating',
        estimatedTimeRemaining: 45
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('45s remaining')).toBeInTheDocument();
    });

    it('should not display estimated time when not available', () => {
      const progressState: ProgressState = {
        current: 1,
        total: 3,
        phase: 'generating'
      };

      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={progressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText(/remaining/)).not.toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should show cancel button when canCancel is true and onCancel is provided', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        canCancel: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByText('Stop Generation')).toBeInTheDocument();
    });

    it('should not show cancel button when canCancel is false', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        canCancel: false
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('should not show cancel button when onCancel is not provided', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        canCancel: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
        />
      );

      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const loadingState: LoadingState = {
        isLoading: true,
        canCancel: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByTestId('cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSS Classes', () => {
    it('should apply custom className', () => {
      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
          className="custom-class"
        />
      );

      const card = screen.getByTestId('progress-card');
      expect(card).toHaveClass('custom-class');
    });

    it('should apply default styling classes', () => {
      const loadingState: LoadingState = {
        isLoading: true
      };

      render(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={loadingState}
          onCancel={mockOnCancel}
        />
      );

      const card = screen.getByTestId('progress-card');
      expect(card).toHaveClass('bg-slate-800', 'border-slate-700');
    });
  });
});
