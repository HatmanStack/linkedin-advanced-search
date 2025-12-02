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

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'test' }, isLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the posts context
const mockClearSynthesis = vi.fn();
vi.mock('@/features/posts', () => ({
  usePostComposer: () => ({
    postReasoning: null,
    postHook: null,
    clearSynthesis: mockClearSynthesis,
  }),
  postsService: {
    applyPostStyle: vi.fn().mockResolvedValue('Styled content'),
  },
}));

import PostEditor from '@/features/posts/components/PostEditor';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('PostEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear sessionStorage
    sessionStorage.clear();
  });

  const defaultProps = {
    content: '',
    onContentChange: vi.fn(),
    onSaveDraft: vi.fn(),
    onPublishPost: vi.fn(),
    isSavingDraft: false,
    isPublishing: false,
  };

  describe('rendering', () => {
    it('renders the post editor', () => {
      renderWithProviders(<PostEditor {...defaultProps} />);

      expect(screen.getByText('Create LinkedIn Post')).toBeInTheDocument();
    });

    it('renders the textarea', () => {
      renderWithProviders(<PostEditor {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Share your thoughts/)).toBeInTheDocument();
    });

    it('displays character count', () => {
      renderWithProviders(<PostEditor {...defaultProps} content="Hello" />);

      expect(screen.getByText('5/3000 characters')).toBeInTheDocument();
    });

    it('renders Save button', () => {
      renderWithProviders(<PostEditor {...defaultProps} />);

      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders Publish Post button', () => {
      renderWithProviders(<PostEditor {...defaultProps} />);

      expect(screen.getByText('Publish Post')).toBeInTheDocument();
    });
  });

  describe('content editing', () => {
    it('calls onContentChange when typing in textarea', async () => {
      const onContentChange = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <PostEditor {...defaultProps} onContentChange={onContentChange} />
      );

      const textarea = screen.getByPlaceholderText(/Share your thoughts/);
      await user.type(textarea, 'Hello world');

      // onContentChange should be called for each character
      expect(onContentChange).toHaveBeenCalled();
    });

    it('displays provided content', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} content="Test content" />
      );

      expect(screen.getByDisplayValue('Test content')).toBeInTheDocument();
    });
  });

  describe('save functionality', () => {
    it('calls onSaveDraft when Save button is clicked', async () => {
      const onSaveDraft = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <PostEditor {...defaultProps} onSaveDraft={onSaveDraft} />
      );

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      expect(onSaveDraft).toHaveBeenCalled();
    });

    it('shows Saving... when isSavingDraft is true', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} isSavingDraft={true} />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('disables Save button when isSavingDraft is true', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} isSavingDraft={true} />
      );

      const saveButton = screen.getByRole('button', { name: /Saving/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('publish functionality', () => {
    it('calls onPublishPost when Publish button is clicked', async () => {
      const onPublishPost = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <PostEditor
          {...defaultProps}
          content="Some content"
          onPublishPost={onPublishPost}
        />
      );

      const publishButton = screen.getByText('Publish Post');
      await user.click(publishButton);

      expect(onPublishPost).toHaveBeenCalled();
    });

    it('shows Publishing... when isPublishing is true', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} content="Some content" isPublishing={true} />
      );

      expect(screen.getByText('Publishing...')).toBeInTheDocument();
    });

    it('disables Publish button when content is empty', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} content="" />
      );

      const publishButton = screen.getByRole('button', { name: /Publish Post/i });
      expect(publishButton).toBeDisabled();
    });

    it('disables Publish button when content is only whitespace', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} content="   " />
      );

      const publishButton = screen.getByRole('button', { name: /Publish Post/i });
      expect(publishButton).toBeDisabled();
    });

    it('enables Publish button when content is present', () => {
      renderWithProviders(
        <PostEditor {...defaultProps} content="Valid content" />
      );

      const publishButton = screen.getByRole('button', { name: /Publish Post/i });
      expect(publishButton).not.toBeDisabled();
    });
  });

  describe('synthesize functionality', () => {
    it('renders Synthesize button when onSynthesizeResearch is provided', () => {
      const onSynthesizeResearch = vi.fn();

      renderWithProviders(
        <PostEditor
          {...defaultProps}
          onSynthesizeResearch={onSynthesizeResearch}
        />
      );

      expect(screen.getByText('Synthesize')).toBeInTheDocument();
    });

    it('calls onSynthesizeResearch when Synthesize button is clicked', async () => {
      const onSynthesizeResearch = vi.fn();
      const user = userEvent.setup();

      renderWithProviders(
        <PostEditor
          {...defaultProps}
          onSynthesizeResearch={onSynthesizeResearch}
        />
      );

      const synthesizeButton = screen.getByText('Synthesize');
      await user.click(synthesizeButton);

      expect(onSynthesizeResearch).toHaveBeenCalled();
    });

    it('shows Synthesizing... when isSynthesizing is true', () => {
      renderWithProviders(
        <PostEditor
          {...defaultProps}
          onSynthesizeResearch={vi.fn()}
          isSynthesizing={true}
        />
      );

      expect(screen.getByText('Synthesizing...')).toBeInTheDocument();
    });

    it('disables Synthesize button when isSynthesizing is true', () => {
      renderWithProviders(
        <PostEditor
          {...defaultProps}
          onSynthesizeResearch={vi.fn()}
          isSynthesizing={true}
        />
      );

      const synthesizeButton = screen.getByRole('button', { name: /Synthesizing/i });
      expect(synthesizeButton).toBeDisabled();
    });
  });

  describe('description text', () => {
    it('shows card description', () => {
      renderWithProviders(<PostEditor {...defaultProps} />);

      expect(
        screen.getByText(/Compose engaging content for your LinkedIn audience/)
      ).toBeInTheDocument();
    });
  });
});
