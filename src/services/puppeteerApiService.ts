import { CognitoUserPool, CognitoUserSession } from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/appConfig';
import { connectionChangeTracker } from '@/utils/connectionChangeTracker';
import type { SearchFormData } from '@/utils/validation';
import type {
  PuppeteerApiResponse
} from '@/types';

// API Configuration
// This service calls the local puppeteer backend for LinkedIn automation
// Note: Backend routes are rooted at '/', e.g., '/search', so do NOT append '/api' here.
const PUPPETEER_BACKEND_URL =
  (import.meta.env as any).VITE_PUPPETEER_BACKEND_URL ||
  (import.meta.env as any).VITE_API_GATEWAY_URL || // fallback for legacy env var usage
  'http://localhost:3001';

// This service handles raw API calls to the puppeteer backend
// No specific types needed - we use generic types and let the backend handle the data structure

// Service for interacting with the local puppeteer backend that handles LinkedIn automation
class PuppeteerApiService {

  private async getAuthHeaders(): Promise<HeadersInit> {
    // Get JWT token from Cognito session
    const token = await this.getCognitoToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async getCognitoToken(): Promise<string> {
    try {
      // Get current Cognito user session
      const userPool = new CognitoUserPool({
        UserPoolId: cognitoConfig.userPoolId,
        ClientId: cognitoConfig.userPoolWebClientId,
      });

      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) return '';

      // Properly handle async getSession
      return new Promise<string>((resolve) => {
        cognitoUser.getSession((err: any, session: CognitoUserSession) => {
          if (err || !session.isValid()) {
            console.warn('No valid Cognito session found');
            resolve('');
            return;
          }
          resolve(session.getIdToken().getJwtToken());
        });
      });
    } catch (error) {
      console.warn('Error getting Cognito token:', error);
      return '';
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<PuppeteerApiResponse<T>> {
    try {
      // Attach ciphertext credentials for sensitive endpoints; rely on UserProfileContext to have stored them
      let augmentedBody = options.body;
      const shouldAttach =
        endpoint.startsWith('/linkedin') ||
        endpoint.startsWith('/linkedin-interactions') ||
        endpoint.startsWith('/profile-init') ||
        endpoint.startsWith('/search');

      console.log('[puppeteerApiService] Making request:', {
        endpoint,
        shouldAttach,
        method: options.method || 'GET'
      });

      if (shouldAttach) {
        let ciphertextTag = null as string | null;
        try {
          const fromSession = sessionStorage.getItem('li_credentials_ciphertext');
          ciphertextTag = (fromSession && fromSession.startsWith('sealbox_x25519:b64:')) ? fromSession : null;
          console.log('[puppeteerApiService] Credentials check:', {
            hasSessionStorage: !!fromSession,
            hasValidPrefix: ciphertextTag ? true : false,
            length: fromSession ? fromSession.length : 0
          });
        } catch (e) {
          console.error('[puppeteerApiService] Error reading sessionStorage:', e);
        }

        if (!ciphertextTag) {
          console.error('[puppeteerApiService] No valid credentials found, aborting request');
          return {
            success: false,
            error: 'LinkedIn credentials are missing. Please add your encrypted LinkedIn credentials on the Profile page first.',
          };
        }

        const original = options.body ? JSON.parse(options.body as string) : {};
        augmentedBody = JSON.stringify({ ...original, linkedinCredentialsCiphertext: ciphertextTag });
        if (import.meta.env.DEV) {
          console.log('[puppeteerApiService] Credentials attached, request body keys:', Object.keys(JSON.parse(augmentedBody)));
        }
      }

      const response = await fetch(`${PUPPETEER_BACKEND_URL}${endpoint}`, {
        ...options,
        headers: {
          ...(await this.getAuthHeaders()),
          ...options.headers,
        },
        body: augmentedBody,
      });

      // Gracefully handle empty/204 responses (no body)
      const contentType = response.headers.get('content-type') || '';
      const textBody = await response.text();

      // Non-OK still try to surface server message if any
      if (!response.ok) {
        let parsedError: any = null;
        try {
          parsedError = textBody && contentType.includes('application/json') ? JSON.parse(textBody) : null;
        } catch { }
        return {
          success: false,
          error: (parsedError && (parsedError.error || parsedError.message)) || (textBody || `HTTP ${response.status}`),
        };
      }

      // OK responses: allow empty body or non-JSON bodies
      if (!textBody) {
        return { success: true } as PuppeteerApiResponse<T>;
      }

      let parsed: any = textBody;
      if (contentType.includes('application/json')) {
        try {
          parsed = JSON.parse(textBody);
        } catch {
          // If JSON parse fails, fall back to raw text
          parsed = textBody;
        }
      }

      return {
        success: true,
        data: (parsed && parsed.data) ? parsed.data : parsed,
        message: parsed?.message,
      } as PuppeteerApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // User Profile Operations removed - these were conflicting with API Gateway /profile endpoints
  // Profile management should be handled through lambdaApiService instead

  // Connection Operations
  async getConnections(filters?: {
    status?: string;
    tags?: string[];
    limit?: number;
    lastKey?: string;
  }): Promise<PuppeteerApiResponse<{ connections: any[]; lastKey?: string }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.lastKey) params.append('lastKey', filters.lastKey);

    const queryString = params.toString();
    return this.makeRequest<{ connections: any[]; lastKey?: string }>(
      `/connections${queryString ? `?${queryString}` : ''}`
    );
  }

  async createConnection(connection: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>('/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(connectionId: string, updates: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>(`/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Message Operations
  async getMessages(filters?: {
    connectionId?: string;
    isSent?: boolean;
    limit?: number;
  }): Promise<PuppeteerApiResponse<{ messages: any[] }>> {
    const params = new URLSearchParams();
    if (filters?.connectionId) params.append('connectionId', filters.connectionId);
    if (filters?.isSent !== undefined) params.append('isSent', filters.isSent.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    return this.makeRequest<{ messages: any[] }>(
      `/messages${queryString ? `?${queryString}` : ''}`
    );
  }

  async createMessage(message: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Topic Operations
  async getTopics(): Promise<PuppeteerApiResponse<any[]>> {
    return this.makeRequest<any[]>('/topics');
  }

  async createTopic(topic: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>('/topics', {
      method: 'POST',
      body: JSON.stringify(topic),
    });
  }

  // Draft Operations
  async getDrafts(): Promise<PuppeteerApiResponse<any[]>> {
    return this.makeRequest<any[]>('/drafts');
  }

  async createDraft(draft: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>('/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  // LinkedIn Integration
  async performLinkedInSearch(criteria: any): Promise<PuppeteerApiResponse<any>> {
    return this.makeRequest<any>('/search', {
      method: 'POST',
      body: JSON.stringify(criteria),
    });
  }

  async generateMessage(connectionId: string, topicId?: string): Promise<PuppeteerApiResponse<{ message: string }>> {
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
  }): Promise<PuppeteerApiResponse<{ messageId: string; deliveryStatus: string }>> {
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
  }): Promise<PuppeteerApiResponse<{ connectionRequestId: string; status: string }>> {
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
  }): Promise<PuppeteerApiResponse<{ postId: string; postUrl: string; publishStatus: string }>> {
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
  async authorizeHealAndRestore(sessionId: string, autoApprove: boolean = false): Promise<PuppeteerApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/heal-restore/authorize', {
      method: 'POST',
      body: JSON.stringify({ sessionId, autoApprove }),
    });
  }

  async checkHealAndRestoreStatus(): Promise<PuppeteerApiResponse<{ pendingSession?: { sessionId: string; timestamp: number } }>> {
    return this.makeRequest<{ pendingSession?: { sessionId: string; timestamp: number } }>('/heal-restore/status');
  }

  async cancelHealAndRestore(sessionId: string): Promise<PuppeteerApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/heal-restore/cancel', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  // Profile Initialization Operations
  async initializeProfileDatabase(credentials: {
    searchName: string;
    searchPassword: string;
  }): Promise<PuppeteerApiResponse<{ success?: boolean; healing?: boolean; message?: string }>> {
    return this.makeRequest<{ success?: boolean; healing?: boolean; message?: string }>('/profile-init', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  // LinkedIn Search Operations
  async searchLinkedIn(searchData: SearchFormData): Promise<any> {
    const response = await this.makeRequest<any>(
      '/search',
      {
        method: 'POST',
        body: JSON.stringify(searchData),
      }
    );
    return response;
  }
}

// Custom error class
export class ApiError extends Error {
  status?: number;

  constructor({ message, status }: { message: string; status?: number }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const puppeteerApiService = new PuppeteerApiService();
export default puppeteerApiService;
