import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postsService } from '@/services/postsService';

// Mock dependencies
vi.mock('@/services/puppeteerApiService', () => ({
  puppeteerApiService: {
    createLinkedInPost: vi.fn(),
  },
}));

vi.mock('@/services/lambdaApiService', () => ({
  lambdaApiService: {
    updateUserProfile: vi.fn(),
    sendLLMRequest: vi.fn(),
    callProfilesOperation: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-job-id-123'),
}));

import { puppeteerApiService } from '@/services/puppeteerApiService';
import { lambdaApiService } from '@/services/lambdaApiService';

describe('postsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('saveUnsentPostToProfile', () => {
    it('should save unsent post content successfully', async () => {
      vi.mocked(lambdaApiService.updateUserProfile).mockResolvedValue({
        success: true,
      });

      await postsService.saveUnsentPostToProfile('Test post content');

      expect(lambdaApiService.updateUserProfile).toHaveBeenCalledWith({
        unpublished_post_content: 'Test post content',
      });
    });

    it('should throw error when save fails', async () => {
      vi.mocked(lambdaApiService.updateUserProfile).mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      await expect(
        postsService.saveUnsentPostToProfile('Test content')
      ).rejects.toThrow('Database error');
    });
  });

  describe('clearUnsentPostFromProfile', () => {
    it('should clear unsent post content successfully', async () => {
      vi.mocked(lambdaApiService.updateUserProfile).mockResolvedValue({
        success: true,
      });

      await postsService.clearUnsentPostFromProfile();

      expect(lambdaApiService.updateUserProfile).toHaveBeenCalledWith({
        unpublished_post_content: '',
      });
    });

    it('should throw error when clear fails', async () => {
      vi.mocked(lambdaApiService.updateUserProfile).mockResolvedValue({
        success: false,
        error: 'Clear failed',
      });

      await expect(postsService.clearUnsentPostFromProfile()).rejects.toThrow(
        'Clear failed'
      );
    });
  });

  describe('publishPost', () => {
    it('should publish post successfully', async () => {
      vi.mocked(puppeteerApiService.createLinkedInPost).mockResolvedValue({
        success: true,
        data: { postId: 'post-123' },
      });

      await postsService.publishPost('My LinkedIn post');

      expect(puppeteerApiService.createLinkedInPost).toHaveBeenCalledWith({
        content: 'My LinkedIn post',
      });
    });

    it('should throw error when publish fails', async () => {
      vi.mocked(puppeteerApiService.createLinkedInPost).mockResolvedValue({
        success: false,
      });

      await expect(postsService.publishPost('Test')).rejects.toThrow(
        'Failed to publish post'
      );
    });
  });

  describe('generateIdeas', () => {
    it('should generate ideas successfully with polling', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: { job_id: 'test-job-id-123' },
      });

      vi.mocked(lambdaApiService.callProfilesOperation)
        .mockResolvedValueOnce({ success: false }) // First poll - not ready
        .mockResolvedValueOnce({
          // Second poll - ready
          success: true,
          ideas: ['Idea 1', 'Idea 2', 'Idea 3'],
        });

      const promise = postsService.generateIdeas('AI trends');

      // Advance time for first poll
      await vi.advanceTimersByTimeAsync(5000);
      // Advance time for second poll
      await vi.advanceTimersByTimeAsync(5000);

      const ideas = await promise;

      expect(ideas).toEqual(['Idea 1', 'Idea 2', 'Idea 3']);
      expect(lambdaApiService.sendLLMRequest).toHaveBeenCalledWith(
        'generate_ideas',
        expect.objectContaining({
          prompt: 'AI trends',
          job_id: 'test-job-id-123',
        })
      );
    });

    it('should prevent concurrent idea generation', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Start first request
      const promise1 = postsService.generateIdeas('prompt1');

      // Try to start second request immediately
      await expect(postsService.generateIdeas('prompt2')).rejects.toThrow(
        'Idea generation already in progress'
      );
    });

    it('should timeout after max polling attempts', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockResolvedValue({
        success: false, // Always not ready
      });

      const promise = postsService.generateIdeas('test');

      // Advance through all 35 polling attempts
      for (let i = 0; i < 35; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await expect(promise).rejects.toThrow('Idea generation polling timed out');
    });

    it('should handle request failure', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: false,
        error: 'LLM service unavailable',
      });

      await expect(postsService.generateIdeas('test')).rejects.toThrow(
        'Failed to request idea generation'
      );
    });
  });

  describe('researchTopics', () => {
    it('should research topics successfully with polling', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: { job_id: 'research-job-123' },
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockResolvedValueOnce({
        success: true,
        content: 'Detailed research content about AI trends...',
      });

      const promise = postsService.researchTopics(['AI', 'Machine Learning']);

      // Advance past initial 2-minute delay
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      const content = await promise;

      expect(content).toBe('Detailed research content about AI trends...');
      expect(lambdaApiService.sendLLMRequest).toHaveBeenCalledWith(
        'research_selected_ideas',
        expect.objectContaining({
          selected_ideas: ['AI', 'Machine Learning'],
        })
      );
    });

    it('should throw error when no job_id returned', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: {}, // No job_id
      });

      await expect(
        postsService.researchTopics(['topic1'])
      ).rejects.toThrow('No job_id returned for research request');
    });

    it('should timeout after max polling attempts', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: { job_id: 'job-123' },
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockResolvedValue({
        success: false, // Never ready
      });

      const promise = postsService.researchTopics(['topic1']);

      // Initial delay + max polls
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(60 * 1000);
      }

      await expect(promise).rejects.toThrow('Deep research polling timed out');
    });
  });

  describe('synthesizeResearch', () => {
    it('should synthesize research successfully', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: { job_id: 'synth-job-123' },
      });

      vi.mocked(lambdaApiService.callProfilesOperation)
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({
          success: true,
          sections: {
            '1': 'Synthesized content',
            '2': 'Reasoning for synthesis',
            '3': 'Attention-grabbing hook',
          },
        });

      const promise = postsService.synthesizeResearch({
        existing_content: 'Draft content',
        research_content: 'Research data',
        selected_ideas: ['Idea 1'],
      });

      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;

      expect(result).toEqual({
        content: 'Synthesized content',
        reasoning: 'Reasoning for synthesis',
        hook: 'Attention-grabbing hook',
      });
    });

    it('should prevent concurrent synthesis', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockImplementation(
        () => new Promise(() => {})
      );

      // Start first synthesis
      const promise1 = postsService.synthesizeResearch({
        existing_content: 'content',
      });

      // Try concurrent synthesis
      await expect(
        postsService.synthesizeResearch({ existing_content: 'content2' })
      ).rejects.toThrow('Synthesis already in progress');
    });

    it('should timeout after max polling attempts', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
      });

      vi.mocked(lambdaApiService.callProfilesOperation).mockResolvedValue({
        success: false,
      });

      const promise = postsService.synthesizeResearch({
        existing_content: 'test',
      });

      for (let i = 0; i < 35; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await expect(promise).rejects.toThrow('Synthesis polling timed out');
    });
  });

  describe('applyPostStyle', () => {
    it('should apply post style successfully', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: { content: 'Styled post content' },
      });

      const result = await postsService.applyPostStyle(
        'Original content',
        'professional'
      );

      expect(result).toBe('Styled post content');
      expect(lambdaApiService.sendLLMRequest).toHaveBeenCalledWith(
        'post_style_change',
        {
          existing_content: 'Original content',
          style: 'professional',
        }
      );
    });

    it('should handle nested data structure', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: {
          data: { content: 'Nested styled content' },
        },
      });

      const result = await postsService.applyPostStyle('test', 'casual');

      expect(result).toBe('Nested styled content');
    });

    it('should throw error when no content returned', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: true,
        data: {}, // No content field
      });

      await expect(
        postsService.applyPostStyle('test', 'style')
      ).rejects.toThrow('No styled content returned from backend');
    });

    it('should throw error when request fails', async () => {
      vi.mocked(lambdaApiService.sendLLMRequest).mockResolvedValue({
        success: false,
        error: 'Style service error',
      });

      await expect(
        postsService.applyPostStyle('test', 'style')
      ).rejects.toThrow('Style service error');
    });
  });
});
