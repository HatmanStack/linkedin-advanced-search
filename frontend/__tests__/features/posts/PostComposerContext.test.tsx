import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// Mock modules
const mockSaveUnsentPostToProfile = vi.fn();
const mockPublishPost = vi.fn();
const mockClearUnsentPostFromProfile = vi.fn();
const mockGenerateIdeas = vi.fn();
const mockResearchTopics = vi.fn();
const mockSynthesizeResearch = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockToast = vi.fn();

const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUserProfile = {
  id: 'profile-1',
  email: 'test@example.com',
  unpublished_post_content: '',
  ai_generated_research: null,
  ai_generated_ideas: [],
  ai_generated_post_reasoning: null,
  ai_generated_post_hook: null,
};

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: mockUser, isLoading: false }),
}));

vi.mock('@/features/profile', () => ({
  useUserProfile: () => ({ userProfile: mockUserProfile, isLoading: false }),
}));

vi.mock('@/shared/hooks', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/features/posts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/posts')>();
  return {
    ...original,
    postsService: {
      saveUnsentPostToProfile: (...args: unknown[]) => mockSaveUnsentPostToProfile(...args),
      publishPost: (...args: unknown[]) => mockPublishPost(...args),
      clearUnsentPostFromProfile: (...args: unknown[]) => mockClearUnsentPostFromProfile(...args),
      generateIdeas: (...args: unknown[]) => mockGenerateIdeas(...args),
      researchTopics: (...args: unknown[]) => mockResearchTopics(...args),
      synthesizeResearch: (...args: unknown[]) => mockSynthesizeResearch(...args),
    },
  };
});

vi.mock('@/shared/services', () => ({
  lambdaApiService: {
    updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  },
}));

import { PostComposerProvider, usePostComposer } from '@/features/posts/contexts/PostComposerContext';

describe('PostComposerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Default mocks
    mockSaveUnsentPostToProfile.mockResolvedValue(undefined);
    mockPublishPost.mockResolvedValue(undefined);
    mockClearUnsentPostFromProfile.mockResolvedValue(undefined);
    mockGenerateIdeas.mockResolvedValue(['idea1', 'idea2']);
    mockResearchTopics.mockResolvedValue('Research content');
    mockSynthesizeResearch.mockResolvedValue({ content: 'Synthesized content' });
    mockUpdateUserProfile.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PostComposerProvider>{children}</PostComposerProvider>
  );

  describe('usePostComposer hook', () => {
    it('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => usePostComposer());
      }).toThrow('usePostComposer must be used within PostComposerProvider');
    });

    it('provides context when used inside provider', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current).toBeDefined();
      expect(typeof result.current.setContent).toBe('function');
      expect(typeof result.current.saveDraft).toBe('function');
      expect(typeof result.current.publish).toBe('function');
    });
  });

  describe('initial state', () => {
    it('starts with empty content', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await waitFor(() => {
        expect(result.current.content).toBe('');
      });
    });

    it('starts with isSaving false', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current.isSaving).toBe(false);
    });

    it('starts with isPublishing false', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current.isPublishing).toBe(false);
    });

    it('starts with isGeneratingIdeas false', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current.isGeneratingIdeas).toBe(false);
    });

    it('starts with isResearching false', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current.isResearching).toBe(false);
    });

    it('starts with isSynthesizing false', () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      expect(result.current.isSynthesizing).toBe(false);
    });

    it('starts with empty ideas array', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await waitFor(() => {
        expect(result.current.ideas).toEqual([]);
      });
    });
  });

  describe('setContent', () => {
    it('updates content value', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('New content');
      });

      expect(result.current.content).toBe('New content');
    });
  });

  describe('saveDraft', () => {
    it('does not save empty content', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(mockSaveUnsentPostToProfile).not.toHaveBeenCalled();
    });

    it('saves content when not empty', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(mockSaveUnsentPostToProfile).toHaveBeenCalledWith('Test content');
    });

    it('shows success toast after saving', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Draft saved',
        description: 'Editor text saved.',
      });
    });

    it('sets isSaving to false after completion', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.saveDraft();
      });

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('publish', () => {
    it('does not publish empty content', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.publish();
      });

      expect(mockPublishPost).not.toHaveBeenCalled();
    });

    it('publishes content when not empty', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.publish();
      });

      expect(mockPublishPost).toHaveBeenCalledWith('Test content');
    });

    it('clears unsent post after publishing', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.publish();
      });

      expect(mockClearUnsentPostFromProfile).toHaveBeenCalled();
    });

    it('clears content after publishing', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.publish();
      });

      expect(result.current.content).toBe('');
    });

    it('sets isPublishing to false after completion', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setContent('Test content');
      });

      await act(async () => {
        await result.current.publish();
      });

      expect(result.current.isPublishing).toBe(false);
    });
  });

  describe('generateIdeas', () => {
    it('calls postsService.generateIdeas', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.generateIdeas('test prompt');
      });

      expect(mockGenerateIdeas).toHaveBeenCalled();
    });

    it('returns generated ideas', async () => {
      mockGenerateIdeas.mockResolvedValueOnce(['idea A', 'idea B', 'idea C']);
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      let ideas: string[] = [];
      await act(async () => {
        ideas = await result.current.generateIdeas();
      });

      expect(ideas).toEqual(['idea A', 'idea B', 'idea C']);
    });

    it('updates ideas state', async () => {
      mockGenerateIdeas.mockResolvedValueOnce(['new idea 1', 'new idea 2']);
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.generateIdeas();
      });

      expect(result.current.ideas).toEqual(['new idea 1', 'new idea 2']);
    });

    it('stores ideas in sessionStorage', async () => {
      mockGenerateIdeas.mockResolvedValueOnce(['stored idea']);
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.generateIdeas();
      });

      const stored = sessionStorage.getItem('ai_generated_ideas');
      expect(stored).toBe(JSON.stringify(['stored idea']));
    });

    it('sets isGeneratingIdeas to false after completion', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.generateIdeas();
      });

      expect(result.current.isGeneratingIdeas).toBe(false);
    });
  });

  describe('researchTopics', () => {
    it('calls postsService.researchTopics', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.researchTopics(['topic1', 'topic2']);
      });

      expect(mockResearchTopics).toHaveBeenCalled();
    });

    it('updates researchContent state', async () => {
      mockResearchTopics.mockResolvedValueOnce('Research about topics');
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.researchTopics(['topic1']);
      });

      expect(result.current.researchContent).toBe('Research about topics');
    });

    it('sets isResearching to false after completion', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.researchTopics(['topic1']);
      });

      expect(result.current.isResearching).toBe(false);
    });
  });

  describe('synthesizeResearch', () => {
    it('calls postsService.synthesizeResearch', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(mockSynthesizeResearch).toHaveBeenCalled();
    });

    it('updates content with synthesized result', async () => {
      mockSynthesizeResearch.mockResolvedValueOnce({ content: 'Synthesized post' });
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(result.current.content).toBe('Synthesized post');
    });

    it('updates postReasoning when provided', async () => {
      mockSynthesizeResearch.mockResolvedValueOnce({
        content: 'Synthesized',
        reasoning: 'This is the reasoning',
      });
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(result.current.postReasoning).toBe('This is the reasoning');
    });

    it('updates postHook when provided', async () => {
      mockSynthesizeResearch.mockResolvedValueOnce({
        content: 'Synthesized',
        hook: 'This is the hook',
      });
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(result.current.postHook).toBe('This is the hook');
    });

    it('sets isSynthesizing to false after completion', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(result.current.isSynthesizing).toBe(false);
    });
  });

  describe('clearResearch', () => {
    it('clears researchContent state', async () => {
      mockResearchTopics.mockResolvedValueOnce('Research content');
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      // First add research
      await act(async () => {
        await result.current.researchTopics(['topic']);
      });

      expect(result.current.researchContent).toBe('Research content');

      // Then clear it
      await act(async () => {
        await result.current.clearResearch();
      });

      expect(result.current.researchContent).toBeNull();
    });

    it('updates user profile', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.clearResearch();
      });

      expect(mockUpdateUserProfile).toHaveBeenCalledWith({
        ai_generated_research: '',
      });
    });
  });

  describe('clearSynthesis', () => {
    it('clears postReasoning and postHook', async () => {
      mockSynthesizeResearch.mockResolvedValueOnce({
        content: 'Synthesized',
        reasoning: 'Reasoning',
        hook: 'Hook',
      });
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      // First synthesize
      await act(async () => {
        await result.current.synthesizeResearch();
      });

      expect(result.current.postReasoning).toBe('Reasoning');
      expect(result.current.postHook).toBe('Hook');

      // Then clear
      await act(async () => {
        await result.current.clearSynthesis();
      });

      expect(result.current.postReasoning).toBeNull();
      expect(result.current.postHook).toBeNull();
    });

    it('updates user profile', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.clearSynthesis();
      });

      expect(mockUpdateUserProfile).toHaveBeenCalledWith({
        ai_generated_post_reasoning: '',
        ai_generated_post_hook: '',
      });
    });
  });

  describe('clearIdea', () => {
    it('updates ideas state with new ideas', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.clearIdea(['remaining idea']);
      });

      expect(result.current.ideas).toEqual(['remaining idea']);
    });

    it('updates user profile with new ideas', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.clearIdea(['idea1', 'idea2']);
      });

      expect(mockUpdateUserProfile).toHaveBeenCalledWith({
        ai_generated_ideas: ['idea1', 'idea2'],
      });
    });
  });

  describe('clearAllIdeas', () => {
    it('clears all ideas', async () => {
      mockGenerateIdeas.mockResolvedValueOnce(['idea1', 'idea2']);
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      // First generate ideas
      await act(async () => {
        await result.current.generateIdeas();
      });

      expect(result.current.ideas).toHaveLength(2);

      // Then clear all
      await act(async () => {
        await result.current.clearAllIdeas();
      });

      expect(result.current.ideas).toEqual([]);
    });

    it('updates user profile with empty ideas', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      await act(async () => {
        await result.current.clearAllIdeas();
      });

      expect(mockUpdateUserProfile).toHaveBeenCalledWith({
        ai_generated_ideas: [],
      });
    });
  });

  describe('setIdeas', () => {
    it('directly sets ideas state', async () => {
      const { result } = renderHook(() => usePostComposer(), { wrapper });

      act(() => {
        result.current.setIdeas(['direct idea 1', 'direct idea 2']);
      });

      expect(result.current.ideas).toEqual(['direct idea 1', 'direct idea 2']);
    });
  });
});
