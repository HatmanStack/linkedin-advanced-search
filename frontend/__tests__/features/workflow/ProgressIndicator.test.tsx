import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock modules before imports
vi.mock('@/config/appConfig', () => ({
  appConfig: {
    cognitoConfig: {
      userPoolId: 'test-pool-id',
      userPoolWebClientId: 'test-client-id',
      region: 'us-east-1',
    },
    isCognitoConfigured: () => false,
    STORAGE_KEYS: { AUTH_TOKEN: 'test-token' },
  },
  default: {
    cognitoConfig: {
      userPoolId: 'test-pool-id',
      userPoolWebClientId: 'test-client-id',
      region: 'us-east-1',
    },
    isCognitoConfigured: () => false,
    STORAGE_KEYS: { AUTH_TOKEN: 'test-token' },
  },
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'test' }, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import ProgressIndicator from '@/features/workflow/components/ProgressIndicator';
import { renderWithProviders } from '../../utils/renderWithProviders';
import type { ProgressState, LoadingState } from '@/shared/types';

describe('ProgressIndicator', () => {
  const defaultProgressState: ProgressState = {
    current: 0,
    total: 0,
    phase: 'preparing',
  };

  const defaultLoadingState: LoadingState = {
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('returns null when not loading and phase is preparing', () => {
      const { container } = renderWithProviders(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={defaultLoadingState}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when isLoading is true', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={defaultProgressState}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Preparing message generation...')).toBeInTheDocument();
    });

    it('renders when phase is not preparing', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={defaultLoadingState}
        />
      );

      expect(screen.getByText('Generating messages...')).toBeInTheDocument();
    });
  });

  describe('phase descriptions', () => {
    it('shows preparing phase description', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'preparing' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Preparing message generation...')).toBeInTheDocument();
    });

    it('shows generating phase description without connection name', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Generating messages...')).toBeInTheDocument();
    });

    it('shows generating phase description with connection name', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{
            ...defaultProgressState,
            phase: 'generating',
            currentConnectionName: 'John Doe',
          }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Generating message for John Doe...')).toBeInTheDocument();
    });

    it('shows waiting_approval phase description', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'waiting_approval' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Waiting for your approval...')).toBeInTheDocument();
    });

    it('shows completed phase description', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'completed' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('Message generation completed!')).toBeInTheDocument();
    });

    it('shows error phase description', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'error' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('An error occurred during generation')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('shows progress bar when total > 0', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ current: 5, total: 10, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('5 of 10 connections')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('does not show progress bar when total is 0', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ current: 0, total: 0, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.queryByText('of')).not.toBeInTheDocument();
    });

    it('calculates percentage correctly', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ current: 3, total: 10, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('30%')).toBeInTheDocument();
    });

    it('rounds percentage to whole number', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ current: 1, total: 3, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('33%')).toBeInTheDocument();
    });
  });

  describe('loading message', () => {
    it('shows loading message when provided', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true, message: 'Processing batch 1...' }}
        />
      );

      expect(screen.getByText('Processing batch 1...')).toBeInTheDocument();
    });

    it('does not show message section when no message', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.queryByText('Processing')).not.toBeInTheDocument();
    });
  });

  describe('estimated time', () => {
    it('shows estimated time in seconds', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{
            current: 5,
            total: 10,
            phase: 'generating',
            estimatedTimeRemaining: 30,
          }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('30s remaining')).toBeInTheDocument();
    });

    it('shows estimated time in minutes and seconds', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{
            current: 5,
            total: 10,
            phase: 'generating',
            estimatedTimeRemaining: 90,
          }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.getByText('1m 30s remaining')).toBeInTheDocument();
    });

    it('does not show estimated time when not available', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ current: 5, total: 10, phase: 'generating' }}
          loadingState={{ isLoading: true }}
        />
      );

      expect(screen.queryByText('remaining')).not.toBeInTheDocument();
    });
  });

  describe('cancel button', () => {
    it('shows cancel button when canCancel is true and onCancel provided', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true, canCancel: true }}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByText('Stop Generation')).toBeInTheDocument();
    });

    it('does not show cancel button when canCancel is false', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true, canCancel: false }}
          onCancel={vi.fn()}
        />
      );

      expect(screen.queryByText('Stop Generation')).not.toBeInTheDocument();
    });

    it('does not show cancel button when onCancel not provided', () => {
      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true, canCancel: true }}
        />
      );

      expect(screen.queryByText('Stop Generation')).not.toBeInTheDocument();
    });

    it('calls onCancel when cancel button clicked', async () => {
      const onCancel = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true, canCancel: true }}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByText('Stop Generation');
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = renderWithProviders(
        <ProgressIndicator
          progressState={{ ...defaultProgressState, phase: 'generating' }}
          loadingState={{ isLoading: true }}
          className="custom-class"
        />
      );

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });
  });
});
