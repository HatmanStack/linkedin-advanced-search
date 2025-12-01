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

  // @ts-expect-error - Reserved for future SSE implementation
  private isListening = false;
  private ignoredSessionIds: Set<string> = new Set();


  isAutoApproveEnabled(): boolean {
    return sessionStorage.getItem('autoApproveHealRestore') === 'true';
  }

  setAutoApprove(enabled: boolean): void {
    if (enabled) {
      sessionStorage.setItem('autoApproveHealRestore', 'true');
    } else {
      sessionStorage.removeItem('autoApproveHealRestore');
    }
  }

  async authorizeHealAndRestore(sessionId: string, autoApprove: boolean = false): Promise<boolean> {
    try {
      const response = await puppeteerApiService.authorizeHealAndRestore(sessionId, autoApprove);
      this.ignoredSessionIds.delete(sessionId);
      return response.success;
    } catch (error) {
      logger.error('Failed to authorize heal and restore', { error });
      return false;
    }
  }

  async cancelHealAndRestore(sessionId: string): Promise<boolean> {
    try {
      this.ignoredSessionIds.add(sessionId);
      const response = await puppeteerApiService.cancelHealAndRestore(sessionId);
      return response.success;
    } catch (error) {
      logger.error('Failed to cancel heal and restore', { error });
      return false;
    }
  }

  startListening(): void {
  }

  stopListening(): void {
  if (this.eventSource) {
    this.eventSource.close();
    this.eventSource = null;
    }
    this.isListening = false;
    this.isPolling = false;
  }

  addListener(callback: (notification: HealAndRestoreNotification) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (notification: HealAndRestoreNotification) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners(notification: HealAndRestoreNotification): void {
    this.listeners.forEach(listener => listener(notification));
  }


  // @ts-expect-error - Reserved for future polling implementation
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

          if (this.isAutoApproveEnabled()) {
            await this.authorizeHealAndRestore(notification.sessionId, true);
          } else {
            if (!this.ignoredSessionIds.has(notification.sessionId)) {
              this.notifyListeners(notification);
            }
          }
        }
      } catch (error) {
        logger.error('Error polling for heal and restore status', { error });
      }

      setTimeout(poll, 5000);
    };

    poll();
  }
}

export const healAndRestoreService = new HealAndRestoreService();
export default healAndRestoreService;
