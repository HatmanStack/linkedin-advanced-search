import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';
import { CognitoAuthService } from '@/features/auth';
import { logError } from '@/shared/utils/errorHandling';
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
    
    // Determine if error is retryable based on status code
    this.retryable = this.isRetryableError(status, code);
  }

  private isRetryableError(status?: number, code?: string): boolean {
    // Network errors are retryable
    if (!status && (code === 'NETWORK_ERROR' || code === 'ERR_NETWORK' || code === 'ECONNABORTED')) {
      return true;
    }
    
    // Server errors (5xx) are retryable
    if (status && status >= 500) {
      return true;
    }
    
    // Rate limiting is retryable
    if (status === 429) {
      return true;
    }
    
    // Timeout errors are retryable
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

export interface ApiResponse<T = any> {
  statusCode: number;
  body: T;
}

/**
 * Database Connector service for managing connections through API Gateway
 * 
 * Provides a comprehensive interface for connection management operations including:
 * - Fetching connections with status filtering
 * - Updating connection metadata and status
 * - Retrieving message history
 * - Authentication token management
 * - Error handling with retry logic
 * - Data validation and sanitization
 * 
 * @class LambdaApiService
 * @example
 * ```typescript
 * // Fetch all possible connections
  * const connections = await lambdaApiService.getConnectionsByStatus('possible');
 * 
 * // Update connection status
  * await lambdaApiService.updateConnectionStatus('connection-id', 'processed');
 * 
 * // Get message history
  * const messages = await lambdaApiService.getMessageHistory('connection-id');
 * ```
 */
class LambdaApiService {
  protected apiClient: AxiosInstance;
  // Stored for potential future use
  // @ts-expect-error - Reserved for future authentication enhancement
  private authToken: string | null = null;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // Base delay in milliseconds

  constructor() {
    // Initialize axios client with API Gateway base URL
    const apiBaseUrl =
      (import.meta.env as any).VITE_API_GATEWAY_URL ||  '';

    if (!apiBaseUrl) {
      console.warn(
        'LambdaApiService: No API base URL configured. Set VITE_API_GATEWAY_URL (preferred) or VITE_API_GATEWAY_BASE_URL to avoid defaulting to the current origin (e.g., localhost during dev).'
      );
    }

    // Normalize base URL to ensure trailing slash so relative endpoints join correctly (e.g., .../prod/llm)
    const normalizedBaseUrl = apiBaseUrl
      ? (apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`)
      : undefined;

    this.apiClient = axios.create({
      baseURL: normalizedBaseUrl,
      timeout: 60000, // Increase timeout to better accommodate LLM latency
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use(
      async (config) => {
        // Get fresh token for each request
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

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * Get JWT token from Cognito service for API authentication
   * 
   * @returns Promise resolving to JWT token string or null if unavailable
   * @private
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Use existing Cognito service to get token
      const token = await CognitoAuthService.getCurrentUserToken();
      if (token) {
        this.authToken = token;
        return token;
      }
      return null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Clear stored authentication token
   * Used when user logs out or token becomes invalid
   * 
   * @public
   */
  public clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Transform axios errors into consistent ApiError format
   * Handles different error types (response, request, other) and creates structured error objects
   * 
   * @param error - The axios error to transform
   * @returns Structured ApiError instance
   * @private
   */
  private transformError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const responseData = error.response.data as any;
      const message = responseData?.message || 
                     responseData?.error || 
                     `HTTP ${status} error`;
      
      return new ApiError({
        message,
        status,
        code: error.code,
      });
    } else if (error.request) {
      // Request was made but no response received
      return new ApiError({
        message: 'Network error - unable to reach server',
        code: error.code,
      });
    } else {
      // Something else happened
      return new ApiError({
        message: error.message || 'An unexpected error occurred',
        code: error.code,
      });
    }
  }

  /**
   * Sleep for a specified number of milliseconds
   * Used for implementing retry delays with exponential backoff
   * 
   * @param ms - Number of milliseconds to sleep
   * @returns Promise that resolves after the specified delay
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay for retry attempts
   * Implements exponential backoff with jitter to prevent thundering herd
   * 
   * @param attempt - The current attempt number (1-based)
   * @returns Delay in milliseconds for the next retry
   * @private
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
  }

  /**
   * Make authenticated request to Lambda endpoints with retry logic
   * Handles Lambda response format, implements exponential backoff, and provides comprehensive error handling
   * 
   * @template T - The expected response body type
   * @param endpoint - The endpoint to call (e.g., '/edge', '/llm')
   * @param operation - The Lambda operation to execute
   * @param params - Parameters to send with the operation
   * @returns Promise resolving to the operation response body
   * @throws {ApiError} When the request fails after all retries
   * @private
   */
  private async makeRequest<T>(endpoint: string, operation: string, params: Record<string, any> = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.apiClient.post<ApiResponse<T>>(endpoint, {
          operation,
          ...params,
        });

        // Handle both direct API Gateway responses and Lambda proxy responses
        const responseData = response.data;
        
        // Check if this is a Lambda proxy response format
        if (responseData && typeof responseData === 'object' && 'statusCode' in responseData) {
          // Lambda proxy response format
          const lambdaResponse = responseData;
          
          if (lambdaResponse.statusCode !== 200) {
            const errorBody = typeof lambdaResponse.body === 'string' 
              ? JSON.parse(lambdaResponse.body) 
              : lambdaResponse.body;
            const error = new ApiError({
              message: errorBody?.error || `Lambda returned status ${lambdaResponse.statusCode}`,
              status: lambdaResponse.statusCode,
            });
            
            // Don't retry client errors (4xx)
            if (lambdaResponse.statusCode >= 400 && lambdaResponse.statusCode < 500) {
              throw error;
            }
            
            throw error;
          }

          // Parse JSON body if it's a string
          const parsedBody = typeof lambdaResponse.body === 'string' 
            ? JSON.parse(lambdaResponse.body) 
            : lambdaResponse.body;
          
          return parsedBody;
        } else {
          // Direct API Gateway response (not Lambda proxy)
          return responseData;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error occurred during API request');
        
        // Check if error is retryable
        const apiError = error instanceof ApiError ? error : this.transformError(error as AxiosError);
        
        if (!apiError.retryable || attempt === this.maxRetries) {
          console.error(`API request failed after ${attempt} attempts:`, {
            endpoint,
            operation,
            error: apiError.toJSON(),
            params: Object.keys(params)
          });
          throw apiError;
        }

        // Calculate delay for next retry
        const delay = this.calculateBackoffDelay(attempt);
        console.warn(`API request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms:`, {
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

  /**
   * Fetch connections filtered by status using the get_connections_by_status operation
   * @param status Optional status filter
   * @returns Promise<Connection[]> Array of connections matching the filter
   */
  async getConnectionsByStatus(status?: ConnectionStatus): Promise<Connection[]> {
    
    const context = `fetch connections${status ? ` with status ${status}` : ''}`;
    
    try {
      const response = await this.makeRequest<{
        connections: Connection[];
        count: number;
      }>('edge', 'get_connections_by_status', { updates: status ? { status } : {} });

      // Transform and validate the response
      const connections = this.formatConnectionsResponse(response.connections || []);
      
      // Log successful operation
      console.log(`Successfully fetched ${connections.length} connections${status ? ` with status ${status}` : ''}`);
      
      return connections;
    } catch (error) {
      logError(error, context, { status, operation: 'get_connections_by_status' });
      
      // Re-throw as ApiError if not already one
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to fetch connections',
        status: 500,
      });
    }
  }

  /**
   * Update connection status using the update_metadata operation
   * @param connectionId The ID of the connection to update
   * @param newStatus The new status to set
   * @returns Promise<void>
   */
  async updateConnectionStatus(
    connectionId: string,
    newStatus: ConnectionStatus | 'processed',
    options?: { profileId?: string }
  ): Promise<void> {
    const context = `update connection status to ${newStatus}`;
    
    try {
      // Validate input parameters
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

      await this.makeRequest<{ success: boolean; updated: Record<string, any> }>('edge', 'update_metadata', {
        // Edge Lambda expects 'profileId' in the request body; we always send profileId
        profileId: options?.profileId ?? connectionId,
        updates: {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        },
      });

      console.log(`Successfully updated connection ${connectionId} status to ${newStatus}`);
    } catch (error) {
      logError(error, context, { 
        connectionId, 
        newStatus, 
        operation: 'update_metadata' 
      });
      
      // Re-throw as ApiError if not already one
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to update connection status',
        status: 500,
      });
    }
  }

  /**
   * Get message history for a specific connection using the get_messages operation
   * @param connectionId The ID of the connection to get messages for
   * @returns Promise<Message[]> Array of messages for the connection
   */
  async getMessageHistory(connectionId: string): Promise<Message[]> {
    const context = 'fetch message history';
    
    try {
      // Validate input parameters
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

      // Transform and validate the response
      const messages = this.formatMessagesResponse(response.messages || []);
      
      console.log(`Successfully fetched ${messages.length} messages for connection ${connectionId}`);
      
      return messages;
    } catch (error) {
      logError(error, context, { 
        connectionId, 
        operation: 'get_messages' 
      });
      
      // Re-throw as ApiError if not already one
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError({
        message: error instanceof Error ? error.message : 'Failed to fetch message history',
        status: 500,
      });
    }
  }

  /**
   * Format and validate connections response from API
   * @param connections Raw connections data from API
   * @returns Connection[] Formatted and validated connections
   */
  private formatConnectionsResponse(connections: any[]): Connection[] {
    if (!Array.isArray(connections)) {
      console.warn('Invalid connections data received, expected array:', connections);
      return [];
    }

    return connections
      .map((conn, index) => {
        try {
          // First try to validate the connection as-is
          const validationResult = validateConnection(conn, { sanitize: false });
          
          if (validationResult.isValid && isConnection(conn)) {
            return conn as Connection;
          }

          // If validation failed, try to sanitize the data
          //console.warn(`Invalid connection data at index ${index}:`, validationResult.errors);
          const sanitized = sanitizeConnectionData(conn);
          
          if (sanitized && isConnection(sanitized)) {
            //console.log(`Successfully sanitized connection data at index ${index}`);
            return sanitized;
          }

          // If sanitization failed, return null to filter out
          console.error(`Unable to sanitize connection data at index ${index}:`, conn);
          return null;
        } catch (error) {
          logError(error, 'format connection data', { connection: conn, index });
          
          // Try one more time with sanitization
          const fallback = sanitizeConnectionData(conn);
          if (fallback && isConnection(fallback)) {
            return fallback;
          }
          
          // Return null to filter out completely invalid data
          return null;
        }
      })
      .filter((conn): conn is Connection => conn !== null); // Remove null entries
  }

  /**
   * Format and validate messages response from API
   * @param messages Raw messages data from API
   * @returns Message[] Formatted and validated messages
   */
  private formatMessagesResponse(messages: any[]): Message[] {
    if (!Array.isArray(messages)) {
      console.warn('Invalid messages data received, expected array:', messages);
      return [];
    }

    return messages
      .map((msg, index) => {
        try {
          // First try to validate the message as-is
          const validationResult = validateMessage(msg, { sanitize: false });
          
          if (validationResult.isValid && isMessage(msg)) {
            return msg as Message;
          }

          // If validation failed, try to sanitize the data
          console.warn(`Invalid message data at index ${index}:`, validationResult.errors);
          const sanitized = sanitizeMessageData(msg);
          
          if (sanitized && isMessage(sanitized)) {
            console.log(`Successfully sanitized message data at index ${index}`);
            return sanitized;
          }

          // If sanitization failed, return null to filter out
          console.error(`Unable to sanitize message data at index ${index}:`, msg);
          return null;
        } catch (error) {
          console.warn('Error formatting message:', error, msg);
          
          // Try one more time with sanitization
          const fallback = sanitizeMessageData(msg);
          if (fallback && isMessage(fallback)) {
            return fallback;
          }
          
          // Return null to filter out completely invalid data
          return null;
        }
      })
      .filter((msg): msg is Message => msg !== null); // Remove null entries
  }

  /**
   * Make authenticated request to LLM endpoint
   * @param operation The LLM operation to execute
   * @param params Additional parameters for the operation
   * @returns Promise resolving to the operation response
   */
  private async makeLLMRequest<T>(operation: string, params: Record<string, any> = {}): Promise<T> {
    return this.makeRequest<T>('llm', operation, params);
  }

  /**
   * Send LLM operation request to the /llm endpoint
   * @param operation The LLM operation to execute
   * @param params Additional parameters for the operation
   * @returns Promise resolving to the LLM operation response
   */
  async sendLLMRequest(operation: string, params: Record<string, any> = {}): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.makeLLMRequest<any>(operation, params);
      console.log('LLM response:', response);
      return { success: true, data: response };
    } catch (error) {
      console.log('LLM error:', error);
      
      if (error instanceof ApiError) {
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Failed to execute LLM operation' };
    }
  }
}

// Profile operations via Lambda-backed API - using centralized UserProfile from @/types
import type { UserProfile } from '@/types';

/**
 * Search API response format
 */
interface SearchResponse {
  success: boolean;
  message?: string;
  results: any[];
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
      console.log('Fetching user profile (GET /profiles)');
      const response = await this.apiClient.get('profiles');
      
      const data = (response.data?.data ?? response.data) as UserProfile;
     
      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<any>;
      const message = (err.response?.data as any)?.error || err.message || 'Failed to fetch profile';
      return { success: false, error: message };
    }
  }

  async updateUserProfile(profile: Partial<UserProfile>): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
      // API requires operation-based POST body; fields must be at top-level
      console.log('Updating profile (POST /profiles):', profile);
      // Use POST /profiles (backend accepts POST same as PUT)
      const response = await this.apiClient.post('profiles', {
        operation: 'update_user_settings',
        ...profile,
      });
      const data = (response.data?.data ?? response.data) as UserProfile;
      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<any>;
      const message = (err.response?.data as any)?.error || err.message || 'Failed to update profile';
      return { success: false, error: message };
    }
  }

  async createUserProfile(profile: Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
    try {
      // Reuse update operation for upsert semantics; body fields must be top-level
      const response = await this.apiClient.post('profiles', {
        operation: 'update_user_settings',
        ...profile,
      });
      const data = (response.data?.data ?? response.data) as UserProfile;
      return { success: true, data };
    } catch (error) {
      const err = error as AxiosError<any>;
      const message = (err.response?.data as any)?.error || err.message || 'Failed to create profile';
      return { success: false, error: message };
    }
  }

  /**
   * Generic helper to call operation-based POSTs against the llm backend.
   * This does not implement any polling; it simply forwards the operation and params.
   */
  async callProfilesOperation<T = any>(operation: string, params: Record<string, any> = {}): Promise<{ success?: boolean; data?: T } & Record<string, any>> {
    const response = await this.apiClient.post('llm', {
      operation,
      ...params,
    });
    const data = (response.data?.data ?? response.data) as any;
    return data;
  }

  /**
   * Search profiles using the placeholder search API
   *
   * @param query - Search query string
   * @param filters - Optional filters object
   * @param limit - Maximum number of results (1-100, default: 10)
   * @param offset - Pagination offset (default: 0)
   * @returns Promise resolving to SearchResponse with results
   */
  async searchProfiles(query: string, filters?: any, limit = 10, offset = 0): Promise<SearchResponse> {
    try {
      const response = await this.apiClient.post('search', {
        query,
        filters,
        limit,
        offset,
      });

      // Handle Lambda proxy response format
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
      console.error('Search API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Search failed',
        results: [],
        total: 0,
      };
    }
  }

}

// Export singleton instance
export const lambdaApiService = new ExtendedLambdaApiService();
export default lambdaApiService;