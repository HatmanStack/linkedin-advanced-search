/**
 * Error Types for Message Generation Workflow
 * Task 9: Comprehensive error handling and user feedback
 */

export interface ErrorRecoveryOptions {
  retry: boolean;           // Allow retry of failed operation
  skip: boolean;           // Skip current connection and continue
  stop: boolean;           // Stop entire process
  fallback: boolean;       // Use fallback message generation
}

export interface WorkflowError {
  type: 'network' | 'api' | 'validation' | 'authentication' | 'rate_limit' | 'unknown';
  message: string;
  connectionId?: string;
  connectionName?: string;
  recoveryOptions: ErrorRecoveryOptions;
  retryCount?: number;
  timestamp: string;
}

export interface ProgressState {
  current: number;
  total: number;
  currentConnectionName?: string;
  phase: 'preparing' | 'generating' | 'waiting_approval' | 'completed' | 'error';
  estimatedTimeRemaining?: number;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
  canCancel?: boolean;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface UserFeedback {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  severity: ErrorSeverity;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'destructive' | 'outline';
  }>;
}
