import { CognitoAuthService } from '@/features/auth';
import { API_CONFIG } from '@/config/appConfig';
import type { Message, UserProfile } from '@/shared/types/index';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('MessageGenerationService');


export interface MessageGenerationRequest {
  
  connectionId: string;
  
  
  connectionProfile: {
    firstName: string;
    lastName: string;
    position: string;
    company: string;
    headline?: string;
    tags?: string[];
  };
  
  
  conversationTopic: string;
  
  
  messageHistory?: Message[];
  
  
  userProfile?: UserProfile;
}


export interface MessageGenerationResponse {
  
  generatedMessage: string;
  
  
  confidence: number;
  
  
  reasoning?: string;
}


export class MessageGenerationError extends Error {
  status?: number;
  code?: string;

  constructor({ 
    message, 
    status, 
    code 
  }: { 
    message: string; 
    status?: number; 
    code?: string; 
  }) {
    super(message);
    this.name = 'MessageGenerationError';
    this.status = status;
    this.code = code;
  }
}


const MESSAGE_GENERATION_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_GATEWAY_URL || API_CONFIG.BASE_URL,
  ENDPOINT: API_CONFIG.ENDPOINTS.MESSAGE_GENERATION,
  TIMEOUT: 30000,
  MOCK_MODE: import.meta.env.VITE_MOCK_MODE === 'true' || process.env.NODE_ENV === 'development',
} as const;


class MessageGenerationService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = MESSAGE_GENERATION_CONFIG.BASE_URL;
    this.timeout = MESSAGE_GENERATION_CONFIG.TIMEOUT;
  }

  
  private async getAuthToken(): Promise<string | null> {
    try {
      const token = await CognitoAuthService.getCurrentUserToken();
      if (token) {
        sessionStorage.setItem('jwt_token', token);
        return token;
      }
      return null;
    } catch (error) {
      logger.error('Error getting auth token', { error });
      return null;
    }
  }

  
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = await this.getAuthToken();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
      };

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
        const errorData = await response.json().catch(() => ({}));
        throw new MessageGenerationError({
          message: errorData.message || `HTTP error! status: ${response.status}`,
          status: response.status,
          code: errorData.code,
        });
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MessageGenerationError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MessageGenerationError({
            message: 'Request timeout - message generation is taking too long',
            code: 'TIMEOUT',
          });
        }
        throw new MessageGenerationError({
          message: error.message || 'An unexpected error occurred',
          code: 'NETWORK_ERROR',
        });
      }

      throw new MessageGenerationError({
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      });
    }
  }

  
  async generateMessage(request: MessageGenerationRequest): Promise<string> {
    try {
      this.validateRequest(request);

      if (MESSAGE_GENERATION_CONFIG.MOCK_MODE) {
        return this.generateMockResponse(request);
      }

      const payload = this.formatRequestPayload(request);

      const response = await this.makeRequest<MessageGenerationResponse>(
        MESSAGE_GENERATION_CONFIG.ENDPOINT,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      if (!response.generatedMessage) {
        throw new MessageGenerationError({
          message: 'Invalid response: missing generated message',
          code: 'INVALID_RESPONSE',
        });
      }

      return response.generatedMessage;
    } catch (error) {
      if (error instanceof MessageGenerationError) {
        throw error;
      }

      throw new MessageGenerationError({
        message: error instanceof Error ? error.message : 'Failed to generate message',
        code: 'GENERATION_FAILED',
      });
    }
  }

  
  async generateBatchMessages(
    requests: MessageGenerationRequest[]
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const errors = new Map<string, MessageGenerationError>();

    for (const request of requests) {
      try {
        const message = await this.generateMessage(request);
        results.set(request.connectionId, message);
      } catch (error) {
        const generationError = error instanceof MessageGenerationError 
          ? error 
          : new MessageGenerationError({
              message: error instanceof Error ? error.message : 'Unknown error',
              code: 'BATCH_GENERATION_FAILED',
            });
        
        errors.set(request.connectionId, generationError);
      }
    }

    if (results.size === 0 && errors.size > 0) {
      const firstError = Array.from(errors.values())[0];
      throw new MessageGenerationError({
        message: `Batch generation failed: ${firstError.message}`,
        code: 'BATCH_GENERATION_FAILED',
      });
    }

    return results;
  }

  
  private async generateMockResponse(request: MessageGenerationRequest): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const { connectionProfile, conversationTopic } = request;
    const { firstName, position, company } = connectionProfile;

    const mockMessages = [
      `Hi ${firstName}, I noticed your work at ${company} as ${position}. I'd love to discuss ${conversationTopic} with you - it's something I'm passionate about and I think we could have a great conversation about it.`,
      `Hello ${firstName}, Your experience at ${company} caught my attention. I'm really interested in ${conversationTopic} and would appreciate your insights on this topic. Would you be open to connecting?`,
      `Hi ${firstName}, I came across your profile and was impressed by your role as ${position} at ${company}. I'm currently exploring ${conversationTopic} and would love to hear your perspective on it.`,
      `Hello ${firstName}, I hope you're doing well! I noticed we might have some common interests around ${conversationTopic}. Given your background at ${company}, I'd love to connect and learn from your experience.`,
    ];

    const selectedMessage = mockMessages[Math.floor(Math.random() * mockMessages.length)];

    if (Math.random() < 0.1) {
      throw new MessageGenerationError({
        message: 'Mock API error for testing',
        status: 500,
        code: 'MOCK_ERROR',
      });
    }

    return selectedMessage;
  }

  
  private validateRequest(request: MessageGenerationRequest): void {
    if (!request.connectionId) {
      throw new MessageGenerationError({
        message: 'Connection ID is required',
        code: 'INVALID_REQUEST',
      });
    }

    if (!request.conversationTopic?.trim()) {
      throw new MessageGenerationError({
        message: 'Conversation topic is required',
        code: 'INVALID_REQUEST',
      });
    }

    if (!request.connectionProfile) {
      throw new MessageGenerationError({
        message: 'Connection profile is required',
        code: 'INVALID_REQUEST',
      });
    }

    const { firstName, lastName, position, company } = request.connectionProfile;
    if (!firstName || !lastName || !position || !company) {
      throw new MessageGenerationError({
        message: 'Connection profile must include firstName, lastName, position, and company',
        code: 'INVALID_REQUEST',
      });
    }
  }

  
  private formatRequestPayload(request: MessageGenerationRequest): Record<string, unknown> {
    return {
      connectionId: request.connectionId,
      connectionProfile: {
        firstName: request.connectionProfile.firstName,
        lastName: request.connectionProfile.lastName,
        position: request.connectionProfile.position,
        company: request.connectionProfile.company,
        headline: request.connectionProfile.headline,
        tags: request.connectionProfile.tags || [],
      },
      conversationTopic: request.conversationTopic.trim(),
      messageHistory: request.messageHistory || [],
      userProfile: request.userProfile ? {
        firstName: request.userProfile.first_name,
        lastName: request.userProfile.last_name,
        headline: request.userProfile.headline,
        company: request.userProfile.company,
        position: request.userProfile.current_position,
        industry: request.userProfile.industry,
        interests: request.userProfile.interests || [],
      } : undefined,
    };
  }

}


export const messageGenerationService = new MessageGenerationService();

export { MessageGenerationService };
