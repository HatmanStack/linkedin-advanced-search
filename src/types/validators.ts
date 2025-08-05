/**
 * @fileoverview Data validation functions for the Connection Management System
 * 
 * This file contains validation functions that check data integrity, sanitize input,
 * and provide detailed validation results. These functions work alongside type guards
 * to ensure data quality throughout the application.
 * 
 * @author Connection Management System
 * @version 1.0.0
 */

import type {
  Connection,
  Message,
  ConnectionFilters,
  ConnectionStatus,
  MessageSender,
  ValidationResult,
  TransformOptions,
  ConnectionQueryParams,
  UpdateConnectionParams,
} from './index';

import {
  isConnection,
  isMessage,
  isConnectionFilters,
  isConnectionStatus,
  isMessageSender,
  isNonEmptyString,
  isValidNumber,
  isValidISODate,
  isValidUrl,
  isPositiveInteger,
} from './guards';

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

/** Maximum length for text fields */
export const MAX_TEXT_LENGTH = {
  NAME: 100,
  POSITION: 200,
  COMPANY: 200,
  LOCATION: 100,
  HEADLINE: 500,
  SUMMARY: 2000,
  MESSAGE_CONTENT: 1000,
  TAG: 50,
} as const;

/** Minimum length for required fields */
export const MIN_TEXT_LENGTH = {
  NAME: 1,
  ID: 1,
  MESSAGE_CONTENT: 1,
} as const;

/** Maximum array lengths */
export const MAX_ARRAY_LENGTH = {
  TAGS: 20,
  COMMON_INTERESTS: 50,
  MESSAGES: 1000,
} as const;

/** Valid conversion likelihood range */
export const CONVERSION_LIKELIHOOD_RANGE = {
  MIN: 0,
  MAX: 100,
} as const;

// =============================================================================
// CORE VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates a Connection object and provides detailed results
 * 
 * @param connection - The connection object to validate
 * @param options - Validation options
 * @returns Detailed validation result
 */
export function validateConnection(
  connection: unknown,
  options: TransformOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitizedData: Partial<Connection> | null = null;

  // Basic type check
  if (!isConnection(connection)) {
    if (options.sanitize) {
      sanitizedData = sanitizeConnectionData(connection);
      if (sanitizedData && isConnection(sanitizedData)) {
        warnings.push('Connection data was sanitized to fix validation issues');
      } else {
        errors.push('Unable to sanitize connection data - invalid structure');
        return { isValid: false, errors, warnings };
      }
    } else {
      errors.push('Invalid connection object structure');
      return { isValid: false, errors, warnings };
    }
  }

  const conn = (sanitizedData || connection) as Connection;

  // Validate required fields
  if (!isNonEmptyString(conn.id)) {
    errors.push('Connection ID is required and must be a non-empty string');
  } else if (conn.id.length > MAX_TEXT_LENGTH.NAME * 2) {
    errors.push(`Connection ID is too long (max ${MAX_TEXT_LENGTH.NAME * 2} characters)`);
  }

  if (!conn.first_name || conn.first_name.length < MIN_TEXT_LENGTH.NAME) {
    errors.push('First name is required and must be at least 1 character');
  } else if (conn.first_name.length > MAX_TEXT_LENGTH.NAME) {
    errors.push(`First name is too long (max ${MAX_TEXT_LENGTH.NAME} characters)`);
  }

  if (!conn.last_name || conn.last_name.length < MIN_TEXT_LENGTH.NAME) {
    errors.push('Last name is required and must be at least 1 character');
  } else if (conn.last_name.length > MAX_TEXT_LENGTH.NAME) {
    errors.push(`Last name is too long (max ${MAX_TEXT_LENGTH.NAME} characters)`);
  }

  if (conn.position.length > MAX_TEXT_LENGTH.POSITION) {
    errors.push(`Position is too long (max ${MAX_TEXT_LENGTH.POSITION} characters)`);
  }

  if (conn.company.length > MAX_TEXT_LENGTH.COMPANY) {
    errors.push(`Company is too long (max ${MAX_TEXT_LENGTH.COMPANY} characters)`);
  }

  if (!isConnectionStatus(conn.status)) {
    errors.push('Invalid connection status');
  }

  // Validate optional fields
  if (conn.location && conn.location.length > MAX_TEXT_LENGTH.LOCATION) {
    warnings.push(`Location is too long (max ${MAX_TEXT_LENGTH.LOCATION} characters)`);
  }

  if (conn.headline && conn.headline.length > MAX_TEXT_LENGTH.HEADLINE) {
    warnings.push(`Headline is too long (max ${MAX_TEXT_LENGTH.HEADLINE} characters)`);
  }

  if (conn.recent_activity && conn.recent_activity.length > MAX_TEXT_LENGTH.SUMMARY) {
    warnings.push(`Recent activity is too long (max ${MAX_TEXT_LENGTH.SUMMARY} characters)`);
  }

  if (conn.last_action_summary && conn.last_action_summary.length > MAX_TEXT_LENGTH.SUMMARY) {
    warnings.push(`Last action summary is too long (max ${MAX_TEXT_LENGTH.SUMMARY} characters)`);
  }

  // Validate numeric fields
  if (conn.messages !== undefined) {
    if (!isValidNumber(conn.messages) || conn.messages < 0) {
      errors.push('Message count must be a non-negative number');
    }
  }

  if (conn.conversion_likelihood !== undefined) {
    if (!isValidNumber(conn.conversion_likelihood) || 
        conn.conversion_likelihood < CONVERSION_LIKELIHOOD_RANGE.MIN || 
        conn.conversion_likelihood > CONVERSION_LIKELIHOOD_RANGE.MAX) {
      errors.push(`Conversion likelihood must be between ${CONVERSION_LIKELIHOOD_RANGE.MIN} and ${CONVERSION_LIKELIHOOD_RANGE.MAX}`);
    }
  }

  // Validate date fields
  if (conn.date_added && !isValidISODate(conn.date_added)) {
    warnings.push('Date added is not a valid ISO date string');
  }

  // Validate URL fields
  if (conn.linkedin_url && !isValidUrl(conn.linkedin_url)) {
    warnings.push('LinkedIn URL is not a valid URL');
  }

  // Validate array fields
  if (conn.common_interests) {
    if (conn.common_interests.length > MAX_ARRAY_LENGTH.COMMON_INTERESTS) {
      warnings.push(`Too many common interests (max ${MAX_ARRAY_LENGTH.COMMON_INTERESTS})`);
    }
    
    conn.common_interests.forEach((interest, index) => {
      if (!isNonEmptyString(interest)) {
        errors.push(`Common interest at index ${index} must be a non-empty string`);
      } else if (interest.length > MAX_TEXT_LENGTH.TAG) {
        warnings.push(`Common interest "${interest}" is too long (max ${MAX_TEXT_LENGTH.TAG} characters)`);
      }
    });
  }

  if (conn.tags) {
    if (conn.tags.length > MAX_ARRAY_LENGTH.TAGS) {
      warnings.push(`Too many tags (max ${MAX_ARRAY_LENGTH.TAGS})`);
    }
    
    conn.tags.forEach((tag, index) => {
      if (!isNonEmptyString(tag)) {
        errors.push(`Tag at index ${index} must be a non-empty string`);
      } else if (tag.length > MAX_TEXT_LENGTH.TAG) {
        warnings.push(`Tag "${tag}" is too long (max ${MAX_TEXT_LENGTH.TAG} characters)`);
      }
    });
  }

  if (conn.message_history) {
    if (conn.message_history.length > MAX_ARRAY_LENGTH.MESSAGES) {
      warnings.push(`Too many messages in history (max ${MAX_ARRAY_LENGTH.MESSAGES})`);
    }
    
    conn.message_history.forEach((message, index) => {
      const messageValidation = validateMessage(message);
      if (!messageValidation.isValid) {
        errors.push(`Message at index ${index}: ${messageValidation.errors.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData: sanitizedData || undefined,
  };
}

/**
 * Validates a Message object
 * 
 * @param message - The message object to validate
 * @param options - Validation options
 * @returns Detailed validation result
 */
export function validateMessage(
  message: unknown,
  options: TransformOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitizedData: Partial<Message> | null = null;

  if (!isMessage(message)) {
    if (options.sanitize) {
      sanitizedData = sanitizeMessageData(message);
      if (sanitizedData && isMessage(sanitizedData)) {
        warnings.push('Message data was sanitized to fix validation issues');
      } else {
        errors.push('Unable to sanitize message data - invalid structure');
        return { isValid: false, errors, warnings };
      }
    } else {
      errors.push('Invalid message object structure');
      return { isValid: false, errors, warnings };
    }
  }

  const msg = (sanitizedData || message) as Message;

  // Validate required fields
  if (!isNonEmptyString(msg.id)) {
    errors.push('Message ID is required and must be a non-empty string');
  }

  if (!msg.content || msg.content.length < MIN_TEXT_LENGTH.MESSAGE_CONTENT) {
    errors.push('Message content is required and must be at least 1 character');
  } else if (msg.content.length > MAX_TEXT_LENGTH.MESSAGE_CONTENT) {
    errors.push(`Message content is too long (max ${MAX_TEXT_LENGTH.MESSAGE_CONTENT} characters)`);
  }

  if (!isValidISODate(msg.timestamp)) {
    errors.push('Message timestamp must be a valid ISO date string');
  }

  if (!isMessageSender(msg.sender)) {
    errors.push('Message sender must be either "user" or "connection"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData: sanitizedData || undefined,
  };
}

/**
 * Validates ConnectionFilters object
 * 
 * @param filters - The filters object to validate
 * @returns Detailed validation result
 */
export function validateConnectionFilters(filters: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isConnectionFilters(filters)) {
    errors.push('Invalid connection filters object structure');
    return { isValid: false, errors, warnings };
  }

  const f = filters as ConnectionFilters;

  // Validate status filter
  if (f.status !== undefined) {
    if (f.status !== 'all' && !isConnectionStatus(f.status)) {
      errors.push('Invalid status filter value');
    }
  }

  // Validate tags filter
  if (f.tags !== undefined) {
    if (f.tags.length > MAX_ARRAY_LENGTH.TAGS) {
      warnings.push(`Too many tag filters (max ${MAX_ARRAY_LENGTH.TAGS})`);
    }
    
    f.tags.forEach((tag, index) => {
      if (!isNonEmptyString(tag)) {
        errors.push(`Tag filter at index ${index} must be a non-empty string`);
      } else if (tag.length > MAX_TEXT_LENGTH.TAG) {
        warnings.push(`Tag filter "${tag}" is too long (max ${MAX_TEXT_LENGTH.TAG} characters)`);
      }
    });
  }

  // Validate text filters
  if (f.company && f.company.length > MAX_TEXT_LENGTH.COMPANY) {
    warnings.push(`Company filter is too long (max ${MAX_TEXT_LENGTH.COMPANY} characters)`);
  }

  if (f.location && f.location.length > MAX_TEXT_LENGTH.LOCATION) {
    warnings.push(`Location filter is too long (max ${MAX_TEXT_LENGTH.LOCATION} characters)`);
  }

  if (f.searchTerm && f.searchTerm.length > MAX_TEXT_LENGTH.SUMMARY) {
    warnings.push(`Search term is too long (max ${MAX_TEXT_LENGTH.SUMMARY} characters)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// DATA SANITIZATION FUNCTIONS
// =============================================================================

/**
 * Attempts to sanitize connection data to make it valid
 * 
 * @param data - Raw connection data
 * @returns Sanitized connection object or null if unsalvageable
 */
export function sanitizeConnectionData(data: unknown): Connection | null {
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;

  try {
    // Extract and sanitize required fields
    const id = sanitizeString(obj.id, 'unknown-connection');
    const first_name = sanitizeString(obj.first_name, 'Unknown');
    const last_name = sanitizeString(obj.last_name, '');
    const position = sanitizeString(obj.position, '');
    const company = sanitizeString(obj.company, '');
    const status = sanitizeConnectionStatus(obj.status);

    if (!status) return null; // Can't sanitize invalid status

    // Create base connection object
    const connection: Connection = {
      id: id.substring(0, MAX_TEXT_LENGTH.NAME * 2),
      first_name: first_name.substring(0, MAX_TEXT_LENGTH.NAME),
      last_name: last_name.substring(0, MAX_TEXT_LENGTH.NAME),
      position: position.substring(0, MAX_TEXT_LENGTH.POSITION),
      company: company.substring(0, MAX_TEXT_LENGTH.COMPANY),
      status,
    };

    // Add optional fields if they exist and are valid
    if (obj.location && typeof obj.location === 'string') {
      connection.location = obj.location.substring(0, MAX_TEXT_LENGTH.LOCATION);
    }

    if (obj.headline && typeof obj.headline === 'string') {
      connection.headline = obj.headline.substring(0, MAX_TEXT_LENGTH.HEADLINE);
    }

    if (obj.recent_activity && typeof obj.recent_activity === 'string') {
      connection.recent_activity = obj.recent_activity.substring(0, MAX_TEXT_LENGTH.SUMMARY);
    }

    if (obj.last_action_summary && typeof obj.last_action_summary === 'string') {
      connection.last_action_summary = obj.last_action_summary.substring(0, MAX_TEXT_LENGTH.SUMMARY);
    }

    if (obj.last_activity_summary && typeof obj.last_activity_summary === 'string') {
      connection.last_activity_summary = obj.last_activity_summary.substring(0, MAX_TEXT_LENGTH.SUMMARY);
    }

    // Sanitize numeric fields
    if (isValidNumber(obj.messages) && obj.messages >= 0) {
      connection.messages = Math.floor(obj.messages);
    }

    if (isValidNumber(obj.conversion_likelihood) && 
        obj.conversion_likelihood >= CONVERSION_LIKELIHOOD_RANGE.MIN && 
        obj.conversion_likelihood <= CONVERSION_LIKELIHOOD_RANGE.MAX) {
      connection.conversion_likelihood = obj.conversion_likelihood;
    }

    // Sanitize date fields
    if (typeof obj.date_added === 'string' && isValidISODate(obj.date_added)) {
      connection.date_added = obj.date_added;
    }

    // Sanitize URL fields
    if (typeof obj.linkedin_url === 'string' && isValidUrl(obj.linkedin_url)) {
      connection.linkedin_url = obj.linkedin_url;
    }

    // Sanitize boolean fields
    if (typeof obj.isFakeData === 'boolean') {
      connection.isFakeData = obj.isFakeData;
    }

    // Sanitize array fields
    if (Array.isArray(obj.common_interests)) {
      connection.common_interests = obj.common_interests
        .filter(item => typeof item === 'string' && item.length > 0)
        .map(item => (item as string).substring(0, MAX_TEXT_LENGTH.TAG))
        .slice(0, MAX_ARRAY_LENGTH.COMMON_INTERESTS);
    }

    if (Array.isArray(obj.tags)) {
      connection.tags = obj.tags
        .filter(item => typeof item === 'string' && item.length > 0)
        .map(item => (item as string).substring(0, MAX_TEXT_LENGTH.TAG))
        .slice(0, MAX_ARRAY_LENGTH.TAGS);
    }

    if (Array.isArray(obj.message_history)) {
      connection.message_history = obj.message_history
        .map(sanitizeMessageData)
        .filter((msg): msg is Message => msg !== null)
        .slice(0, MAX_ARRAY_LENGTH.MESSAGES);
    }

    return connection;
  } catch (error) {
    console.warn('Error sanitizing connection data:', error);
    return null;
  }
}

/**
 * Attempts to sanitize message data to make it valid
 * 
 * @param data - Raw message data
 * @returns Sanitized message object or null if unsalvageable
 */
export function sanitizeMessageData(data: unknown): Message | null {
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;

  try {
    const id = sanitizeString(obj.id, `msg-${Date.now()}`);
    const content = sanitizeString(obj.content, '');
    const timestamp = sanitizeTimestamp(obj.timestamp);
    const sender = sanitizeMessageSender(obj.sender);

    if (!content || !timestamp || !sender) return null;

    return {
      id,
      content: content.substring(0, MAX_TEXT_LENGTH.MESSAGE_CONTENT),
      timestamp,
      sender,
    };
  } catch (error) {
    console.warn('Error sanitizing message data:', error);
    return null;
  }
}

// =============================================================================
// HELPER SANITIZATION FUNCTIONS
// =============================================================================

/**
 * Sanitizes a string value with fallback
 * 
 * @param value - Value to sanitize
 * @param fallback - Fallback value if sanitization fails
 * @returns Sanitized string
 */
function sanitizeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.length > 0) {
    return value.trim();
  }
  return fallback;
}

/**
 * Sanitizes a connection status value
 * 
 * @param value - Value to sanitize
 * @returns Valid connection status or null
 */
function sanitizeConnectionStatus(value: unknown): ConnectionStatus | null {
  if (isConnectionStatus(value)) {
    return value;
  }
  
  // Try to map common variations
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    switch (normalized) {
      case 'new':
      case 'potential':
        return 'possible';
      case 'pending':
      case 'received':
        return 'incoming';
      case 'sent':
      case 'requested':
        return 'outgoing';
      case 'connected':
      case 'accepted':
        return 'allies';
      case 'removed':
      case 'ignored':
        return 'processed';
      default:
        return null;
    }
  }
  
  return null;
}

/**
 * Sanitizes a message sender value
 * 
 * @param value - Value to sanitize
 * @returns Valid message sender or null
 */
function sanitizeMessageSender(value: unknown): MessageSender | null {
  if (isMessageSender(value)) {
    return value;
  }
  
  // Try to map common variations
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (['user', 'me', 'self'].includes(normalized)) {
      return 'user';
    }
    if (['connection', 'contact', 'them', 'other'].includes(normalized)) {
      return 'connection';
    }
  }
  
  return null;
}

/**
 * Sanitizes a timestamp value
 * 
 * @param value - Value to sanitize
 * @returns Valid ISO timestamp or null
 */
function sanitizeTimestamp(value: unknown): string | null {
  if (typeof value === 'string' && isValidISODate(value)) {
    return value;
  }
  
  // Try to parse as Date
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // Try to parse as number (Unix timestamp)
  if (typeof value === 'number' && isFinite(value)) {
    try {
      return new Date(value).toISOString();
    } catch {
      return null;
    }
  }
  
  // Try to parse string as date
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Fall through to null
    }
  }
  
  return null;
}

// =============================================================================
// BATCH VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates an array of connections
 * 
 * @param connections - Array of connection objects to validate
 * @param options - Validation options
 * @returns Validation results for each connection
 */
export function validateConnections(
  connections: unknown[],
  options: TransformOptions = {}
): ValidationResult[] {
  return connections.map((connection, index) => {
    const result = validateConnection(connection, options);
    
    // Add index information to errors
    if (!result.isValid) {
      result.errors = result.errors.map(error => `Connection ${index}: ${error}`);
    }
    
    return result;
  });
}

/**
 * Validates an array of messages
 * 
 * @param messages - Array of message objects to validate
 * @param options - Validation options
 * @returns Validation results for each message
 */
export function validateMessages(
  messages: unknown[],
  options: TransformOptions = {}
): ValidationResult[] {
  return messages.map((message, index) => {
    const result = validateMessage(message, options);
    
    // Add index information to errors
    if (!result.isValid) {
      result.errors = result.errors.map(error => `Message ${index}: ${error}`);
    }
    
    return result;
  });
}

// =============================================================================
// PARAMETER VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates connection query parameters
 * 
 * @param params - Query parameters to validate
 * @returns Validation result
 */
export function validateConnectionQueryParams(params: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof params !== 'object' || params === null) {
    errors.push('Query parameters must be an object');
    return { isValid: false, errors, warnings };
  }

  const p = params as Record<string, unknown>;

  if (p.userId !== undefined && !isNonEmptyString(p.userId)) {
    errors.push('User ID must be a non-empty string');
  }

  if (p.status !== undefined && !isConnectionStatus(p.status)) {
    errors.push('Status must be a valid connection status');
  }

  if (p.limit !== undefined && !isPositiveInteger(p.limit)) {
    errors.push('Limit must be a positive integer');
  } else if (p.limit && (p.limit as number) > 1000) {
    warnings.push('Limit is very high, consider using pagination');
  }

  if (p.offset !== undefined && 
      !(typeof p.offset === 'string' || isValidNumber(p.offset))) {
    errors.push('Offset must be a string or number');
  }

  if (p.sortBy !== undefined && 
      !['date_added', 'name', 'company', 'status'].includes(p.sortBy as string)) {
    errors.push('Sort by must be one of: date_added, name, company, status');
  }

  if (p.sortOrder !== undefined && 
      !['asc', 'desc'].includes(p.sortOrder as string)) {
    errors.push('Sort order must be either "asc" or "desc"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates update connection parameters
 * 
 * @param params - Update parameters to validate
 * @returns Validation result
 */
export function validateUpdateConnectionParams(params: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof params !== 'object' || params === null) {
    errors.push('Update parameters must be an object');
    return { isValid: false, errors, warnings };
  }

  const p = params as Record<string, unknown>;

  if (!isNonEmptyString(p.connectionId)) {
    errors.push('Connection ID is required and must be a non-empty string');
  }

  if (typeof p.updates !== 'object' || p.updates === null) {
    errors.push('Updates must be an object');
  } else {
    const updates = p.updates as Record<string, unknown>;
    
    if (Object.keys(updates).length === 0) {
      warnings.push('No updates specified');
    }

    // Validate individual update fields
    if (updates.status !== undefined && !isConnectionStatus(updates.status)) {
      errors.push('Status update must be a valid connection status');
    }

    if (updates.tags !== undefined) {
      if (!Array.isArray(updates.tags)) {
        errors.push('Tags must be an array');
      } else if (!updates.tags.every(tag => typeof tag === 'string')) {
        errors.push('All tags must be strings');
      }
    }

    if (updates.last_action_summary !== undefined && 
        typeof updates.last_action_summary !== 'string') {
      errors.push('Last action summary must be a string');
    }

    if (updates.conversion_likelihood !== undefined) {
      if (!isValidNumber(updates.conversion_likelihood) ||
          updates.conversion_likelihood < CONVERSION_LIKELIHOOD_RANGE.MIN ||
          updates.conversion_likelihood > CONVERSION_LIKELIHOOD_RANGE.MAX) {
        errors.push(`Conversion likelihood must be between ${CONVERSION_LIKELIHOOD_RANGE.MIN} and ${CONVERSION_LIKELIHOOD_RANGE.MAX}`);
      }
    }
  }

  if (p.updateTimestamp !== undefined && typeof p.updateTimestamp !== 'boolean') {
    errors.push('Update timestamp flag must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}