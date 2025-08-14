import { puppeteerApiService } from './puppeteerApiService';
import { lambdaApiService } from './lambdaApiService';

export const postsService = {
  // Profile-backed unsent post storage
  async fetchUserProfile(): Promise<any> {
    const resp = await lambdaApiService.getUserProfile();
    if (!resp.success) throw new Error(resp.error || 'Failed to fetch profile');
    return resp.data;
  },

  async saveUnsentPostToProfile(content: string): Promise<void> {
    const profile = await this.fetchUserProfile();
    const updates = { ...profile, unsent_post_content: content };
    const resp = await lambdaApiService.updateUserProfile(updates);
    if (!resp.success) throw new Error(resp.error || 'Failed to save unsent post');
  },

  async clearUnsentPostFromProfile(): Promise<void> {
    const profile = await this.fetchUserProfile();
    const { unsent_post_content, ...rest } = profile || {};
    const resp = await lambdaApiService.updateUserProfile({ ...rest, unsent_post_content: '' });
    if (!resp.success) throw new Error(resp.error || 'Failed to clear unsent post');
  },

  async publishPost(content: string): Promise<void> {
    const resp = await puppeteerApiService.createLinkedInPost({ content });
    if (!resp.success) throw new Error(resp.error || 'Failed to publish post');
  },

  async generateIdeas(user: unknown): Promise<string> {
    const response = await fetch('/api/posts/generate-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile: user }),
    });
    if (!response.ok) throw new Error('Failed to generate ideas');
    const data = await response.json();
    return data.idea || data.content || '';
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


