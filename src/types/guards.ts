/**
 * @fileoverview Type guards for runtime type checking in the Connection Management System
 * 
 * This file contains type guard functions that provide runtime type safety by checking
 * if values conform to expected interfaces. These are essential for validating data
 * from external sources like APIs and user input.
 * 
 * @author Connection Management System
 * @version 1.0.0
 */

import type {
  Connection,
  Message,
  ConnectionStatus,
  MessageSender,
  StatusValue,
  ConnectionFilters,
  ConnectionCounts,
  ApiResponse,
  GetConnectionsResponse,
  GetMessagesResponse,
  UpdateMetadataResponse,
  ApiErrorInfo,
  UserErrorInfo,
  ErrorRecoveryAction,
  ConnectionQueryParams,
  UpdateConnectionParams,
  ValidationResult,
} from './index';

// =============================================================================
// PRIMITIVE TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a non-empty string
 * 
 * @param value - The value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Checks if a value is a valid number
 * 
 * @param value - The value to check
 * @returns True if value is a finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Checks if a value is a valid positive integer
 * 
 * @param value - The value to check
 * @returns True if value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return isValidNumber(value) && value > 0 && Number.isInteger(value);
}

/**
 * Checks if a value is a valid ISO date string
 * 
 * @param value - The value to check
 * @returns True if value is a valid ISO date string
 */
export function isValidISODate(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  try {
    const date = new Date(value);
    return date.toISOString() === value;
  } catch {
    return false;
  }
}

/**
 * Checks if a value is a valid URL string
 * 
 * @param value - The value to check
 * @returns True if value is a valid URL
 */
export function isValidUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// ENUM TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid ConnectionStatus
 * 
 * @param value - The value to check
 * @returns True if value is a valid ConnectionStatus
 */
export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return typeof value === 'string' && 
    ['possible', 'incoming', 'outgoing', 'ally', 'processed'].includes(value);
}

/**
 * Checks if a value is a valid MessageSender
 * 
 * @param value - The value to check
 * @returns True if value is a valid MessageSender
 */
export function isMessageSender(value: unknown): value is MessageSender {
  return typeof value === 'string' && ['user', 'connection'].includes(value);
}

/**
 * Checks if a value is a valid StatusValue
 * 
 * @param value - The value to check
 * @returns True if value is a valid StatusValue
 */
export function isStatusValue(value: unknown): value is StatusValue {
  return typeof value === 'string' && 
    ['all', 'incoming', 'outgoing', 'ally'].includes(value);
}

// =============================================================================
// CORE INTERFACE TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid Message object
 * 
 * @param value - The value to check
 * @returns True if value conforms to Message interface
 */
export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isNonEmptyString(obj.id) &&
    typeof obj.content === 'string' &&
    isNonEmptyString(obj.timestamp) &&
    isMessageSender(obj.sender)
  );
}

/**
 * Checks if a value is a valid Connection object
 * 
 * @param value - The value to check
 * @returns True if value conforms to Connection interface
 */
export function isConnection(value: unknown): value is Connection {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check required fields
  if (
    !isNonEmptyString(obj.id) ||
    typeof obj.first_name !== 'string' ||
    typeof obj.last_name !== 'string' ||
    typeof obj.position !== 'string' ||
    typeof obj.company !== 'string' ||
    !isConnectionStatus(obj.status)
  ) {
    return false;
  }
  
  // Check optional fields if they exist
  if (obj.location !== undefined && typeof obj.location !== 'string') return false;
  if (obj.headline !== undefined && typeof obj.headline !== 'string') return false;
  if (obj.recent_activity !== undefined && typeof obj.recent_activity !== 'string') return false;
  if (obj.messages !== undefined && !isValidNumber(obj.messages)) return false;
  if (obj.date_added !== undefined && typeof obj.date_added !== 'string') return false;
  if (obj.linkedin_url !== undefined && typeof obj.linkedin_url !== 'string') return false;
  if (obj.last_action_summary !== undefined && typeof obj.last_action_summary !== 'string') return false;
  if (obj.last_activity_summary !== undefined && typeof obj.last_activity_summary !== 'string') return false;
  if (obj.conversion_likelihood !== undefined && !isValidNumber(obj.conversion_likelihood)) return false;
  if (obj.isFakeData !== undefined && typeof obj.isFakeData !== 'boolean') return false;
  
  // Check array fields
  if (obj.common_interests !== undefined) {
    if (!Array.isArray(obj.common_interests) || 
        !obj.common_interests.every(item => typeof item === 'string')) {
      return false;
    }
  }
  
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || 
        !obj.tags.every(item => typeof item === 'string')) {
      return false;
    }
  }
  
  if (obj.message_history !== undefined) {
    if (!Array.isArray(obj.message_history) || 
        !obj.message_history.every(isMessage)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Checks if a value is a valid ConnectionFilters object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ConnectionFilters interface
 */
export function isConnectionFilters(value: unknown): value is ConnectionFilters {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  // All fields are optional, so check only if they exist
  if (obj.status !== undefined) {
    if (!(isConnectionStatus(obj.status) || obj.status === 'all')) {
      return false;
    }
  }
  
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || !obj.tags.every(item => typeof item === 'string')) {
      return false;
    }
  }
  
  if (obj.company !== undefined && typeof obj.company !== 'string') return false;
  if (obj.location !== undefined && typeof obj.location !== 'string') return false;
  if (obj.searchTerm !== undefined && typeof obj.searchTerm !== 'string') return false;
  
  return true;
}

/**
 * Checks if a value is a valid ConnectionCounts object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ConnectionCounts interface
 */
export function isConnectionCounts(value: unknown): value is ConnectionCounts {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isValidNumber(obj.incoming) && obj.incoming >= 0 &&
    isValidNumber(obj.outgoing) && obj.outgoing >= 0 &&
    isValidNumber(obj.ally) && obj.ally >= 0 &&
    isValidNumber(obj.total) && obj.total >= 0 &&
    (obj.possible === undefined || (isValidNumber(obj.possible) && obj.possible >= 0))
  );
}

// =============================================================================
// API RESPONSE TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid ApiResponse object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ApiResponse interface
 */
export function isApiResponse<T>(
  value: unknown,
  bodyValidator?: (body: unknown) => body is T
): value is ApiResponse<T> {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  if (!isValidNumber(obj.statusCode)) return false;
  if (obj.body === undefined) return false;
  if (obj.error !== undefined && typeof obj.error !== 'string') return false;
  
  // If a body validator is provided, use it
  if (bodyValidator && !bodyValidator(obj.body)) return false;
  
  return true;
}

/**
 * Checks if a value is a valid GetConnectionsResponse object
 * 
 * @param value - The value to check
 * @returns True if value conforms to GetConnectionsResponse interface
 */
export function isGetConnectionsResponse(value: unknown): value is GetConnectionsResponse {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj.connections) &&
    obj.connections.every(isConnection) &&
    isValidNumber(obj.count) &&
    obj.count >= 0
  );
}

/**
 * Checks if a value is a valid GetMessagesResponse object
 * 
 * @param value - The value to check
 * @returns True if value conforms to GetMessagesResponse interface
 */
export function isGetMessagesResponse(value: unknown): value is GetMessagesResponse {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    Array.isArray(obj.messages) &&
    obj.messages.every(isMessage) &&
    isValidNumber(obj.count) &&
    obj.count >= 0
  );
}

/**
 * Checks if a value is a valid UpdateMetadataResponse object
 * 
 * @param value - The value to check
 * @returns True if value conforms to UpdateMetadataResponse interface
 */
export function isUpdateMetadataResponse(value: unknown): value is UpdateMetadataResponse {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.success === 'boolean' &&
    typeof obj.updated === 'object' &&
    obj.updated !== null
  );
}

// =============================================================================
// ERROR TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid ApiErrorInfo object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ApiErrorInfo interface
 */
export function isApiErrorInfo(value: unknown): value is ApiErrorInfo {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isNonEmptyString(obj.message) &&
    (obj.status === undefined || isValidNumber(obj.status)) &&
    (obj.code === undefined || typeof obj.code === 'string')
  );
}

/**
 * Checks if a value is a valid ErrorRecoveryAction object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ErrorRecoveryAction interface
 */
export function isErrorRecoveryAction(value: unknown): value is ErrorRecoveryAction {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isNonEmptyString(obj.label) &&
    typeof obj.action === 'function' &&
    (obj.primary === undefined || typeof obj.primary === 'boolean') &&
    (obj.description === undefined || typeof obj.description === 'string')
  );
}

/**
 * Checks if a value is a valid UserErrorInfo object
 * 
 * @param value - The value to check
 * @returns True if value conforms to UserErrorInfo interface
 */
export function isUserErrorInfo(value: unknown): value is UserErrorInfo {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    isNonEmptyString(obj.userMessage) &&
    isNonEmptyString(obj.technicalMessage) &&
    typeof obj.severity === 'string' &&
    ['low', 'medium', 'high', 'critical'].includes(obj.severity) &&
    typeof obj.retryable === 'boolean' &&
    Array.isArray(obj.recoveryActions) &&
    obj.recoveryActions.every(isErrorRecoveryAction) &&
    isNonEmptyString(obj.timestamp)
  );
}

// =============================================================================
// PARAMETER TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid ConnectionQueryParams object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ConnectionQueryParams interface
 */
export function isConnectionQueryParams(value: unknown): value is ConnectionQueryParams {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  // All fields are optional
  if (obj.userId !== undefined && !isNonEmptyString(obj.userId)) return false;
  if (obj.status !== undefined && !isConnectionStatus(obj.status)) return false;
  if (obj.limit !== undefined && !isPositiveInteger(obj.limit)) return false;
  if (obj.offset !== undefined && 
      !(typeof obj.offset === 'string' || isValidNumber(obj.offset))) return false;
  if (obj.sortBy !== undefined && 
      !['date_added', 'name', 'company', 'status'].includes(obj.sortBy as string)) return false;
  if (obj.sortOrder !== undefined && 
      !['asc', 'desc'].includes(obj.sortOrder as string)) return false;
  
  return true;
}

/**
 * Checks if a value is a valid UpdateConnectionParams object
 * 
 * @param value - The value to check
 * @returns True if value conforms to UpdateConnectionParams interface
 */
export function isUpdateConnectionParams(value: unknown): value is UpdateConnectionParams {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  if (!isNonEmptyString(obj.connectionId)) return false;
  if (typeof obj.updates !== 'object' || obj.updates === null) return false;
  if (obj.updateTimestamp !== undefined && typeof obj.updateTimestamp !== 'boolean') return false;
  
  // Validate updates object
  const updates = obj.updates as Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    switch (key) {
      case 'status':
        if (!isConnectionStatus(value)) return false;
        break;
      case 'tags':
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return false;
        break;
      case 'last_action_summary':
        if (typeof value !== 'string') return false;
        break;
      case 'conversion_likelihood':
        if (!isValidNumber(value)) return false;
        break;
      default:
        // Allow other fields but don't validate them strictly
        break;
    }
  }
  
  return true;
}

// =============================================================================
// VALIDATION RESULT TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is a valid ValidationResult object
 * 
 * @param value - The value to check
 * @returns True if value conforms to ValidationResult interface
 */
export function isValidationResult(value: unknown): value is ValidationResult {
  if (typeof value !== 'object' || value === null) return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.isValid === 'boolean' &&
    Array.isArray(obj.errors) &&
    obj.errors.every(error => typeof error === 'string') &&
    (obj.warnings === undefined || 
     (Array.isArray(obj.warnings) && obj.warnings.every(warning => typeof warning === 'string'))) &&
    (obj.sanitizedData === undefined || obj.sanitizedData !== null)
  );
}

// =============================================================================
// ARRAY TYPE GUARDS
// =============================================================================

/**
 * Checks if a value is an array of Connections
 * 
 * @param value - The value to check
 * @returns True if value is an array of valid Connection objects
 */
export function isConnectionArray(value: unknown): value is Connection[] {
  return Array.isArray(value) && value.every(isConnection);
}

/**
 * Checks if a value is an array of Messages
 * 
 * @param value - The value to check
 * @returns True if value is an array of valid Message objects
 */
export function isMessageArray(value: unknown): value is Message[] {
  return Array.isArray(value) && value.every(isMessage);
}

/**
 * Checks if a value is an array of strings
 * 
 * @param value - The value to check
 * @returns True if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

// =============================================================================
// UTILITY TYPE GUARDS
// =============================================================================

/**
 * Creates a type guard that checks if a value has all required properties
 * 
 * @param requiredKeys - Array of required property names
 * @returns Type guard function
 */
export function hasRequiredProperties<T extends Record<string, unknown>>(
  requiredKeys: (keyof T)[]
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    if (typeof value !== 'object' || value === null) return false;
    
    const obj = value as Record<string, unknown>;
    return requiredKeys.every(key => obj[key] !== undefined);
  };
}

/**
 * Creates a type guard that checks if a value is one of the allowed values
 * 
 * @param allowedValues - Array of allowed values
 * @returns Type guard function
 */
export function isOneOf<T>(allowedValues: T[]): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return allowedValues.includes(value as T);
  };
}

/**
 * Combines multiple type guards with AND logic
 * 
 * @param guards - Array of type guard functions
 * @returns Combined type guard function
 */
export function combineGuards<T>(
  ...guards: Array<(value: unknown) => value is T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return guards.every(guard => guard(value));
  };
}

/**
 * Combines multiple type guards with OR logic
 * 
 * @param guards - Array of type guard functions
 * @returns Combined type guard function
 */
export function combineGuardsOr<T>(
  ...guards: Array<(value: unknown) => value is T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return guards.some(guard => guard(value));
  };
}