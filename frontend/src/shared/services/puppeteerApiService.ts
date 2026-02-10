import { CognitoUserPool, CognitoUserSession } from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/appConfig';
import type { SearchFormData } from '@/shared/utils/validation';
import type { PuppeteerApiResponse, Connection, Message } from '@/shared/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PuppeteerApiService');

// API Configuration
// This service calls the local puppeteer backend for LinkedIn automation
// Note: Backend routes are rooted at '/', e.g., '/search', so do NOT append '/api' here.
const PUPPETEER_BACKEND_URL =
  import.meta.env.VITE_PUPPETEER_BACKEND_URL ||
  import.meta.env.VITE_API_GATEWAY_URL || // fallback for legacy env var usage
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
      Authorization: `Bearer ${token}`,
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
        cognitoUser.getSession((err: Error | null, session: CognitoUserSession) => {
          if (err || !session.isValid()) {
            logger.warn('No valid Cognito session found');
            resolve('');
            return;
          }
          resolve(session.getIdToken().getJwtToken());
        });
      });
    } catch (error) {
      logger.warn('Error getting Cognito token', { error });
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

      logger.debug('Making request', {
        endpoint,
        shouldAttach,
        method: options.method || 'GET',
      });

      if (shouldAttach) {
        let ciphertextTag = null as string | null;

        // Profile fetch from DynamoDB is async on session start; wait briefly for it
        const maxWaitMs = 5000;
        const pollIntervalMs = 200;
        const deadline = Date.now() + maxWaitMs;

        while (!ciphertextTag && Date.now() < deadline) {
          try {
            const fromSession = sessionStorage.getItem('li_credentials_ciphertext');
            ciphertextTag =
              fromSession && fromSession.startsWith('sealbox_x25519:b64:') ? fromSession : null;
          } catch (e) {
            logger.error('Error reading sessionStorage', { error: e });
            break;
          }
          if (!ciphertextTag) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          }
        }

        logger.debug('Credentials check', {
          hasCredentials: !!ciphertextTag,
          length: ciphertextTag ? ciphertextTag.length : 0,
        });

        if (!ciphertextTag) {
          logger.error('No valid credentials found after waiting, aborting request');
          return {
            success: false,
            error:
              'LinkedIn credentials are missing. Please add your encrypted LinkedIn credentials on the Profile page first.',
          };
        }

        const original = options.body ? JSON.parse(options.body as string) : {};
        augmentedBody = JSON.stringify({
          ...original,
          linkedinCredentialsCiphertext: ciphertextTag,
        });
        if (import.meta.env.DEV) {
          logger.debug('Credentials attached', {
            bodyKeys: Object.keys(JSON.parse(augmentedBody)),
          });
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
        let parsedError: Record<string, unknown> | null = null;
        try {
          parsedError =
            textBody && contentType.includes('application/json') ? JSON.parse(textBody) : null;
        } catch {
          // Ignore JSON parse errors
        }
        return {
          success: false,
          error:
            (parsedError && ((parsedError.error as string) || (parsedError.message as string))) ||
            textBody ||
            `HTTP ${response.status}`,
        };
      }

      // OK responses: allow empty body or non-JSON bodies
      if (!textBody) {
        return { success: true } as PuppeteerApiResponse<T>;
      }

      let parsed: Record<string, unknown> | string = textBody;
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
        data: typeof parsed === 'object' && parsed.data ? parsed.data : parsed,
        message: typeof parsed === 'object' ? (parsed.message as string) : undefined,
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
  }): Promise<PuppeteerApiResponse<{ connections: Connection[]; lastKey?: string }>> {
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

  async createConnection(
    connection: Partial<Connection>
  ): Promise<PuppeteerApiResponse<Connection>> {
    return this.makeRequest<Connection>('/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(
    connectionId: string,
    updates: Partial<Connection>
  ): Promise<PuppeteerApiResponse<Connection>> {
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
  }): Promise<PuppeteerApiResponse<{ messages: Message[] }>> {
    const params = new URLSearchParams();
    if (filters?.connectionId) params.append('connectionId', filters.connectionId);
    if (filters?.isSent !== undefined) params.append('isSent', filters.isSent.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    return this.makeRequest<{ messages: Message[] }>(
      `/messages${queryString ? `?${queryString}` : ''}`
    );
  }

  async createMessage(message: Partial<Message>): Promise<PuppeteerApiResponse<Message>> {
    return this.makeRequest<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Topic Operations
  async getTopics(): Promise<PuppeteerApiResponse<Record<string, unknown>[]>> {
    return this.makeRequest<Record<string, unknown>[]>('/topics');
  }

  async createTopic(
    topic: Record<string, unknown>
  ): Promise<PuppeteerApiResponse<Record<string, unknown>>> {
    return this.makeRequest<Record<string, unknown>>('/topics', {
      method: 'POST',
      body: JSON.stringify(topic),
    });
  }

  // Draft Operations
  async getDrafts(): Promise<PuppeteerApiResponse<Record<string, unknown>[]>> {
    return this.makeRequest<Record<string, unknown>[]>('/drafts');
  }

  async createDraft(
    draft: Record<string, unknown>
  ): Promise<PuppeteerApiResponse<Record<string, unknown>>> {
    return this.makeRequest<Record<string, unknown>>('/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  // LinkedIn Integration
  async performLinkedInSearch(
    criteria: SearchFormData
  ): Promise<PuppeteerApiResponse<{ results: Connection[] }>> {
    return this.makeRequest<{ results: Connection[] }>('/search', {
      method: 'POST',
      body: JSON.stringify(criteria),
    });
  }

  async generateMessage(
    connectionId: string,
    topicId?: string
  ): Promise<PuppeteerApiResponse<{ message: string }>> {
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

    return response;
  }

  async createLinkedInPost(params: {
    content: string;
    mediaAttachments?: Array<{
      type: 'image' | 'video' | 'document';
      url: string;
      filename: string;
    }>;
  }): Promise<PuppeteerApiResponse<{ postId: string; postUrl: string; publishStatus: string }>> {
    const response = await this.makeRequest<{
      postId: string;
      postUrl: string;
      publishStatus: string;
    }>('/linkedin-interactions/create-post', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    return response;
  }

  // Heal and Restore Operations
  async authorizeHealAndRestore(
    sessionId: string,
    autoApprove: boolean = false
  ): Promise<PuppeteerApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/heal-restore/authorize', {
      method: 'POST',
      body: JSON.stringify({ sessionId, autoApprove }),
    });
  }

  async checkHealAndRestoreStatus(): Promise<
    PuppeteerApiResponse<{ pendingSession?: { sessionId: string; timestamp: number } }>
  > {
    return this.makeRequest<{ pendingSession?: { sessionId: string; timestamp: number } }>(
      '/heal-restore/status'
    );
  }

  async cancelHealAndRestore(
    sessionId: string
  ): Promise<PuppeteerApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>('/heal-restore/cancel', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  // Profile Initialization Operations
  async initializeProfileDatabase(credentials?: {
    searchName?: string;
    searchPassword?: string;
  }): Promise<PuppeteerApiResponse<{ success?: boolean; healing?: boolean; message?: string }>> {
    return this.makeRequest<{ success?: boolean; healing?: boolean; message?: string }>(
      '/profile-init',
      {
        method: 'POST',
        body: JSON.stringify(credentials || {}),
      }
    );
  }

  // LinkedIn Search Operations
  async searchLinkedIn(searchData: SearchFormData): Promise<unknown> {
    const response = await this.makeRequest<unknown>('/search', {
      method: 'POST',
      body: JSON.stringify(searchData),
    });
    return response;
  }
}

export const puppeteerApiService = new PuppeteerApiService();
export default puppeteerApiService;
