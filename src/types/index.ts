/**
 * @fileoverview Comprehensive TypeScript interfaces and types for the Connection Management System
 * 
 * This file contains all the core types, interfaces, and utility types used throughout
 * the connection management system. It provides type safety for components, services,
 * and API interactions while maintaining consistency across the application.
 * 
 * @author Connection Management System
 * @version 1.0.0
 */

// =============================================================================
// CORE DATA INTERFACES
// =============================================================================

/**
 * Represents a LinkedIn connection with all associated metadata
 * 
 * @interface Connection
 * @description Core interface for connection data retrieved from DynamoDB.
 * Contains profile information, relationship status, and interaction history.
 */
export interface Connection {
  /** Unique identifier for the connection (base64 encoded LinkedIn URL) */
  id: string;
  
  /** First name of the connection */
  first_name: string;
  
  /** Last name of the connection */
  last_name: string;
  
  /** Current job position/title */
  position: string;
  
  /** Current company/organization */
  company: string;
  
  /** Geographic location (optional) */
  location?: string;
  
  /** LinkedIn headline/professional summary (optional) */
  headline?: string;
  
  /** Recent activity or summary text (optional) */
  recent_activity?: string;
  
  /** Array of common interests or skills (optional) */
  common_interests?: string[];
  
  /** Number of messages exchanged (optional) */
  messages?: number;
  
  /** Date when connection was added to system (ISO string, optional) */
  date_added?: string;
  
  /** Original LinkedIn profile URL (optional) */
  linkedin_url?: string;
  
  /** Array of tags for categorization (optional) */
  tags?: string[];
  
  /** Summary of last action taken with this connection (optional) */
  last_action_summary?: string;
  
  /** Alternative field for last activity summary (optional) */
  last_activity_summary?: string;
  
  /** Current relationship status with the connection */
  status: ConnectionStatus;
  
  /** Conversion likelihood percentage for 'possible' connections (0-100, optional) */
  conversion_likelihood?: number;
  
  /** Array of message history (optional) */
  message_history?: Message[];
  
  /** Flag indicating if this is demo/fake data (optional) */
  isFakeData?: boolean;
}

/**
 * Represents a message in the conversation history
 * 
 * @interface Message
 * @description Individual message within a connection's message history.
 * Contains content, metadata, and sender information.
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  
  /** Message content/text */
  content: string;
  
  /** Timestamp when message was sent (ISO string) */
  timestamp: string;
  
  /** Who sent the message */
  sender: MessageSender;
}

/**
 * Filter criteria for connection queries
 * 
 * @interface ConnectionFilters
 * @description Used to filter connections by various criteria in queries and UI components.
 */
export interface ConnectionFilters {
  /** Filter by connection status (optional) */
  status?: ConnectionStatus | 'all';
  
  /** Filter by specific tags (optional) */
  tags?: string[];
  
  /** Filter by company name (optional) */
  company?: string;
  
  /** Filter by location (optional) */
  location?: string;
  
  /** Search term for name/position/company (optional) */
  searchTerm?: string;
  
  /** Filter by conversion likelihood range (optional) */
  conversionLikelihoodRange?: {
    min: number;
    max: number;
  };
}

// =============================================================================
// ENUMS AND UNION TYPES
// =============================================================================

/**
 * Valid connection status values
 * 
 * @type ConnectionStatus
 * @description Represents the current relationship status between user and connection.
 * Maps to database status values and determines display behavior.
 */
export type ConnectionStatus = 
  | 'possible'   // Potential connection not yet contacted
  | 'incoming'   // Connection request received from them
  | 'outgoing'   // Connection request sent to them
  | 'allies'     // Established connection
  | 'processed'; // Removed from possible connections

/**
 * Message sender types
 * 
 * @type MessageSender
 * @description Identifies who sent a particular message in the conversation.
 */
export type MessageSender = 'user' | 'connection';

/**
 * Status picker filter values
 * 
 * @type StatusValue
 * @description Valid values for the status picker component filter.
 * Includes 'all' for showing all connection types.
 */
export type StatusValue = 'all' | 'incoming' | 'outgoing' | 'allies';

/**
 * Error severity levels
 * 
 * @type ErrorSeverity
 * @description Categorizes errors by their impact and urgency for user feedback.
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Toast notification variants
 * 
 * @type ToastVariant
 * @description Valid variants for toast notifications matching UI component expectations.
 */
export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning';

// =============================================================================
// API RESPONSE INTERFACES
// =============================================================================

/**
 * Standard API response wrapper from Lambda functions
 * 
 * @interface ApiResponse
 * @template T The type of the response body data
 * @description Wraps all API responses with consistent status and body structure.
 */
export interface ApiResponse<T = any> {
  /** HTTP status code */
  statusCode: number;
  
  /** Response payload */
  body: T;
  
  /** Optional error message for failed requests */
  error?: string;
}

/**
 * Response from get_connections_by_status operation
 * 
 * @interface GetConnectionsResponse
 * @description Structured response when fetching connections from the API.
 */
export interface GetConnectionsResponse {
  /** Array of connection objects */
  connections: Connection[];
  
  /** Total count of connections returned */
  count: number;
}

/**
 * Response from get_messages operation
 * 
 * @interface GetMessagesResponse
 * @description Structured response when fetching message history from the API.
 */
export interface GetMessagesResponse {
  /** Array of message objects */
  messages: Message[];
  
  /** Total count of messages returned */
  count: number;
}

/**
 * Response from update_metadata operation
 * 
 * @interface UpdateMetadataResponse
 * @description Structured response when updating connection metadata.
 */
export interface UpdateMetadataResponse {
  /** Whether the update was successful */
  success: boolean;
  
  /** Object containing the fields that were updated */
  updated: Record<string, any>;
}

// =============================================================================
// ERROR HANDLING INTERFACES
// =============================================================================

/**
 * Structured error information for API errors
 * 
 * @interface ApiErrorInfo
 * @description Contains all information needed to create an ApiError instance.
 */
export interface ApiErrorInfo {
  /** Human-readable error message */
  message: string;
  
  /** HTTP status code (optional) */
  status?: number;
  
  /** Error code identifier (optional) */
  code?: string;
}

/**
 * Enhanced error information for user feedback
 * 
 * @interface UserErrorInfo
 * @description Processed error information optimized for user display and interaction.
 */
export interface UserErrorInfo {
  /** User-friendly error message */
  userMessage: string;
  
  /** Technical error message for debugging */
  technicalMessage: string;
  
  /** Error severity level */
  severity: ErrorSeverity;
  
  /** Whether the error is retryable */
  retryable: boolean;
  
  /** Suggested recovery actions */
  recoveryActions: ErrorRecoveryAction[];
  
  /** Timestamp when error occurred */
  timestamp: string;
}

/**
 * Recovery action for error handling
 * 
 * @interface ErrorRecoveryAction
 * @description Defines an action users can take to recover from an error.
 */
export interface ErrorRecoveryAction {
  /** Display label for the action */
  label: string;
  
  /** Function to execute when action is triggered */
  action: () => void;
  
  /** Whether this is the primary/recommended action */
  primary?: boolean;
  
  /** Additional description of what the action does */
  description?: string;
}

// =============================================================================
// COMPONENT PROP INTERFACES
// =============================================================================

/**
 * Props for ConnectionCard component
 * 
 * @interface ConnectionCardProps
 * @description Type-safe props for the main connection card component.
 */
export interface ConnectionCardProps {
  /** Connection data to display */
  connection: Connection;
  
  /** Whether this card is currently selected */
  isSelected?: boolean;
  
  /** Whether this is a new connection card variant */
  isNewConnection?: boolean;
  
  /** Callback when card is selected */
  onSelect?: (connectionId: string) => void;
  
  /** Callback for new connection card clicks */
  onNewConnectionClick?: (connection: Connection) => void;
  
  /** Callback when a tag is clicked */
  onTagClick?: (tag: string) => void;
  
  /** Callback when message count is clicked */
  onMessageClick?: (connection: Connection) => void;
  
  /** Array of currently active/selected tags */
  activeTags?: string[];
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for NewConnectionCard component
 * 
 * @interface NewConnectionCardProps
 * @description Type-safe props for the simplified new connection card component.
 */
export interface NewConnectionCardProps {
  /** Connection data to display (must have status 'possible') */
  connection: Connection;
  
  /** Callback when remove button is clicked */
  onRemove?: (connectionId: string) => void;
  
  /** Callback when card is selected */
  onSelect?: (connection: Connection) => void;
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for StatusPicker component
 * 
 * @interface StatusPickerProps
 * @description Type-safe props for the connection status filter component.
 */
export interface StatusPickerProps {
  /** Currently selected status filter */
  selectedStatus: StatusValue;
  
  /** Callback when status selection changes */
  onStatusChange: (status: StatusValue) => void;
  
  /** Connection counts for each status type */
  connectionCounts: ConnectionCounts;
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Props for MessageModal component
 * 
 * @interface MessageModalProps
 * @description Type-safe props for the message history modal component.
 */
export interface MessageModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  
  /** Connection whose messages to display */
  connection: Connection;
  
  /** Callback to close the modal */
  onClose: () => void;
  
  /** Callback to send a new message (optional) */
  onSendMessage?: (message: string) => Promise<void>;
  
  /** Whether messages are currently loading */
  isLoadingMessages?: boolean;
  
  /** Error message if message loading failed */
  messagesError?: string | null;
  
  /** Callback to retry loading messages */
  onRetryLoadMessages?: () => void;
  
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// UTILITY AND HELPER INTERFACES
// =============================================================================

/**
 * Connection counts by status type
 * 
 * @interface ConnectionCounts
 * @description Aggregated counts of connections by their status for display in UI components.
 */
export interface ConnectionCounts {
  /** Number of incoming connection requests */
  incoming: number;
  
  /** Number of outgoing connection requests */
  outgoing: number;
  
  /** Number of established connections */
  allies: number;
  
  /** Total number of connections across all statuses */
  total: number;
  
  /** Number of possible connections (optional) */
  possible?: number;
}

/**
 * Status mapping configuration
 * 
 * @interface StatusMapping
 * @description Maps database status values to display configuration.
 */
export interface StatusMapping {
  /** Human-readable label */
  label: string;
  
  /** Icon component for the status */
  icon: React.ComponentType<{ className?: string }>;
  
  /** CSS classes for styling */
  className?: string;
  
  /** Color scheme identifier */
  color?: string;
}

/**
 * Virtual scrolling configuration
 * 
 * @interface VirtualScrollConfig
 * @description Configuration options for virtual scrolling implementation.
 */
export interface VirtualScrollConfig {
  /** Height of each item in pixels */
  itemHeight: number;
  
  /** Height of the scrolling container */
  containerHeight: number;
  
  /** Number of items to render outside viewport */
  overscanCount: number;
  
  /** Current scroll offset */
  scrollOffset?: number;
}

/**
 * Cache configuration for connection data
 * 
 * @interface CacheConfig
 * @description Configuration for LRU cache implementation.
 */
export interface CacheConfig {
  /** Maximum number of items to store in cache */
  maxSize: number;
  
  /** TTL for cached items in milliseconds */
  ttl?: number;
  
  /** Whether to enable cache statistics */
  enableStats?: boolean;
}

// =============================================================================
// GENERIC UTILITY TYPES
// =============================================================================

/**
 * Makes all properties of T optional recursively
 * 
 * @type DeepPartial
 * @template T The type to make partially optional
 * @description Utility type for creating partial versions of nested objects.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extracts the return type of a Promise
 * 
 * @type PromiseReturnType
 * @template T The Promise type to extract from
 * @description Utility type for extracting the resolved value type from Promise types.
 */
export type PromiseReturnType<T> = T extends Promise<infer R> ? R : never;

/**
 * Creates a type with required properties from T
 * 
 * @type RequiredFields
 * @template T The base type
 * @template K The keys to make required
 * @description Utility type for making specific fields required in an interface.
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Creates a type with optional properties from T
 * 
 * @type OptionalFields
 * @template T The base type
 * @template K The keys to make optional
 * @description Utility type for making specific fields optional in an interface.
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Function type for async operations with error handling
 * 
 * @type AsyncOperation
 * @template T The return type of the operation
 * @template P The parameters type
 * @description Standard signature for async operations in the system.
 */
export type AsyncOperation<T = void, P = void> = P extends void 
  ? () => Promise<T>
  : (params: P) => Promise<T>;

/**
 * Event handler function type
 * 
 * @type EventHandler
 * @template T The event data type
 * @description Standard signature for event handler functions.
 */
export type EventHandler<T = void> = T extends void 
  ? () => void 
  : (data: T) => void;

// =============================================================================
// DATABASE OPERATION TYPES
// =============================================================================

/**
 * Parameters for database connection queries
 * 
 * @interface ConnectionQueryParams
 * @description Parameters used when querying connections from the database.
 */
export interface ConnectionQueryParams {
  /** User ID to query connections for */
  userId?: string;
  
  /** Status filter for connections */
  status?: ConnectionStatus;
  
  /** Pagination limit */
  limit?: number;
  
  /** Pagination offset or cursor */
  offset?: string | number;
  
  /** Sort order */
  sortBy?: 'date_added' | 'name' | 'company' | 'status';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Parameters for updating connection metadata
 * 
 * @interface UpdateConnectionParams
 * @description Parameters used when updating connection information.
 */
export interface UpdateConnectionParams {
  /** Connection ID to update */
  connectionId: string;
  
  /** Fields to update */
  updates: Partial<Pick<Connection, 
    | 'status' 
    | 'tags' 
    | 'last_action_summary' 
    | 'conversion_likelihood'
  >>;
  
  /** Whether to update the timestamp */
  updateTimestamp?: boolean;
}

// =============================================================================
// VALIDATION AND TRANSFORMATION TYPES
// =============================================================================

/**
 * Validation result for data integrity checks
 * 
 * @interface ValidationResult
 * @description Result of data validation operations.
 */
export interface ValidationResult {
  /** Whether the data is valid */
  isValid: boolean;
  
  /** Array of validation error messages */
  errors: string[];
  
  /** Array of validation warnings */
  warnings?: string[];
  
  /** Sanitized/corrected data if applicable */
  sanitizedData?: any;
}

/**
 * Data transformation options
 * 
 * @interface TransformOptions
 * @description Options for data transformation operations.
 */
export interface TransformOptions {
  /** Whether to sanitize invalid data */
  sanitize?: boolean;
  
  /** Whether to provide fallback values */
  useFallbacks?: boolean;
  
  /** Whether to validate after transformation */
  validate?: boolean;
  
  /** Custom field mappings */
  fieldMappings?: Record<string, string>;
}

// =============================================================================
// EXPORTS
// =============================================================================

// Re-export commonly used types for convenience
export type {
  // Core interfaces
  Connection as ConnectionInterface,
  Message as MessageInterface,
  ConnectionFilters as ConnectionFiltersInterface,
  
  // Component props
  ConnectionCardProps as ConnectionCardPropsInterface,
  NewConnectionCardProps as NewConnectionCardPropsInterface,
  StatusPickerProps as StatusPickerPropsInterface,
  MessageModalProps as MessageModalPropsInterface,
  
  // API types
  ApiResponse as ApiResponseInterface,
  GetConnectionsResponse as GetConnectionsResponseInterface,
  GetMessagesResponse as GetMessagesResponseInterface,
  
  // Error types
  ApiErrorInfo as ApiErrorInfoInterface,
  UserErrorInfo as UserErrorInfoInterface,
  ErrorRecoveryAction as ErrorRecoveryActionInterface,
};

// Export type guards and validation functions will be added to utils
export * from './guards';
export * from './validators';