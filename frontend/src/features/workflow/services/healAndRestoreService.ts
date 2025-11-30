import { puppeteerApiService } from '@/shared/services';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('HealAndRestoreService');

export interface HealAndRestoreSession {
  sessionId: string;
  timestamp: number;
  status: 'pending' | 'authorized' | 'cancelled' | 'completed';
}

export interface HealAndRestoreNotification {
  sessionId: string;
  message: string;
  timestamp: number;
}

class HealAndRestoreService {
  private eventSource: EventSource | null = null;
  private listeners: ((notification: HealAndRestoreNotification) => void)[] = [];
  private isPolling = false;
  // Temporarily unused but kept for future use
  // @ts-expect-error - Will be used when uncommenting line 65
  private isListening = false;
  private ignoredSessionIds: Set<string> = new Set();


  // Check if auto-approve is enabled for this session
  isAutoApproveEnabled(): boolean {
    return sessionStorage.getItem('autoApproveHealRestore') === 'true';
  }

  // Set auto-approve preference
  setAutoApprove(enabled: boolean): void {
    if (enabled) {
      sessionStorage.setItem('autoApproveHealRestore', 'true');
    } else {
      sessionStorage.removeItem('autoApproveHealRestore');
    }
  }

  // Send authorization to backend
  async authorizeHealAndRestore(sessionId: string, autoApprove: boolean = false): Promise<boolean> {
    try {
      const response = await puppeteerApiService.authorizeHealAndRestore(sessionId, autoApprove);
      // If we previously ignored this session due to cancel, remove from ignore set on authorize
      this.ignoredSessionIds.delete(sessionId);
      return response.success;
    } catch (error) {
      logger.error('Failed to authorize heal and restore', { error });
      return false;
    }
  }

  // Send cancel to backend and locally ignore this session so it won't re-trigger the modal
  async cancelHealAndRestore(sessionId: string): Promise<boolean> {
    try {
      this.ignoredSessionIds.add(sessionId);
      const response = await puppeteerApiService.cancelHealAndRestore(sessionId);
      return response.success;
    } catch (error) {
      logger.error('Failed to cancel heal and restore', { error });
      // Even if backend fails, keep ignoring this session locally to prevent UI loop
      return false;
    }
  }

  // Start listening for heal and restore notifications
  startListening(): void {
    // Polling not yet implemented
  }

  // Stop listening for notifications
  stopListening(): void {
  if (this.eventSource) {
    this.eventSource.close();
    this.eventSource = null;
    }
    this.isListening = false;
    this.isPolling = false;
  }

  // Add listener for heal and restore notifications
  addListener(callback: (notification: HealAndRestoreNotification) => void): void {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback: (notification: HealAndRestoreNotification) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners
  private notifyListeners(notification: HealAndRestoreNotification): void {
    this.listeners.forEach(listener => listener(notification));
  }

  // Simple polling implementation (can be replaced with WebSocket/SSE later)
  // @ts-expect-error - Reserved for future polling functionality
  private startPolling(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    const poll = async () => {
      try {
        const response = await puppeteerApiService.checkHealAndRestoreStatus();
        if (response.success && response.data?.pendingSession) {
          const notification: HealAndRestoreNotification = {
            sessionId: response.data.pendingSession.sessionId,
            message: 'Heal and restore authorization required',
            timestamp: Date.now(),
          };

          // Check if auto-approve is enabled
          if (this.isAutoApproveEnabled()) {
            // Automatically authorize
            await this.authorizeHealAndRestore(notification.sessionId, true);
          } else {
            // If this session was cancelled/ignored locally, do not notify again
            if (!this.ignoredSessionIds.has(notification.sessionId)) {
              this.notifyListeners(notification);
            }
          }
        }
      } catch (error) {
        logger.error('Error polling for heal and restore status', { error });
      }

      // Poll every 5 seconds
      setTimeout(poll, 5000);
    };

    poll();
  }
}

export const healAndRestoreService = new HealAndRestoreService();
export default healAndRestoreService;
