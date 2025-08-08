import { CognitoUserPool, CognitoUser, CognitoUserSession } from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/cognito';
import { connectionChangeTracker } from '../utils/connectionChangeTracker';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3001/api';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Connection types
export interface Connection {
  connection_id: string;
  user_id: string;
  linkedin_id?: string;
  first_name: string;
  last_name: string;
  headline?: string;
  profile_url?: string;
  profile_picture_url?: string;
  location?: string;
  company?: string;
  position?: string;
  industry?: string;
  common_interests?: string[];
  recent_activity?: string;
  connection_date?: string;
  message_count: number;
  last_activity_summary?: string;
  connection_status: 'pending' | 'connected' | 'declined' | 'not_connected';
  tags: string[];
  conversation_topics: string[];
  search_metadata?: any;
  engagement_score?: number;
  created_at: string;
  updated_at: string;
  isFakeData?: boolean;
}

// Message types
export interface Message {
  message_id: string;
  user_id: string;
  connection_id: string;
  topic_id?: string;
  message_content: string;
  message_type: 'introduction' | 'follow_up' | 'custom';
  is_sent: boolean;
  sent_at?: string;
  response_received: boolean;
  response_content?: string;
  response_at?: string;
  effectiveness_score?: number;
  created_at: string;
  updated_at: string;
}

// Topic types
export interface Topic {
  topic_id: string;
  user_id: string;
  topic: string;
  description?: string;
  usage_count: number;
  last_used?: string;
  created_at: string;
  updated_at: string;
}

// Draft types
export interface Draft {
  draft_id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  scheduled_at?: string;
  is_published: boolean;
  published_at?: string;
  engagement_metrics?: any;
  created_at: string;
  updated_at: string;
}

// Profile types
export interface UserProfile {
  user_id: string;
  linkedin_id?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  headline?: string;
  profile_url?: string;
  profile_picture_url?: string;
  location?: string;
  summary?: string;
  industry?: string;
  current_position?: string;
  company?: string;
  interests: string[];
  linkedin_credentials?: string; // encrypted
  preferences: any;
  created_at: string;
  updated_at: string;
}

class ApiService {
  private getAuthHeaders(): HeadersInit {
    // Get JWT token from Cognito session
    const token = this.getCognitoToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private getCognitoToken(): string {
    try {
      // Get current Cognito user session
      const userPool = new CognitoUserPool({
        UserPoolId: cognitoConfig.userPoolId,
        ClientId: cognitoConfig.userPoolWebClientId,
      });
      
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) return '';
      
      // This is synchronous for demo purposes - in production you'd want to handle this asynchronously
      let token = '';
      cognitoUser.getSession((err: any, session: CognitoUserSession) => {
        if (err || !session.isValid()) {
          console.warn('No valid Cognito session found');
          return;
        }
        token = session.getIdToken().getJwtToken();
      });
      
      return token;
    } catch (error) {
      console.warn('Error getting Cognito token:', error);
      return '';
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // User Profile Operations
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return this.makeRequest<UserProfile>('/profile');
  }

  async updateUserProfile(profile: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    return this.makeRequest<UserProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  }

  async createUserProfile(profile: Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<UserProfile>> {
    return this.makeRequest<UserProfile>('/profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  // Connection Operations
  async getConnections(filters?: {
    status?: string;
    tags?: string[];
    limit?: number;
    lastKey?: string;
  }): Promise<ApiResponse<{ connections: Connection[]; lastKey?: string }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.lastKey) params.append('lastKey', filters.lastKey);

    const queryString = params.toString();
    return this.makeRequest<{ connections: Connection[]; lastKey?: string }>(
      `/connections${queryString ? `?${queryString}` : ''}`
    );
  }

  async createConnection(connection: Omit<Connection, 'connection_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Connection>> {
    return this.makeRequest<Connection>('/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<ApiResponse<Connection>> {
    return this.makeRequest<Connection>(`/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Message Operations
  async getMessages(filters?: {
    connectionId?: string;
    isSent?: boolean;
    limit?: number;
  }): Promise<ApiResponse<{ messages: Message[] }>> {
    const params = new URLSearchParams();
    if (filters?.connectionId) params.append('connectionId', filters.connectionId);
    if (filters?.isSent !== undefined) params.append('isSent', filters.isSent.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    return this.makeRequest<{ messages: Message[] }>(
      `/messages${queryString ? `?${queryString}` : ''}`
    );
  }

  async createMessage(message: Omit<Message, 'message_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Message>> {
    return this.makeRequest<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Topic Operations
  async getTopics(): Promise<ApiResponse<Topic[]>> {
    return this.makeRequest<Topic[]>('/topics');
  }

  async createTopic(topic: Omit<Topic, 'topic_id' | 'user_id' | 'usage_count' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Topic>> {
    return this.makeRequest<Topic>('/topics', {
      method: 'POST',
      body: JSON.stringify(topic),
    });
  }

  // Draft Operations
  async getDrafts(): Promise<ApiResponse<Draft[]>> {
    return this.makeRequest<Draft[]>('/drafts');
  }

  async createDraft(draft: Omit<Draft, 'draft_id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Draft>> {
    return this.makeRequest<Draft>('/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  // LinkedIn Integration
  async performLinkedInSearch(criteria: any): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/linkedin/search', {
      method: 'POST',
      body: JSON.stringify(criteria),
    });
  }

  async generateMessage(connectionId: string, topicId?: string): Promise<ApiResponse<{ message: string }>> {
    return this.makeRequest<{ message: string }>('/ai/generate-message', {
      method: 'POST',
      body: JSON.stringify({ connectionId, topicId }),
    });
  }

  // LinkedIn Interactions
  async sendLinkedInMessage(params: {
    recipientProfileId: string;
    messageContent: string;
    recipientName?: string;
  }): Promise<ApiResponse<{ messageId: string; deliveryStatus: string }>> {
    const response = await this.makeRequest<{ messageId: string; deliveryStatus: string }>(
      '/linkedin-interactions/send-message',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    if (response.success) {
      // Mark that DynamoDB edges/messages changed
      connectionChangeTracker.markChanged('interaction');
    }

    return response;
  }

  async addLinkedInConnection(params: {
    profileId: string;
    connectionMessage?: string;
    profileName?: string;
  }): Promise<ApiResponse<{ connectionRequestId: string; status: string }>> {
    const response = await this.makeRequest<{ connectionRequestId: string; status: string }>(
      '/linkedin-interactions/add-connection',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    if (response.success) {
      connectionChangeTracker.markChanged('interaction');
    }

    return response;
  }

  async createLinkedInPost(params: {
    content: string;
    mediaAttachments?: Array<{ type: 'image' | 'video' | 'document'; url: string; filename: string }>;
  }): Promise<ApiResponse<{ postId: string; postUrl: string; publishStatus: string }>> {
    const response = await this.makeRequest<{ postId: string; postUrl: string; publishStatus: string }>(
      '/linkedin-interactions/create-post',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );

    if (response.success) {
      connectionChangeTracker.markChanged('interaction');
    }

    return response;
  }

  // Heal and Restore Operations
  async authorizeHealAndRestore(sessionId: string, autoApprove: boolean = false): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/heal-restore/authorize', {
      method: 'POST',
      body: JSON.stringify({ sessionId, autoApprove }),
    });
  }

  async checkHealAndRestoreStatus(): Promise<ApiResponse<{ pendingSession?: { sessionId: string; timestamp: number } }>> {
    return this.makeRequest<{ pendingSession?: { sessionId: string; timestamp: number } }>('/heal-restore/status');
  }

  // Profile Initialization Operations
  async initializeProfileDatabase(credentials: {
    searchName: string;
    searchPassword: string;
  }): Promise<ApiResponse<{ success?: boolean; healing?: boolean; message?: string }>> {
    return this.makeRequest<{ success?: boolean; healing?: boolean; message?: string }>('/profile-init', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
