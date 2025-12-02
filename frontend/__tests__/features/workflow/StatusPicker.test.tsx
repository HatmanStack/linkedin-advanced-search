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

import StatusPicker, { STATUS_MAPPING } from '@/features/workflow/components/StatusPicker';
import { renderWithProviders } from '../../utils/renderWithProviders';
import type { StatusValue } from '@/shared/types';

describe('StatusPicker', () => {
  const defaultCounts = {
    incoming: 10,
    outgoing: 5,
    ally: 25,
  };

  const defaultProps = {
    selectedStatus: 'all' as StatusValue,
    onStatusChange: vi.fn(),
    connectionCounts: defaultCounts,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the component', () => {
      renderWithProviders(<StatusPicker {...defaultProps} />);

      expect(screen.getByText('Filter Connections')).toBeInTheDocument();
    });

    it('renders the status label', () => {
      renderWithProviders(<StatusPicker {...defaultProps} />);

      expect(screen.getByText('Connection Status')).toBeInTheDocument();
    });

    it('displays all status label for selected status', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="all" />);

      expect(screen.getByText('All Statuses')).toBeInTheDocument();
    });

    it('displays incoming status label when selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="incoming" />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('displays outgoing status label when selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="outgoing" />);

      expect(screen.getByText('Sent')).toBeInTheDocument();
    });

    it('displays ally status label when selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="ally" />);

      expect(screen.getByText('Connections')).toBeInTheDocument();
    });
  });

  describe('connection counts', () => {
    it('shows total count for all status', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="all" />);

      // Total = 10 + 5 + 25 = 40
      expect(screen.getByText('40')).toBeInTheDocument();
    });

    it('shows incoming count when incoming selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="incoming" />);

      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('shows outgoing count when outgoing selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="outgoing" />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows ally count when ally selected', () => {
      renderWithProviders(<StatusPicker {...defaultProps} selectedStatus="ally" />);

      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('handles zero counts', () => {
      const zeroCounts = { incoming: 0, outgoing: 0, ally: 0 };
      renderWithProviders(
        <StatusPicker {...defaultProps} connectionCounts={zeroCounts} selectedStatus="all" />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('renders select trigger', () => {
      renderWithProviders(
        <StatusPicker {...defaultProps} />
      );

      // Verify combobox exists
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
    });

    it('provides onStatusChange callback prop', () => {
      const onStatusChange = vi.fn();

      renderWithProviders(
        <StatusPicker {...defaultProps} onStatusChange={onStatusChange} />
      );

      // Verify the component renders with the callback
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('has select trigger with correct id', () => {
      renderWithProviders(<StatusPicker {...defaultProps} />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('id', 'status-select');
    });
  });

  describe('STATUS_MAPPING', () => {
    it('has all required statuses', () => {
      expect(STATUS_MAPPING.all).toBeDefined();
      expect(STATUS_MAPPING.incoming).toBeDefined();
      expect(STATUS_MAPPING.outgoing).toBeDefined();
      expect(STATUS_MAPPING.ally).toBeDefined();
    });

    it('has correct labels', () => {
      expect(STATUS_MAPPING.all.label).toBe('All Statuses');
      expect(STATUS_MAPPING.incoming.label).toBe('Pending');
      expect(STATUS_MAPPING.outgoing.label).toBe('Sent');
      expect(STATUS_MAPPING.ally.label).toBe('Connections');
    });

    it('has icon components for each status', () => {
      // Icons are objects with $$typeof for React components
      expect(STATUS_MAPPING.all.icon).toBeDefined();
      expect(STATUS_MAPPING.incoming.icon).toBeDefined();
      expect(STATUS_MAPPING.outgoing.icon).toBeDefined();
      expect(STATUS_MAPPING.ally.icon).toBeDefined();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const { container } = renderWithProviders(
        <StatusPicker {...defaultProps} className="custom-class" />
      );

      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });
});
