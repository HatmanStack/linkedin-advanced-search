import { puppeteerApiService } from '@/shared/services';
import { lambdaApiService } from '@/shared/services';
import { v4 as uuidv4 } from 'uuid';
import type { UserProfile } from '@/shared/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PostsService');

let ideasPollingInFlight = false;
let synthPollingInFlight = false;

interface SectionsMap {
  '1'?: string;
  '2'?: string;
  '3'?: string;
}

interface PollResult {
  success?: boolean;
  status?: string;
  ideas?: string[];
  content?: string;
  sections?: SectionsMap;
  data?: {
    ideas?: string[];
    content?: string;
    sections?: SectionsMap;
  };
}

interface LLMResponseData {
  job_id?: string;
  jobId?: string;
}

function stripSensitiveFields(profile: UserProfile): Partial<UserProfile> {
  const copy = { ...profile };
  delete copy.unpublished_post_content;
  delete copy.linkedin_credentials;
  delete copy.ai_generated_ideas;
  delete copy.ai_generated_research;
  delete copy.ai_generated_post_hook;
  delete copy.ai_generated_post_reasoning;
  return copy;
}

export const postsService = {
  async saveUnsentPostToProfile(content: string): Promise<void> {
    const updates: Partial<UserProfile> = { unpublished_post_content: content };
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to save unsent post');
  },

  async clearUnsentPostFromProfile(): Promise<void> {
    const updates: Partial<UserProfile> = { unpublished_post_content: '' };
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

      const profileToSend = userProfile ? stripSensitiveFields(userProfile) : null;

      const jobId = uuidv4();
      const response = await lambdaApiService.sendLLMRequest('generate_ideas', {
        prompt: prompt || '',
        user_profile: profileToSend,
        job_id: jobId,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to request idea generation');
      }

      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const intervalMs = 5_000;
      const maxChecks = 35;

      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<PollResult>('get_research_result', {
            job_id: jobId,
            kind: 'IDEAS',
          });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const ideas = poll.ideas || poll.data?.ideas;
            if (Array.isArray(ideas) && ideas.length > 0) {
              logger.debug('Ideas generated', { ideas });
              ideasPollingInFlight = false;
              return ideas as string[];
            }
          }
        } catch { /* polling error, retry */ }
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
      const response = await lambdaApiService.sendLLMRequest('research_selected_ideas', {
        selected_ideas: topics,
        user_profile: userProfile ? stripSensitiveFields(userProfile) : null
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to research topics');
      }
      const responseData = response.data as LLMResponseData | undefined;
      const jobId: string | undefined = responseData?.job_id || responseData?.jobId;
      if (!jobId) {
        throw new Error('No job_id returned for research request');
      }

      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const delayMs = 2 * 60_000;
      const intervalMs = 60_000;
      const maxChecks = 30;

      await sleep(delayMs);
      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<PollResult>('get_research_result', {
            job_id: jobId,
            kind: 'RESEARCH', });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const content = poll.content || poll.data?.content;
            if (content && typeof content === 'string' && content.trim().length > 0) {
              return content;
            }
          }
        } catch { /* polling error, retry */ }
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

      const profileToSend = userProfile ? stripSensitiveFields(userProfile) : null;

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

      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
      const intervalMs = 5_000;
      const maxChecks = 35;

      for (let i = 0; i < maxChecks; i++) {
        try {
          const poll = await lambdaApiService.callProfilesOperation<PollResult>('get_research_result', {
            job_id: jobId,
            kind: 'SYNTHESIZE',
          });
          if (poll && (poll.success === true || poll.status === 'ok')) {
            const sections: SectionsMap | undefined = poll.sections || poll.data?.sections;
            if (sections) {
              synthPollingInFlight = false;
              return {
                content: sections['1'] || '',
                reasoning: sections['2'] || '',
                hook: sections['3'] || ''
              };
            }
          }
        } catch { /* polling error, retry */ }
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
      const data = (response.data as { content?: string; data?: { content?: string }; result?: string } | undefined) || {};
      const content = data.content ?? data.data?.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        return content;
      }
      if (typeof data.result === 'string') return data.result;
      throw new Error('No styled content returned from backend');
    } catch (error) {
      logger.error('Error applying post style', { error });
      throw new Error('Failed to apply post style');
    }
  },
};

