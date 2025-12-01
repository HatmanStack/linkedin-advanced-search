import { CognitoUserPool, CognitoUserSession } from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/appConfig';
import { connectionChangeTracker } from '@/features/connections';
import type { SearchFormData } from '@/shared/utils/validation';
import type {
  PuppeteerApiResponse
} from '@/shared/types';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PuppeteerApiService');

const PUPPETEER_BACKEND_URL =
  (import.meta.env as ImportMetaEnv).VITE_PUPPETEER_BACKEND_URL ||
  (import.meta.env as ImportMetaEnv).VITE_API_GATEWAY_URL ||
  'http://localhost:3001';


class PuppeteerApiService {

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getCognitoToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private async getCognitoToken(): Promise<string> {
    try {
      const userPool = new CognitoUserPool({
        UserPoolId: cognitoConfig.userPoolId,
        ClientId: cognitoConfig.userPoolWebClientId,
      });

      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) return '';

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
      let augmentedBody = options.body;
      const shouldAttach =
        endpoint.startsWith('/linkedin') ||
        endpoint.startsWith('/linkedin-interactions') ||
        endpoint.startsWith('/profile-init') ||
        endpoint.startsWith('/search');

      logger.debug('Making request', {
        endpoint,
        shouldAttach,
        method: options.method || 'GET'
      });

      if (shouldAttach) {
        let ciphertextTag = null as string | null;
        try {
          const fromSession = sessionStorage.getItem('li_credentials_ciphertext');
          ciphertextTag = (fromSession && fromSession.startsWith('sealbox_x25519:b64:')) ? fromSession : null;
          logger.debug('Credentials check', {
            hasSessionStorage: !!fromSession,
            hasValidPrefix: ciphertextTag ? true : false,
            length: fromSession ? fromSession.length : 0
          });
        } catch (e) {
          logger.error('Error reading sessionStorage', { error: e });
        }

        if (!ciphertextTag) {
          logger.error('No valid credentials found, aborting request');
          return {
            success: false,
            error: 'LinkedIn credentials are missing. Please add your encrypted LinkedIn credentials on the Profile page first.',
          };
        }

        const original = options.body ? JSON.parse(options.body as string) : {};
        augmentedBody = JSON.stringify({ ...original, linkedinCredentialsCiphertext: ciphertextTag });
        if (import.meta.env.DEV) {
          logger.debug('Credentials attached', { bodyKeys: Object.keys(JSON.parse(augmentedBody)) });
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

      const contentType = response.headers.get('content-type') || '';
      const textBody = await response.text();

      if (!response.ok) {
        let parsedError: { error?: string; message?: string } | null = null;
        try {
          parsedError = textBody && contentType.includes('application/json') ? JSON.parse(textBody) : null;
        } catch { /* parse error, use raw text */ }
        return {
          success: false,
          error: (parsedError && (parsedError.error || parsedError.message)) || (textBody || `HTTP ${response.status}`),
        };
      }

      if (!textBody) {
        return { success: true } as PuppeteerApiResponse<T>;
      }

      let parsed: { data?: T; message?: string } | string = textBody;
      if (contentType.includes('application/json')) {
        try {
          parsed = JSON.parse(textBody);
        } catch {
          parsed = textBody;
        }
      }

      const parsedObj = typeof parsed === 'object' ? parsed : null;
      return {
        success: true,
        data: (parsedObj && parsedObj.data) ? parsedObj.data : parsed as T,
        message: parsedObj?.message,
      } as PuppeteerApiResponse<T>;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }


  async getConnections(filters?: {
    status?: string;
    tags?: string[];
    limit?: number;
    lastKey?: string;
  }): Promise<PuppeteerApiResponse<{ connections: unknown[]; lastKey?: string }>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tags) params.append('tags', filters.tags.join(','));
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.lastKey) params.append('lastKey', filters.lastKey);

    const queryString = params.toString();
    return this.makeRequest<{ connections: unknown[]; lastKey?: string }>(
      `/connections${queryString ? `?${queryString}` : ''}`
    );
  }

  async createConnection(connection: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>('/connections', {
      method: 'POST',
      body: JSON.stringify(connection),
    });
  }

  async updateConnection(connectionId: string, updates: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>(`/connections/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getMessages(filters?: {
    connectionId?: string;
    isSent?: boolean;
    limit?: number;
  }): Promise<PuppeteerApiResponse<{ messages: unknown[] }>> {
    const params = new URLSearchParams();
    if (filters?.connectionId) params.append('connectionId', filters.connectionId);
    if (filters?.isSent !== undefined) params.append('isSent', filters.isSent.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    return this.makeRequest<{ messages: unknown[] }>(
      `/messages${queryString ? `?${queryString}` : ''}`
    );
  }

  async createMessage(message: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  async getTopics(): Promise<PuppeteerApiResponse<unknown[]>> {
    return this.makeRequest<unknown[]>('/topics');
  }

  async createTopic(topic: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>('/topics', {
      method: 'POST',
      body: JSON.stringify(topic),
    });
  }

  async getDrafts(): Promise<PuppeteerApiResponse<unknown[]>> {
    return this.makeRequest<unknown[]>('/drafts');
  }

  async createDraft(draft: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>('/drafts', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
  }

  async performLinkedInSearch(criteria: unknown): Promise<PuppeteerApiResponse<unknown>> {
    return this.makeRequest<unknown>('/search', {
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

  async initializeProfileDatabase(credentials?: Record<string, unknown>): Promise<PuppeteerApiResponse<{ success?: boolean; healing?: boolean; message?: string }>> {
    return this.makeRequest<{ success?: boolean; healing?: boolean; message?: string }>('/profile-init', {
      method: 'POST',
      body: JSON.stringify(credentials || {}),
    });
  }

  async searchLinkedIn(searchData: SearchFormData): Promise<unknown> {
    const response = await this.makeRequest<unknown>(
      '/search',
      {
        method: 'POST',
        body: JSON.stringify(searchData),
      }
    );
    return response;
  }
}

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
