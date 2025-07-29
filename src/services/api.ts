import { API_CONFIG } from '../utils/constants';
import type { SearchFormData } from '../utils/validation';
import { CognitoAuthService } from './cognitoService';

export interface SearchResponse {
  response: string[];
}

export interface ApiError {
  message: string;
  status?: number;
}

class ApiService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  // Get JWT token from session storage or Cognito
  private async getAuthToken(): Promise<string | null> {
    try {
      
      const token = await CognitoAuthService.getCurrentUserToken();
      if (token) {
        // Store in session storage for future use
        sessionStorage.setItem('jwt_token', token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Clear stored token (useful for logout)
  public clearAuthToken(): void {
    sessionStorage.removeItem('jwt_token');
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Get JWT token for authentication
      const token = await this.getAuthToken();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
      };

      // Add Authorization header if token is available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError({
          message: `HTTP error! status: ${response.status}`,
          status: response.status,
        });
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError({
            message: 'Request timeout - the search is taking too long',
          });
        }
        throw new ApiError({
          message: error.message || 'An unexpected error occurred',
        });
      }

      throw new ApiError({
        message: 'An unexpected error occurred',
      });
    }
  }

  async searchLinkedIn(searchData: SearchFormData): Promise<string[]> {
    const response = await this.makeRequest<SearchResponse>(
      API_CONFIG.ENDPOINTS.SEARCH,
      {
        method: 'POST',
        body: JSON.stringify(searchData),
      }
    );

    // Ensure we return an array
    return Array.isArray(response.response) ? response.response : [];
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Custom error class
export class ApiError extends Error {
  status?: number;

  constructor({ message, status }: { message: string; status?: number }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}