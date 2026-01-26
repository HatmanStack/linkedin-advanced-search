/**
 * Types for LinkedIn interaction workflows.
 */

/**
 * Result of sending a message.
 */
export interface MessageResult {
  /** Generated message ID */
  messageId: string;
  /** Delivery status */
  deliveryStatus: 'sent' | 'delivered' | 'pending' | 'failed';
  /** ISO timestamp when sent */
  sentAt: string;
  /** Recipient profile ID */
  recipientProfileId: string;
  /** User who sent the message */
  userId?: string;
  /** Message content length */
  messageLength?: number;
}

/**
 * Result of a connection request.
 */
export interface ConnectionResult {
  /** Generated request ID */
  requestId: string | null;
  /** Current connection status */
  status: ConnectionStatus;
  /** ISO timestamp when sent */
  sentAt: string;
  /** Target profile ID */
  profileId: string;
  /** Whether a personalized message was included */
  hasPersonalizedMessage: boolean;
  /** Whether confirmation was found */
  confirmationFound?: boolean;
}

/**
 * Connection status values.
 */
export type ConnectionStatus =
  | 'ally'        // Already connected (1st degree)
  | 'outgoing'    // Pending request sent by user
  | 'incoming'    // Pending request received
  | 'sent'        // Just sent in this operation
  | 'not_connected'
  | 'unknown';

/**
 * Result of creating a post.
 */
export interface PostResult {
  /** Generated post ID */
  postId: string;
  /** URL of the published post */
  postUrl: string | null;
  /** Publication status */
  publishStatus: 'published' | 'pending' | 'failed';
  /** ISO timestamp when published */
  publishedAt: string;
  /** Content length */
  contentLength?: number;
  /** Number of media attachments */
  mediaCount?: number;
}

/**
 * Media attachment for posts.
 */
export interface MediaAttachment {
  /** Type of media */
  type: 'image' | 'video' | 'document';
  /** Local file path */
  filePath?: string;
  /** Original filename */
  filename?: string;
}

/**
 * Result of following a profile.
 */
export interface FollowResult {
  /** Follow status */
  status: 'followed' | 'already_following' | 'pending' | 'failed';
  /** Target profile ID */
  profileId: string;
  /** ISO timestamp when followed */
  followedAt: string;
}

/**
 * Workflow step status.
 */
export interface WorkflowStep {
  /** Step identifier */
  step: string;
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'confirmed' | 'failed';
}

/**
 * Complete workflow result with steps.
 */
export interface WorkflowResult<T> {
  /** Workflow identifier */
  workflowId: string;
  /** Primary result data */
  result: T;
  /** Individual workflow steps */
  workflowSteps: WorkflowStep[];
}

/**
 * Validation result for workflow parameters.
 */
export interface WorkflowValidation {
  /** Whether parameters are valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Human behavior tracking interface (stub for removed functionality).
 */
export interface IHumanBehavior {
  checkAndApplyCooldown(): Promise<void>;
  simulateHumanMouseMovement(page: unknown, element: unknown): Promise<void>;
  recordAction(action: string, data?: Record<string, unknown>): void;
}
