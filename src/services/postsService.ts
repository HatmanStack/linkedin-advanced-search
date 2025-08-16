import { puppeteerApiService } from './puppeteerApiService';
import { lambdaApiService } from './lambdaApiService';
import type { UserProfile } from '../contexts/UserProfileContext';

export const postsService = {
  async saveUnsentPostToProfile(
    content: string,
    userProfile: UserProfile,
    options?: { researchContent?: string | null; ideas?: string[] | null }
  ): Promise<void> {
    const existingAIGenerated = (userProfile as any)?.ai_generated_post_content || {};
    const newAIGenerated: Record<string, any> = { ...existingAIGenerated };
    if (options && typeof options.researchContent === 'string') {
      newAIGenerated.research_content = options.researchContent;
    }
    if (options && Array.isArray(options.ideas)) {
      newAIGenerated.ideas = options.ideas;
    }

    const updates: Partial<UserProfile> = {
      ...(userProfile as any),
      // cast to any to permit new fields until backend fully supports them
      unpublished_post_content: content,
      ai_generated_post_content: newAIGenerated,
    } as any;
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to save unsent post');
  },

  async clearUnsentPostFromProfile(userProfile: UserProfile): Promise<void> {
    const { unpublished_post_content, ...rest } = (userProfile as any) || {};
    const updates: Partial<UserProfile> = { ...rest, unpublished_post_content: '' } as any;
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to clear unsent post');
  },

  async publishPost(content: string): Promise<void> {
    const resp = await puppeteerApiService.createLinkedInPost({ content });
    if (!resp.success) throw new Error('Failed to publish post');
  },

  async generateIdeas(prompt?: string, userProfile?: UserProfile): Promise<string[]> {
    try {
      const profileToSend = userProfile
        ? (() => { const { unsent_post_content, unpublished_post_content, ai_generated_post_content, linkedin_credentials, ...rest } = userProfile as any; return rest; })()
        : null;
      const response = await lambdaApiService.sendLLMRequest('generate_ideas', {
        prompt: prompt || '',
        user_profile: profileToSend
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate ideas');
      }
      
      // Return the ideas array directly
      return response.data?.ideas || [];
    } catch (error) {
      console.error('Error generating ideas:', error);
      throw new Error('Failed to generate ideas');
    }
  },

  async researchTopics(topics: string[], userProfile?: UserProfile): Promise<string> {
    try {
      const response = await lambdaApiService.sendLLMRequest('research_selected_ideas', {
        selected_ideas: topics,
        user_profile: (userProfile
          ? (() => { const { unsent_post_content, unpublished_post_content, ai_generated_post_content, linkedin_credentials, ...rest } = userProfile as any; return rest; })()
          : null)
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to research topics');
      }
      const jobId: string | undefined = (response.data?.job_id || response.data?.jobId) as (string | undefined);
      if (!jobId) {
        throw new Error('No job_id returned for research request');
      }

      // Simple polling loop that queries the profiles backend for research results.
      // This avoids coupling to profile fields and simply expects the backend to return
      // { success: true, content: string } when ready.
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const delayMs = 2 * 60_000; // 2 minutes before first check
      const intervalMs = 60_000;  // then every 1 minute
      const maxChecks = 30;       // up to ~30 minutes total

      await sleep(delayMs);
      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<{ content?: string }>('get_research_result', { job_id: jobId });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const content = (poll as any).content || (poll as any).data?.content;
            if (content && typeof content === 'string' && content.trim().length > 0) {
              return content;
            }
          }
        } catch (_) {
          // ignore transient errors and continue polling
        }
        if (i < maxChecks - 1) await sleep(intervalMs);
      }
      throw new Error('Deep research polling timed out');
    } catch (error) {
      console.error('Error researching topics:', error);
      throw new Error('Failed to research topics');
    }
  },

  async synthesizeResearch(
    payload: { existing_content: string; research_content?: string },
    userProfile?: UserProfile
  ): Promise<string> {
    try {
      const profileToSend = userProfile
        ? (() => { const { unsent_post_content, unpublished_post_content, ai_generated_post_content, linkedin_credentials, ...rest } = userProfile as any; return rest; })()
        : null;
      const response = await lambdaApiService.sendLLMRequest('synthesize_research', {
        existing_content: payload.existing_content,
        research_content: payload.research_content ?? null,
        user_profile: profileToSend
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to synthesize research');
      }

      const content: string | undefined = (response.data?.post || response.data?.synthesized_content) as (string | undefined);
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid synthesize response');
      }
      return content;
    } catch (error) {
      console.error('Error synthesizing research:', error);
      throw new Error('Failed to synthesize research');
    }
  },
};


