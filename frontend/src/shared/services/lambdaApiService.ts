import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';
import { CognitoAuthService } from '@/features/auth';
import { logError } from '@/shared/utils/errorHandling';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('LambdaApiService');
import type {
  Connection,
  Message,
  ConnectionStatus,
  ApiErrorInfo,
} from '../types';
import {
  validateConnection,
  validateMessage,
  sanitizeConnectionData,
  sanitizeMessageData,
} from '@/shared/types/validators';
import { isConnection, isMessage } from '@/shared/types/guards';

export class ApiError extends Error {
  status?: number;
  code?: string;
  retryable?: boolean;
  timestamp: string;

  constructor({ message, status, code }: ApiErrorInfo) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.retryable = this.isRetryableError(status, code);
  }

  private isRetryableError(status?: number, code?: string): boolean {
    if (!status && (code === 'NETWORK_ERROR' || code === 'ERR_NETWORK' || code === 'ECONNABORTED')) {
      return true;
    }
    if (status && status >= 500) {
      return true;
    }
    if (status === 429) {
      return true;
    }
    if (code === 'ECONNABORTED' || code === 'TIMEOUT') {
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
}

class LambdaApiService {
  protected apiClient: AxiosInstance;
  // @ts-expect-error - Reserved for future authentication enhancement
  private authToken: string | null = null;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000;

  constructor() {
    const apiBaseUrl =
      (import.meta.env as ImportMetaEnv).VITE_API_GATEWAY_URL ||  '';

    if (!apiBaseUrl) {
      logger.warn(
        'No API base URL configured. Set VITE_API_GATEWAY_URL (preferred) or VITE_API_GATEWAY_BASE_URL to avoid defaulting to the current origin (e.g., localhost during dev).'
      );
    }

    const normalizedBaseUrl = apiBaseUrl
      ? (apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`)
      : undefined;

    this.apiClient = axios.create({
      baseURL: normalizedBaseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.apiClient.interceptors.request.use(
      async (config) => {
        const token = await this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(this.transformError(error));
      }
    );

    this.apiClient.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        return Promise.reject(this.transformError(error));
      }
    );
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const token = await CognitoAuthService.getCurrentUserToken();
      if (token) {
        this.authToken = token;
        return token;
      }
      return null;
    } catch (error) {
      logger.error('Error getting auth token', { error });
      return null;
    }
  }

  public clearAuthToken(): void {
    this.authToken = null;
  }

  private transformError(error: AxiosError): ApiError {
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data as { message?: string; error?: string } | undefined;
      const message = responseData?.message ||
                     responseData?.error ||
                     `HTTP ${status} error`;

      return new ApiError({
        message,
        status,
        code: error.code,
      });
    } else if (error.request) {
      return new ApiError({
        message: 'Network error - unable to reach server',
        code: error.code,
      });
    } else {
      return new ApiError({
        message: error.message || 'An unexpected error occurred',
        code: error.code,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoffDelay(attempt: number): number {
    return this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  private async makeRequest<T>(endpoint: string, operation: string, params: Record<string, unknown> = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.apiClient.post<ApiResponse<T>>(endpoint, {
          operation,
          ...params,
        });

        const responseData = response.data;

        if (responseData && typeof responseData === 'object' && 'statusCode' in responseData) {
          const lambdaResponse = responseData;

          if (lambdaResponse.statusCode !== 200) {
            const errorBody = typeof lambdaResponse.body === 'string'
              ? JSON.parse(lambdaResponse.body)
              : lambdaResponse.body;
            const error = new ApiError({
              message: errorBody?.error || `Lambda returned status ${lambdaResponse.statusCode}`,
              status: lambdaResponse.statusCode,
            });

            if (lambdaResponse.statusCode >= 400 && lambdaResponse.statusCode < 500) {
              throw error;
            }

            throw error;
          }

          const parsedBody = typeof lambdaResponse.body === 'string'
            ? JSON.parse(lambdaResponse.body)
            : lambdaResponse.body;

          return parsedBody;
        } else {
          return responseData;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred during API request');

        const apiError = error instanceof ApiError ? error : this.transformError(error as AxiosError);

        if (!apiError.retryable || attempt === this.maxRetries) {
          logger.error(`API request failed after ${attempt} attempts`, {
            endpoint,
            operation,
            error: apiError.toJSON(),
            params: Object.keys(params)
          });
          throw apiError;
        }

        const delay = this.calculateBackoffDelay(attempt);
        logger.warn(`API request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms`, {
          endpoint,
          operation,
          error: apiError.message,
          nextRetryIn: delay
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  async getConnectionsByStatus(status?: ConnectionStatus): Promise<Connection[]> {
    const context = `fetch connections${status ? ` with status ${status}` : ''}`;

    try {
      const response = await this.makeRequest<{
        connections: Connection[];
        count: number;
      }>('edge', 'get_connections_by_status', { updates: status ? { status } : {} });

      const connections = this.formatConnectionsResponse(response.connections || []);

      logger.info(`Successfully fetched ${connections.length} connections${status ? ` with status ${status}` : ''}`);

      return connections;
    } catch (error) {
      logError(error, context, { status, operation: 'get_connections_by_status' });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to fetch connections',
        status: 500,
      });
    }
  }

  async updateConnectionStatus(
    connectionId: string,
    newStatus: ConnectionStatus | 'processed',
    options?: { profileId?: string }
  ): Promise<void> {
    const context = `update connection status to ${newStatus}`;

    try {
      if (!connectionId || typeof connectionId !== 'string') {
        throw new ApiError({
          message: 'Connection ID is required and must be a valid string',
          status: 400,
        });
      }

      if (!newStatus || typeof newStatus !== 'string') {
        throw new ApiError({
          message: 'New status is required and must be a valid string',
          status: 400,
        });
      }

      const validStatuses = ['possible', 'incoming', 'outgoing', 'ally', 'processed'];
      if (!validStatuses.includes(newStatus)) {
        throw new ApiError({
          message: `Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(', ')}`,
          status: 400,
        });
      }

      await this.makeRequest<{ success: boolean; updated: Record<string, unknown> }>('edge', 'update_metadata', {
        profileId: options?.profileId ?? connectionId,
        updates: {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        },
      });

      logger.info(`Successfully updated connection ${connectionId} status to ${newStatus}`);
    } catch (error) {
      logError(error, context, {
        connectionId,
        newStatus,
        operation: 'update_metadata'
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to update connection status',
        status: 500,
      });
    }
  }

  async getMessageHistory(connectionId: string): Promise<Message[]> {
    const context = 'fetch message history';

    try {
      if (!connectionId || typeof connectionId !== 'string') {
        throw new ApiError({
          message: 'Connection ID is required and must be a valid string',
          status: 400,
        });
      }

      const response = await this.makeRequest<{
        messages: Message[];
        count: number;
      }>('edge', 'get_messages', {
        profileId: connectionId,
      });

      const messages = this.formatMessagesResponse(response.messages || []);

      logger.info(`Successfully fetched ${messages.length} messages for connection ${connectionId}`);

      return messages;
    } catch (error) {
      logError(error, context, {
        connectionId,
        operation: 'get_messages'
      });

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to fetch message history',
        status: 500,
      });
    }
  }

  private formatConnectionsResponse(connections: unknown[]): Connection[] {
    if (!Array.isArray(connections)) {
      logger.warn('Invalid connections data received, expected array', { connections });
      return [];
    }

    return connections
      .map((conn, index) => {
        try {
          const validationResult = validateConnection(conn, { sanitize: false });

          if (validationResult.isValid && isConnection(conn)) {
            return conn as Connection;
          }

          const sanitized = sanitizeConnectionData(conn);

          if (sanitized && isConnection(sanitized)) {
            return sanitized;
          }

          logger.error(`Unable to sanitize connection data at index ${index}`, { conn });
          return null;
        } catch (error) {
          logError(error, 'format connection data', { connection: conn, index });

          const fallback = sanitizeConnectionData(conn);
          if (fallback && isConnection(fallback)) {
            return fallback;
          }

          return null;
        }
      })
      .filter((conn): conn is Connection => conn !== null);
  }

  private formatMessagesResponse(messages: unknown[]): Message[] {
    if (!Array.isArray(messages)) {
      logger.warn('Invalid messages data received, expected array', { messages });
      return [];
    }

    return messages
      .map((msg, index) => {
        try {
          const validationResult = validateMessage(msg, { sanitize: false });

          if (validationResult.isValid && isMessage(msg)) {
            return msg as Message;
          }

          logger.warn(`Invalid message data at index ${index}`, { errors: validationResult.errors });
          const sanitized = sanitizeMessageData(msg);

          if (sanitized && isMessage(sanitized)) {
            logger.debug(`Successfully sanitized message data at index ${index}`);
            return sanitized;
          }

          logger.error(`Unable to sanitize message data at index ${index}`, { msg });
          return null;
        } catch (error) {
          logger.warn('Error formatting message', { error, msg });

          const fallback = sanitizeMessageData(msg);
          if (fallback && isMessage(fallback)) {
            return fallback;
          }

          return null;
        }
      })
      .filter((msg): msg is Message => msg !== null);
  }

  private async makeLLMRequest<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.makeRequest<T>('llm', operation, params);
  }

  async sendLLMRequest(operation: string, params: Record<string, unknown> = {}): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await this.makeLLMRequest<unknown>(operation, params);
      logger.debug('LLM response received', { hasResponse: !!response });
      return { success: true, data: response };
    } catch (error) {
      logger.error('LLM request failed', { error });

      if (error instanceof ApiError) {
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Failed to execute LLM operation' };
    }
  }
}

import type { UserProfile } from '@/shared/types';

interface SearchResponse {
  success: boolean;
  message?: string;
  results: unknown[];
  total: number;
  metadata?: {
    search_id: string;
    status: string;
    userId: string;
  };
}

class ExtendedLambdaApiService extends LambdaApiService {
  async getUserProfile(): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
      logger.debug('Fetching user profile (GET /profiles)');
      const response = await this.apiClient.get('profiles');

      const data = (response.data?.data ?? response.data) as UserProfile;

      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Failed to fetch profile';
      return { success: false, error: message };
    }
  }

  async updateUserProfile(profile: Partial<UserProfile>): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
      logger.debug('Updating profile (POST /profiles)', { profileKeys: Object.keys(profile) });
      const response = await this.apiClient.post('profiles', {
        operation: 'update_user_settings',
        ...profile,
      });
      const data = (response.data?.data ?? response.data) as UserProfile;
      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Failed to update profile';
      return { success: false, error: message };
    }
  }

  async createUserProfile(profile: Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
      const response = await this.apiClient.post('profiles', {
        operation: 'update_user_settings',
        ...profile,
      });
      const data = (response.data?.data ?? response.data) as UserProfile;
      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<{ error?: string }>;
      const message = err.response?.data?.error || err.message || 'Failed to create profile';
      return { success: false, error: message };
    }
  }

  async callProfilesOperation<T = unknown>(operation: string, params: Record<string, unknown> = {}): Promise<{ success?: boolean; status?: string; data?: T } & Record<string, unknown>> {
    const response = await this.apiClient.post('llm', {
      operation,
      ...params,
    });
    const data = (response.data?.data ?? response.data) as { success?: boolean; status?: string; data?: T } & Record<string, unknown>;
    return data;
  }

  async searchProfiles(query: string, filters?: unknown, limit = 10, offset = 0): Promise<SearchResponse> {
    try {
      const response = await this.apiClient.post('search', {
        query,
        filters,
        limit,
        offset,
      });

      const data = typeof response.data === 'object' && 'statusCode' in response.data
        ? JSON.parse(response.data.body)
        : response.data;

      return {
        success: data.success,
        message: data.message,
        results: data.results || [],
        total: data.total || 0,
        metadata: data.metadata,
      };
    } catch (error) {
      logger.error('Search API error', { error });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Search failed',
        results: [],
        total: 0,
      };
    }
  }

}

export const lambdaApiService = new ExtendedLambdaApiService();
export default lambdaApiService;
