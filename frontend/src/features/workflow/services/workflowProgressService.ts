import type { Connection } from '@/shared/types/index';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('WorkflowProgressService');


export interface WorkflowProgressState {
  
  phase: 'idle' | 'preparing' | 'generating' | 'completed' | 'error' | 'stopped';
  
  currentConnection?: Connection;
  
  currentIndex: number;
  
  totalConnections: number;
  
  processedConnections: string[];
  
  failedConnections: string[];
  
  skippedConnections: string[];
  
  startTime?: number;
  
  estimatedTimeRemaining?: number;
  
  errorMessage?: string;
}


export interface WorkflowCompletionStats {
  
  totalProcessed: number;
  
  successful: number;
  
  failed: number;
  
  skipped: number;
  
  totalTime: number;
  
  successRate: number;
}


export type ProgressUpdateCallback = (state: WorkflowProgressState) => void;


export type CompletionCallback = (stats: WorkflowCompletionStats) => void;


export class WorkflowProgressService {
  private progressState: WorkflowProgressState;
  private progressCallbacks: ProgressUpdateCallback[] = [];
  private completionCallbacks: CompletionCallback[] = [];

  constructor() {
    this.progressState = this.getInitialState();
  }

  
  private getInitialState(): WorkflowProgressState {
    return {
      phase: 'idle',
      currentIndex: 0,
      totalConnections: 0,
      processedConnections: [],
      failedConnections: [],
      skippedConnections: [],
    };
  }

  
  initializeWorkflow(connections: Connection[]): void {
    this.progressState = {
      ...this.getInitialState(),
      phase: 'preparing',
      totalConnections: connections.length,
      startTime: Date.now(),
    };

    this.notifyProgressUpdate();
  }

  
  startProcessingConnection(connection: Connection, index: number): void {
    this.progressState = {
      ...this.progressState,
      phase: 'generating',
      currentConnection: connection,
      currentIndex: index,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(),
    };

    this.notifyProgressUpdate();
  }

  
  markConnectionSuccess(connectionId: string): void {
    this.progressState = {
      ...this.progressState,
      processedConnections: [...this.progressState.processedConnections, connectionId],
    };

    this.checkWorkflowCompletion();
  }

  
  markConnectionFailure(connectionId: string, errorMessage?: string): void {
    this.progressState = {
      ...this.progressState,
      failedConnections: [...this.progressState.failedConnections, connectionId],
      errorMessage,
    };

    this.checkWorkflowCompletion();
  }

  
  markConnectionSkipped(connectionId: string): void {
    this.progressState = {
      ...this.progressState,
      skippedConnections: [...this.progressState.skippedConnections, connectionId],
    };

    this.checkWorkflowCompletion();
  }

  
  stopWorkflow(): void {
    this.progressState = {
      ...this.progressState,
      phase: 'stopped',
      currentConnection: undefined,
      estimatedTimeRemaining: undefined,
    };

    this.notifyProgressUpdate();
  }

  
  resetWorkflow(): void {
    this.progressState = this.getInitialState();
    this.notifyProgressUpdate();
  }

  
  getProgressState(): WorkflowProgressState {
    return { ...this.progressState };
  }

  
  getCurrentConnectionName(): string | undefined {
    if (!this.progressState.currentConnection) {
      return undefined;
    }

    const { first_name, last_name } = this.progressState.currentConnection;
    return `${first_name} ${last_name}`;
  }

  
  getProgressPercentage(): number {
    if (this.progressState.totalConnections === 0) {
      return 0;
    }

    const completed = this.progressState.processedConnections.length +
      this.progressState.failedConnections.length +
      this.progressState.skippedConnections.length;

    return Math.round((completed / this.progressState.totalConnections) * 100);
  }

  
  isWorkflowActive(): boolean {
    return this.progressState.phase === 'generating' || this.progressState.phase === 'preparing';
  }

  
  isWorkflowCompleted(): boolean {
    return this.progressState.phase === 'completed';
  }

  
  hasWorkflowErrors(): boolean {
    return this.progressState.failedConnections.length > 0;
  }

  
  onProgressUpdate(callback: ProgressUpdateCallback): () => void {
    this.progressCallbacks.push(callback);

    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  
  onWorkflowComplete(callback: CompletionCallback): () => void {
    this.completionCallbacks.push(callback);

    return () => {
      const index = this.completionCallbacks.indexOf(callback);
      if (index > -1) {
        this.completionCallbacks.splice(index, 1);
      }
    };
  }

  
  private calculateEstimatedTimeRemaining(): number | undefined {
    if (!this.progressState.startTime) {
      return undefined;
    }

    const completedConnections = this.progressState.processedConnections.length +
      this.progressState.failedConnections.length +
      this.progressState.skippedConnections.length;

    if (completedConnections === 0) {
      return undefined;
    }

    const elapsed = Date.now() - this.progressState.startTime;
    const avgTimePerConnection = elapsed / completedConnections;
    const remaining = this.progressState.totalConnections - completedConnections;

    return Math.round((avgTimePerConnection * remaining) / 1000);
  }

  
  private checkWorkflowCompletion(): void {
    const totalProcessed = this.progressState.processedConnections.length +
      this.progressState.failedConnections.length +
      this.progressState.skippedConnections.length;

    if (totalProcessed >= this.progressState.totalConnections) {
      this.progressState = {
        ...this.progressState,
        phase: 'completed',
        currentConnection: undefined,
        estimatedTimeRemaining: undefined,
      };

      this.notifyProgressUpdate();
      this.notifyCompletion();
    } else {
      this.notifyProgressUpdate();
    }
  }

  
  private notifyProgressUpdate(): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(this.getProgressState());
      } catch (error) {
        logger.error('Error in progress update callback', { error });
      }
    });
  }

  
  private notifyCompletion(): void {
    const stats = this.getCompletionStats();

    this.completionCallbacks.forEach(callback => {
      try {
        callback(stats);
      } catch (error) {
        logger.error('Error in completion callback', { error });
      }
    });
  }

  
  private getCompletionStats(): WorkflowCompletionStats {
    const successful = this.progressState.processedConnections.length;
    const failed = this.progressState.failedConnections.length;
    const skipped = this.progressState.skippedConnections.length;
    const totalProcessed = successful + failed + skipped;

    const totalTime = this.progressState.startTime
      ? Math.round((Date.now() - this.progressState.startTime) / 1000)
      : 0;

    const successRate = totalProcessed > 0
      ? Math.round((successful / totalProcessed) * 100)
      : 0;

    return {
      totalProcessed,
      successful,
      failed,
      skipped,
      totalTime,
      successRate,
    };
  }
}


export const workflowProgressService = new WorkflowProgressService();

