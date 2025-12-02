import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock modules before imports
const mockToast = vi.fn();
vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock the config to avoid Cognito initialization issues
vi.mock('@/config/appConfig', () => ({
  appConfig: {
    cognitoConfig: {
      userPoolId: 'test-pool-id',
      userPoolWebClientId: 'test-client-id',
      region: 'us-east-1',
    },
    isCognitoConfigured: () => false,
    STORAGE_KEYS: {
      AUTH_TOKEN: 'test-token',
    },
  },
  default: {
    cognitoConfig: {
      userPoolId: 'test-pool-id',
      userPoolWebClientId: 'test-client-id',
      region: 'us-east-1',
    },
    isCognitoConfigured: () => false,
    STORAGE_KEYS: {
      AUTH_TOKEN: 'test-token',
    },
  },
}));

// Mock the auth module to avoid CognitoUserPool initialization
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'test' }, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import MessageModal from '@/features/messages/components/MessageModal';
import { renderWithProviders } from '../../utils/renderWithProviders';
import { createMockConnection, createMockMessage, resetFactoryCounters } from '../../utils/mockFactories';
import type { Connection } from '@/shared/types';

describe('MessageModal', () => {
  beforeEach(() => {
    resetFactoryCounters();
    mockToast.mockClear();
  });

  const createConnection = (overrides: Partial<Connection> = {}): Connection => {
    return {
      ...createMockConnection(),
      ...overrides,
    };
  };

  describe('rendering', () => {
    it('renders when isOpen is true', () => {
      const connection = createConnection({
        first_name: 'John',
        last_name: 'Doe',
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Messages with John Doe/)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={false}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays connection info in description', () => {
      const connection = createConnection({
        position: 'Software Engineer',
        company: 'Tech Corp',
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Software Engineer at Tech Corp')).toBeInTheDocument();
    });

    it('displays only position when company is missing', () => {
      const connection = createConnection({
        position: 'Software Engineer',
        company: '',
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    });

    it('displays fallback when position and company are missing', () => {
      const connection = createConnection({
        position: '',
        company: '',
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('LinkedIn Connection')).toBeInTheDocument();
    });
  });

  describe('message history', () => {
    it('shows message history when present', () => {
      const connection = createConnection({
        message_history: [
          createMockMessage({ content: 'Hello!', sender: 'user' }),
          createMockMessage({ content: 'Hi there!', sender: 'connection' }),
        ],
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Hello!')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('shows empty state when no messages', () => {
      const connection = createConnection({
        first_name: 'John',
        message_history: [],
      });

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      // NoMessagesState component should be rendered
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument();
    });

    it('shows loading state when isLoadingMessages is true', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          isLoadingMessages={true}
        />
      );

      expect(screen.getByText('Loading message history...')).toBeInTheDocument();
    });

    it('shows error state when messagesError is set', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          messagesError="Failed to load"
        />
      );

      expect(screen.getByText('Failed to Load Messages')).toBeInTheDocument();
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('shows retry button when onRetryLoadMessages is provided', () => {
      const connection = createConnection();
      const onRetry = vi.fn();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          messagesError="Failed to load"
          onRetryLoadMessages={onRetry}
        />
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  describe('message input', () => {
    it('displays message input field', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    });

    it('shows pre-populated message when provided', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          prePopulatedMessage="Hello, this is a test message"
        />
      );

      expect(screen.getByDisplayValue('Hello, this is a test message')).toBeInTheDocument();
    });

    it('shows character count', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('0/1000')).toBeInTheDocument();
    });

    it('updates character count on input', async () => {
      const connection = createConnection();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello');

      expect(screen.getByText('5/1000')).toBeInTheDocument();
    });
  });

  describe('send functionality', () => {
    it('calls onSendMessage when send button is clicked', async () => {
      const connection = createConnection();
      const onSendMessage = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello world');

      const sendButton = screen.getByLabelText('Send message');
      await user.click(sendButton);

      expect(onSendMessage).toHaveBeenCalledWith('Hello world');
    });

    it('shows toast when trying to send empty message', async () => {
      const connection = createConnection();
      const onSendMessage = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      );

      // Clear any pre-existing input and trigger send
      const input = screen.getByPlaceholderText('Type your message...');
      await user.clear(input);

      // The send button should be disabled when empty
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeDisabled();
    });

    it('clears input after successful send', async () => {
      const connection = createConnection();
      const onSendMessage = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello world');

      const sendButton = screen.getByLabelText('Send message');
      await user.click(sendButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('disables send button while sending', async () => {
      const connection = createConnection();
      // Create a promise that doesn't resolve immediately
      let resolvePromise: () => void;
      const sendPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSendMessage = vi.fn().mockImplementation(() => sendPromise);
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          onSendMessage={onSendMessage}
        />
      );

      const input = screen.getByPlaceholderText('Type your message...');
      await user.type(input, 'Hello');

      const sendButton = screen.getByLabelText('Send message');
      await user.click(sendButton);

      // Button should be disabled while sending
      expect(sendButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!();
    });
  });

  describe('generation controls', () => {
    it('shows AI Generated badge when isGeneratedContent is true', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          isGeneratedContent={true}
        />
      );

      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });

    it('shows Skip and Approve buttons when showGenerationControls is true', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          showGenerationControls={true}
          onApproveAndNext={vi.fn()}
          onSkipConnection={vi.fn()}
        />
      );

      expect(screen.getByText('Skip')).toBeInTheDocument();
      expect(screen.getByText('Approve & Next')).toBeInTheDocument();
    });

    it('calls onApproveAndNext when Approve button is clicked', async () => {
      const connection = createConnection();
      const onApproveAndNext = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          showGenerationControls={true}
          onApproveAndNext={onApproveAndNext}
          onSkipConnection={vi.fn()}
        />
      );

      const approveButton = screen.getByText('Approve & Next');
      await user.click(approveButton);

      expect(onApproveAndNext).toHaveBeenCalled();
    });

    it('calls onSkipConnection when Skip button is clicked', async () => {
      const connection = createConnection();
      const onSkipConnection = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          showGenerationControls={true}
          onApproveAndNext={vi.fn()}
          onSkipConnection={onSkipConnection}
        />
      );

      const skipButton = screen.getByText('Skip');
      await user.click(skipButton);

      expect(onSkipConnection).toHaveBeenCalled();
    });

    it('shows different placeholder when isGeneratedContent is true', () => {
      const connection = createConnection();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          isGeneratedContent={true}
        />
      );

      expect(screen.getByPlaceholderText('Edit the AI-generated message...')).toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('calls onClose when dialog is closed', async () => {
      const connection = createConnection();
      const onClose = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={onClose}
        />
      );

      // Find and click the close button (X)
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onSkipConnection when closing in generation mode', async () => {
      const connection = createConnection();
      const onSkipConnection = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <MessageModal
          isOpen={true}
          connection={connection}
          onClose={vi.fn()}
          showGenerationControls={true}
          onApproveAndNext={vi.fn()}
          onSkipConnection={onSkipConnection}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onSkipConnection).toHaveBeenCalled();
    });
  });
});
