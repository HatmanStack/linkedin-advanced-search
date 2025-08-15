import { puppeteerApiService } from './puppeteerApiService';
import { lambdaApiService } from './lambdaApiService';
import type { UserProfile } from '../contexts/UserProfileContext';

export const postsService = {
  async saveUnsentPostToProfile(content: string, userProfile: UserProfile): Promise<void> {
    const updates = { ...userProfile, unsent_post_content: content };
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to save unsent post');
  },

  async clearUnsentPostFromProfile(userProfile: UserProfile): Promise<void> {
    const { unsent_post_content, ...rest } = userProfile || {};
    const resp = await lambdaApiService.updateUserProfile({ ...rest, unsent_post_content: '' });
    if (!resp.success) throw new Error(resp.error || 'Failed to clear unsent post');
  },

  async publishPost(content: string): Promise<void> {
    const resp = await puppeteerApiService.createLinkedInPost({ content });
    if (!resp.success) throw new Error('Failed to publish post');
  },

  async generateIdeas(prompt?: string, userProfile?: UserProfile): Promise<string[]> {
    try {
      const response = await lambdaApiService.sendLLMRequest('generate_ideas', {
        prompt: prompt || '',
        user_profile: userProfile || null
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

  async researchSelectedIdeas(selectedIdeas: string[]): Promise<string> {
    try {
      const response = await lambdaApiService.sendLLMRequest('research_selected_ideas', {
        selected_ideas: selectedIdeas
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to research selected ideas');
      }
      
      return response.data?.research_content || 'No research content available.';
    } catch (error) {
      console.error('Error researching selected ideas:', error);
      throw new Error('Failed to research selected ideas');
    }
  },

  async researchTopics(query: string): Promise<string | null> {
    const response = await fetch('/api/mcp/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error('Failed to research topics');
    const data = await response.json();
    return data.post || null;
  },
};


