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
  private isListening = false;
  private ignoredSessionIds: Set<string> = new Set();
  private pollAttempts = 0;
  private readonly maxPollAttempts = 720; // 1 hour at 5-second intervals


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
    if (!this.isPolling) {
      this.startPolling();
    }
    this.isListening = true;
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

  // Poll for heal and restore status when SSE/WebSocket is unavailable
  private startPolling(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollAttempts = 0;

    const poll = async () => {
      // Stop polling if disabled or max attempts reached
      if (!this.isPolling || this.pollAttempts >= this.maxPollAttempts) {
        if (this.pollAttempts >= this.maxPollAttempts) {
          logger.warn('Max poll attempts reached, stopping heal and restore polling');
        }
        this.isPolling = false;
        return;
      }

      this.pollAttempts++;

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

      // Poll every 5 seconds if still active
      if (this.isPolling) {
        setTimeout(poll, 5000);
      }
    };

    poll();
  }
}

export const healAndRestoreService = new HealAndRestoreService();
export default healAndRestoreService;
