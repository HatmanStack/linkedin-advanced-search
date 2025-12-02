import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// Mock modules
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    signOut: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/features/workflow', () => ({
  useHealAndRestore: () => ({ startListening: vi.fn() }),
  StatusPicker: () => <div data-testid="status-picker">Status Picker</div>,
  useProgressTracker: () => ({
    progressState: { current: 0, total: 0, phase: 'preparing' },
    loadingState: { isLoading: false },
    initializeProgress: vi.fn(),
    updateProgress: vi.fn(),
    resetProgress: vi.fn(),
    setLoadingMessage: vi.fn(),
  }),
  ProgressIndicator: () => null,
}));

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: vi.fn() }),
  useErrorHandler: () => ({
    currentError: null,
    errorHistory: [],
    handleError: vi.fn(),
    clearError: vi.fn(),
    showSuccessFeedback: vi.fn(),
  }),
}));

vi.mock('@/features/search', () => ({
  useSearchResults: () => ({
    loading: false,
    error: null,
    infoMessage: null,
    searchLinkedIn: vi.fn(),
  }),
}));

vi.mock('@/features/profile', () => ({
  useProfileInit: () => ({
    isInitializing: false,
    initializationMessage: '',
    initializationError: '',
    initializeProfile: vi.fn(),
  }),
  useUserProfile: () => ({
    ciphertext: null,
    userProfile: { first_name: 'Test', last_name: 'User' },
    refreshUserProfile: vi.fn(),
  }),
}));

vi.mock('@/shared/services', () => ({
  lambdaApiService: {
    getConnectionsByStatus: vi.fn().mockResolvedValue([]),
  },
  ApiError: class ApiError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/features/connections', () => ({
  connectionCache: {
    setNamespace: vi.fn(),
    loadFromStorage: vi.fn(),
    getAll: vi.fn(() => []),
    setMultiple: vi.fn(),
  },
  connectionChangeTracker: {
    hasChanged: vi.fn(() => false),
    clearChanged: vi.fn(),
  },
  NewConnectionsTab: () => <div data-testid="new-connections-tab">New Connections Tab</div>,
  VirtualConnectionList: () => <div data-testid="connection-list">Connection List</div>,
  ConnectionListSkeleton: () => <div data-testid="connection-skeleton">Loading...</div>,
  connectionDataContextService: {
    buildContext: vi.fn(),
  },
}));

vi.mock('@/features/messages', () => ({
  ConversationTopicPanel: () => <div data-testid="conversation-topic-panel">Conversation Topic Panel</div>,
  MessageModal: () => null,
  messageGenerationService: {
    generateMessage: vi.fn(),
  },
}));

vi.mock('@/features/posts', () => ({
  NewPostTab: () => <div data-testid="new-post-tab">New Post Tab</div>,
}));

vi.mock('@/shared/components/ui/empty-state', () => ({
  NoConnectionsState: () => <div data-testid="no-connections">No connections</div>,
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

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

import Dashboard from '@/pages/Dashboard';

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders the dashboard header', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('LinkedIn Advanced Search')).toBeInTheDocument();
  });

  it('renders Connections tab', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('tab', { name: /^Connections$/i })).toBeInTheDocument();
  });

  it('renders New Connections tab', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('tab', { name: /New Connections/i })).toBeInTheDocument();
  });

  it('renders New Post tab', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('tab', { name: /New Post/i })).toBeInTheDocument();
  });

  it('renders profile button', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('button', { name: /Profile/i })).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });

  it('renders status picker', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByTestId('status-picker')).toBeInTheDocument();
  });

  it('renders conversation topic panel', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByTestId('conversation-topic-panel')).toBeInTheDocument();
  });

  it('renders page title and description', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('Your Network Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Manage your connections/)).toBeInTheDocument();
  });

  it('Connections tab is selected by default', () => {
    renderWithProviders(<Dashboard />);
    const connectionsTab = screen.getByRole('tab', { name: /^Connections$/i });
    expect(connectionsTab).toHaveAttribute('data-state', 'active');
  });

  it('shows Connections content by default', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByTestId('status-picker')).toBeInTheDocument();
    expect(screen.getByTestId('conversation-topic-panel')).toBeInTheDocument();
  });
});
