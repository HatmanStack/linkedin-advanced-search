import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

const mockSetContent = vi.fn();
const mockSaveDraft = vi.fn();
const mockPublish = vi.fn();
const mockGenerateIdeas = vi.fn();
const mockResearchTopics = vi.fn();
const mockSynthesizeResearch = vi.fn();
const mockClearResearch = vi.fn();
const mockClearIdea = vi.fn();
const mockSetIdeas = vi.fn();
const mockToast = vi.fn();

vi.mock('@/features/posts', () => ({
  usePostComposer: () => ({
    content: '',
    setContent: mockSetContent,
    isSaving: false,
    isPublishing: false,
    isGeneratingIdeas: false,
    isResearching: false,
    isSynthesizing: false,
    saveDraft: mockSaveDraft,
    publish: mockPublish,
    generateIdeas: mockGenerateIdeas,
    researchTopics: mockResearchTopics,
    synthesizeResearch: mockSynthesizeResearch,
    clearResearch: mockClearResearch,
    clearIdea: mockClearIdea,
    ideas: [],
    setIdeas: mockSetIdeas,
  }),
  PostEditor: ({ content, onContentChange, onSaveDraft, onPublishPost, isSavingDraft, isPublishing, onSynthesizeResearch }: {
    content: string;
    onContentChange: (c: string) => void;
    onSaveDraft: () => void;
    onPublishPost: () => void;
    isSavingDraft: boolean;
    isPublishing: boolean;
    onSynthesizeResearch?: () => void;
  }) => (
    <div data-testid="post-editor">
      <textarea
        data-testid="post-content"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
      />
      <button data-testid="save-draft" onClick={onSaveDraft} disabled={isSavingDraft}>
        {isSavingDraft ? 'Saving...' : 'Save Draft'}
      </button>
      <button data-testid="publish" onClick={onPublishPost} disabled={isPublishing}>
        {isPublishing ? 'Publishing...' : 'Publish'}
      </button>
      {onSynthesizeResearch && (
        <button data-testid="synthesize" onClick={onSynthesizeResearch}>
          Synthesize
        </button>
      )}
    </div>
  ),
  PostAIAssistant: ({ onGenerateIdeas, onResearchTopics, onValidationError, isGeneratingIdeas, isResearching, ideas, onIdeasUpdate }: {
    onGenerateIdeas: (prompt?: string) => void;
    onResearchTopics: () => void;
    onValidationError: (msg: string) => void;
    isGeneratingIdeas: boolean;
    isResearching: boolean;
    ideas: string[];
    onIdeasUpdate: (ideas: string[]) => void;
  }) => (
    <div data-testid="ai-assistant">
      <button data-testid="generate-ideas" onClick={() => onGenerateIdeas('test prompt')} disabled={isGeneratingIdeas}>
        {isGeneratingIdeas ? 'Generating...' : 'Generate Ideas'}
      </button>
      <button data-testid="research-topics" onClick={onResearchTopics} disabled={isResearching}>
        {isResearching ? 'Researching...' : 'Research Topics'}
      </button>
      <button data-testid="validation-error" onClick={() => onValidationError('No ideas selected')}>
        Trigger Validation Error
      </button>
      <button data-testid="update-ideas" onClick={() => onIdeasUpdate(['idea1', 'idea2'])}>
        Update Ideas
      </button>
      <div data-testid="ideas-count">{ideas.length} ideas</div>
    </div>
  ),
}));

vi.mock('@/features/search', () => ({
  ResearchResultsCard: ({ isResearching, onClear }: { isResearching: boolean; onClear: () => void }) => (
    <div data-testid="research-results">
      <span>{isResearching ? 'Researching...' : 'Research Results'}</span>
      <button data-testid="clear-research" onClick={onClear}>Clear Research</button>
    </div>
  ),
}));

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import NewPostTab from '@/features/posts/components/NewPostTab';
import { renderWithProviders } from '../../utils/renderWithProviders';

describe('NewPostTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the PostEditor component', () => {
      renderWithProviders(<NewPostTab />);

      expect(screen.getByTestId('post-editor')).toBeInTheDocument();
    });

    it('renders the PostAIAssistant component', () => {
      renderWithProviders(<NewPostTab />);

      expect(screen.getByTestId('ai-assistant')).toBeInTheDocument();
    });

    it('renders the ResearchResultsCard component', () => {
      renderWithProviders(<NewPostTab />);

      expect(screen.getByTestId('research-results')).toBeInTheDocument();
    });
  });

  describe('PostEditor integration', () => {
    it('passes saveDraft to PostEditor', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const saveButton = screen.getByTestId('save-draft');
      await user.click(saveButton);

      expect(mockSaveDraft).toHaveBeenCalled();
    });

    it('passes publish to PostEditor', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const publishButton = screen.getByTestId('publish');
      await user.click(publishButton);

      expect(mockPublish).toHaveBeenCalled();
    });

    it('passes synthesizeResearch to PostEditor', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const synthesizeButton = screen.getByTestId('synthesize');
      await user.click(synthesizeButton);

      expect(mockSynthesizeResearch).toHaveBeenCalled();
    });
  });

  describe('AI Assistant integration', () => {
    it('handles generateIdeas', async () => {
      mockGenerateIdeas.mockResolvedValue(['idea1', 'idea2']);
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const generateButton = screen.getByTestId('generate-ideas');
      await user.click(generateButton);

      await waitFor(() => {
        expect(mockGenerateIdeas).toHaveBeenCalled();
      });
    });

    it('handles researchTopics', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const researchButton = screen.getByTestId('research-topics');
      await user.click(researchButton);

      expect(mockResearchTopics).toHaveBeenCalled();
    });

    it('handles validation error with toast', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const validationButton = screen.getByTestId('validation-error');
      await user.click(validationButton);

      expect(mockToast).toHaveBeenCalledWith({
        title: 'No Ideas Selected',
        description: 'No ideas selected',
        variant: 'destructive',
      });
    });

    it('handles ideas update', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const updateButton = screen.getByTestId('update-ideas');
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockClearIdea).toHaveBeenCalledWith(['idea1', 'idea2']);
      });
    });

    it('shows error toast when ideas update fails', async () => {
      mockClearIdea.mockRejectedValueOnce(new Error('Failed to update'));
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const updateButton = screen.getByTestId('update-ideas');
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to update ideas. Please try again.',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Research Results integration', () => {
    it('handles clearResearch', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const clearButton = screen.getByTestId('clear-research');
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockClearResearch).toHaveBeenCalled();
      });
    });

    it('shows error toast when clearResearch fails', async () => {
      mockClearResearch.mockRejectedValueOnce(new Error('Failed to clear'));
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const clearButton = screen.getByTestId('clear-research');
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to clear research. Please try again.',
          variant: 'destructive',
        });
      });
    });
  });

  describe('error handling', () => {
    it('handles generateIdeas error gracefully', async () => {
      mockGenerateIdeas.mockRejectedValueOnce(new Error('Generation failed'));
      const user = userEvent.setup();
      renderWithProviders(<NewPostTab />);

      const generateButton = screen.getByTestId('generate-ideas');
      await user.click(generateButton);

      // Should not throw, error is caught and logged
      await waitFor(() => {
        expect(mockGenerateIdeas).toHaveBeenCalled();
      });
    });
  });
});
