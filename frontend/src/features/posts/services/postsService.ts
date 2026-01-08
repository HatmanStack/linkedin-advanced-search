import { puppeteerApiService } from '@/shared/services';
import { lambdaApiService } from '@/shared/services';
import { v4 as uuidv4 } from 'uuid';
import type { UserProfile } from '@/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PostsService');

/**
 * Remove sensitive/temporary fields before sending profile to backend.
 * Consolidates filtering logic to ensure consistent handling across all methods.
 */
function sanitizeProfileForBackend(userProfile?: UserProfile): Record<string, unknown> | null {
  if (!userProfile) return null;

  const profile = userProfile as Record<string, unknown>;
  const {
    // Temporary post content fields
    unsent_post_content,
    unpublished_post_content,
    ai_generated_post_content,
    // AI-generated content (regenerated on demand)
    ai_generated_ideas,
    ai_generated_research,
    ai_generated_post_hook,
    ai_generated_post_reasoning,
    // Sensitive credentials
    linkedin_credentials,
    ...rest
  } = profile;

  // Suppress unused variable warnings
  void unsent_post_content;
  void unpublished_post_content;
  void ai_generated_post_content;
  void ai_generated_ideas;
  void ai_generated_research;
  void ai_generated_post_hook;
  void ai_generated_post_reasoning;
  void linkedin_credentials;

  return rest;
}

// Prevent concurrent or duplicate idea polling loops (e.g., accidental double clicks or re-renders)
let ideasPollingInFlight = false;
// Prevent concurrent or duplicate synthesis polling loops
let synthPollingInFlight = false;

export const postsService = {
  async saveUnsentPostToProfile(content: string): Promise<void> {
    // Save only the textarea content
    const updates = { unpublished_post_content: content };
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to save unsent post');
  },

  async clearUnsentPostFromProfile(): Promise<void> {
    // Clear only the draft field
    const updates = { unpublished_post_content: '' };
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to clear unsent post');
  },

  async publishPost(content: string): Promise<void> {
    const resp = await puppeteerApiService.createLinkedInPost({ content });
    if (!resp.success) throw new Error('Failed to publish post');
  },

  async generateIdeas(prompt?: string, userProfile?: UserProfile): Promise<string[]> {
    try {
      if (ideasPollingInFlight) {
        throw new Error('Idea generation already in progress');
      }
      ideasPollingInFlight = true;

      const profileToSend = sanitizeProfileForBackend(userProfile);

      // Generate a client-side job id and request async idea generation
      const jobId = uuidv4();
      const response = await lambdaApiService.sendLLMRequest('generate_ideas', {
        prompt: prompt || '',
        user_profile: profileToSend,
        job_id: jobId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to request idea generation');
      }

      // Poll every 10 seconds for results stored by the backend under IDEAS#{job_id}
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const intervalMs = 5_000; // 5 seconds
      const maxChecks = 35;      // up to ~1.5 minutes

      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<{ ideas?: string[]; status?: string }>('get_research_result', {
            job_id: jobId,
            kind: 'IDEAS',
          });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const pollData = poll as Record<string, unknown>;
            const nestedData = pollData.data as Record<string, unknown> | undefined;
            const ideas = (pollData.ideas as string[]) || (nestedData?.ideas as string[]);
            if (Array.isArray(ideas) && ideas.length > 0) {
              logger.debug('Ideas generated', { ideas });
              ideasPollingInFlight = false;
              return ideas;
            }
          }
        } catch {
          // ignore transient errors and continue polling
        }
        if (i < maxChecks - 1) await sleep(intervalMs);
      }
      throw new Error('Idea generation polling timed out');
    } catch (error) {
      logger.error('Error generating ideas', { error });
      throw new Error('Failed to generate ideas');
    }
    finally {
      ideasPollingInFlight = false;
    }
  },

  async researchTopics(topics: string[], userProfile?: UserProfile): Promise<string> {
    try {
      const filteredProfile = sanitizeProfileForBackend(userProfile);
      const response = await lambdaApiService.sendLLMRequest('research_selected_ideas', {
        selected_ideas: topics,
        user_profile: filteredProfile,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to research topics');
      }
      const responseData = response.data as Record<string, unknown> | undefined;
      const jobId: string | undefined = (responseData?.job_id as string) || (responseData?.jobId as string);
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
          const poll = await lambdaApiService.callProfilesOperation<{ content?: string; status?: string }>('get_research_result', {
            job_id: jobId,
            kind: 'RESEARCH', });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const pollData = poll as Record<string, unknown>;
            const nestedData = pollData.data as Record<string, unknown> | undefined;
            const content = (pollData.content as string) || (nestedData?.content as string);
            if (content && typeof content === 'string' && content.trim().length > 0) {
              return content;
            }
          }
        } catch {
          // ignore transient errors and continue polling
        }
        if (i < maxChecks - 1) await sleep(intervalMs);
      }
      throw new Error('Deep research polling timed out');
    } catch (error) {
      logger.error('Error researching topics', { error });
      throw new Error('Failed to research topics');
    }
  },

  async synthesizeResearch(
    payload: { existing_content: string; research_content?: string; selected_ideas?: string[] },
    userProfile?: UserProfile
  ): Promise<{ content: string; reasoning: string; hook: string }> {
    try {
      if (synthPollingInFlight) {
        throw new Error('Synthesis already in progress');
      }
      synthPollingInFlight = true;

      const profileToSend = sanitizeProfileForBackend(userProfile);

      // Generate a client-side job id and request async synthesis
      const jobId = uuidv4();
      const response = await lambdaApiService.sendLLMRequest('synthesize_research', {
        existing_content: payload.existing_content,
        research_content: payload.research_content ?? null,
        selected_ideas: Array.isArray(payload.selected_ideas) && payload.selected_ideas.length > 0 ? payload.selected_ideas : [],
        user_profile: profileToSend,
        job_id: jobId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to synthesize research');
      }

      // Poll every 5 seconds up to ~1.5 minutes, mirroring generateIdeas
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const intervalMs = 5_000;
      const maxChecks = 35;

      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<{ sections?: Record<string, string>; status?: string }>('get_research_result', {
            job_id: jobId,
            // Use a distinct kind for synthesis; backend will fallback to RESEARCH if unknown
            kind: 'SYNTHESIZE',
          });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const pollData = poll as Record<string, unknown>;
            const nestedData = pollData.data as Record<string, unknown> | undefined;
            const sections = (pollData.sections as Record<string, string>) || (nestedData?.sections as Record<string, string>);
            if (sections) {
              synthPollingInFlight = false;
              return {
                content: sections['1'] || '',
                reasoning: sections['2'] || '',
                hook: sections['3'] || ''
              };
            }
          }
        } catch {
          // ignore transient errors and continue polling
        }
        if (i < maxChecks - 1) await sleep(intervalMs);
      }
      throw new Error('Synthesis polling timed out');
    } catch (error) {
      logger.error('Error synthesizing research', { error });
      throw new Error('Failed to synthesize research');
    } finally {
      synthPollingInFlight = false;
    }
  },

  async applyPostStyle(existingContent: string, style: string): Promise<string> {
    try {
      
      const response = await lambdaApiService.sendLLMRequest('post_style_change', {
        existing_content: existingContent,
        style,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to apply post style');
      }
      const data = (response.data || {}) as Record<string, unknown>;
      // Support either { content } or { data: { content } }
      const nestedData = data.data as Record<string, unknown> | undefined;
      const content = (data.content as string) ?? (nestedData?.content as string);
      if (typeof content === 'string' && content.trim().length > 0) {
        return content;
      }
      // If backend returns full object, attempt common field names
      if (typeof data.result === 'string') return data.result;
      throw new Error('No styled content returned from backend');
    } catch (error) {
      logger.error('Error applying post style', { error });
      throw new Error('Failed to apply post style');
    }
  },
};


