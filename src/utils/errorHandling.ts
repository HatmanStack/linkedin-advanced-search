import { ApiError } from '@/services/lambdaApiService';

/**
 * Error handling utilities for the connection management system
 * Provides consistent error handling patterns and user-friendly error messages
 */

export interface ErrorWithRecovery {
  message: string;
  userMessage: string;
  recoveryActions: RecoveryAction[];
  severity: 'low' | 'medium' | 'high';
  retryable: boolean;
}

export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

/**
 * Transform various error types into user-friendly error objects
 */
export function transformErrorForUser(
  error: unknown,
  context: string,
  recoveryActions: RecoveryAction[] = []
): ErrorWithRecovery {
  let message = 'An unexpected error occurred';
  let userMessage = 'Something went wrong. Please try again.';
  let severity: 'low' | 'medium' | 'high' = 'medium';
  let retryable = false;

  if (error instanceof ApiError) {
    message = error.message;
    retryable = error.retryable || false;
    
    // Map API errors to user-friendly messages
    if (error.status === 401 || error.status === 403) {
      userMessage = 'You need to sign in again to continue.';
      severity = 'high';
      recoveryActions = [
        {
          label: 'Sign In',
          action: () => window.location.href = '/auth',
          primary: true
        },
        ...recoveryActions
      ];
    } else if (error.status === 404) {
      userMessage = 'The requested information could not be found.';
      severity = 'medium';
    } else if (error.status === 429) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
      severity = 'low';
      retryable = true;
    } else if (error.status && error.status >= 500) {
      userMessage = 'Our servers are experiencing issues. Please try again in a few moments.';
      severity = 'high';
      retryable = true;
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network error')) {
      userMessage = 'Unable to connect to our servers. Please check your internet connection.';
      severity = 'high';
      retryable = true;
    } else {
      userMessage = `Failed to ${context}. ${error.message}`;
      severity = 'medium';
    }
  } else if (error instanceof Error) {
    message = error.message;
    userMessage = `Failed to ${context}. ${error.message}`;
    
    // Check for specific error patterns
    if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      userMessage = 'The request took too long. Please try again.';
      retryable = true;
      severity = 'low';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      userMessage = 'Network connection issue. Please check your internet connection.';
      retryable = true;
      severity = 'high';
    }
  } else if (typeof error === 'string') {
    message = error;
    userMessage = `Failed to ${context}. ${error}`;
  }

  return {
    message,
    userMessage,
    recoveryActions,
    severity,
    retryable
  };
}

/**
 * Get appropriate toast variant based on error severity
 */
export function getToastVariant(severity: 'low' | 'medium' | 'high'): 'default' | 'destructive' {
  return severity === 'low' ? 'default' : 'destructive';
}

/**
 * Create standardized error messages for common operations
 */
export const ERROR_MESSAGES = {
  FETCH_CONNECTIONS: 'load your connections',
  UPDATE_CONNECTION: 'update the connection',
  REMOVE_CONNECTION: 'remove the connection',
  FETCH_MESSAGES: 'load message history',
  SEND_MESSAGE: 'send the message',
  AUTHENTICATION: 'authenticate your request',
  NETWORK: 'connect to our servers',
  VALIDATION: 'validate the information',
  UNKNOWN: 'complete the operation'
} as const;

/**
 * Retry mechanism with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  shouldRetry?: (error: unknown) => boolean
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Default retry condition - retry on network errors and server errors
 */
export function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.retryable || false;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('timeout') || 
           message.includes('fetch') ||
           message.includes('connection');
  }
  
  return false;
}

/**
 * Validate connection data before rendering
 */
export function validateConnectionData(connection: any): boolean {
  if (!connection || typeof connection !== 'object') {
    return false;
  }
  
  // Check required fields
  const requiredFields = ['id', 'first_name', 'last_name', 'status'];
  for (const field of requiredFields) {
    if (!connection[field]) {
      console.warn(`Connection missing required field: ${field}`, connection);
      return false;
    }
  }
  
  // Validate status
  const validStatuses = ['possible', 'incoming', 'outgoing', 'ally'];
  if (!validStatuses.includes(connection.status)) {
    console.warn(`Connection has invalid status: ${connection.status}`, connection);
    return false;
  }
  
  return true;
}

/**
 * Sanitize connection data with fallback values
 */
export function sanitizeConnectionData(connection: any): any {
  if (!connection || typeof connection !== 'object') {
    return null;
  }
  
  return {
    id: connection.id || `unknown-${Date.now()}`,
    first_name: connection.first_name || 'Unknown',
    last_name: connection.last_name || '',
    position: connection.position || '',
    company: connection.company || '',
    location: connection.location || '',
    headline: connection.headline || '',
    recent_activity: connection.recent_activity || '',
    common_interests: Array.isArray(connection.common_interests) ? connection.common_interests : [],
    messages: typeof connection.messages === 'number' ? connection.messages : 0,
    date_added: connection.date_added || '',
    linkedin_url: connection.linkedin_url || '',
    tags: Array.isArray(connection.tags) ? connection.tags : [],
    last_action_summary: connection.last_action_summary || '',
    status: ['possible', 'incoming', 'outgoing', 'ally'].includes(connection.status) 
      ? connection.status 
      : 'possible',
    conversion_likelihood: typeof connection.conversion_likelihood === 'number' 
      ? connection.conversion_likelihood 
      : undefined,
    message_history: Array.isArray(connection.message_history) ? connection.message_history : [],
  };
}

/**
 * Log errors with context for debugging
 */
export function logError(error: unknown, context: string, additionalData?: any): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    additionalData,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.error(`[${context}] Error occurred:`, errorInfo);
  
  // In production, you might want to send this to an error tracking service
  // Example: Sentry.captureException(error, { extra: errorInfo });
}