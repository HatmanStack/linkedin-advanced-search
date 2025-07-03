import { apiService } from './apiService';

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
      const response = await apiService.authorizeHealAndRestore(sessionId, autoApprove);
      return response.success;
    } catch (error) {
      console.error('Failed to authorize heal and restore:', error);
      return false;
    }
  }

  // Start listening for heal and restore notifications
  startListening(): void {
    if (this.eventSource) {
      return; // Already listening
    }

    // For now, we'll use polling instead of WebSocket/SSE for simplicity
    this.startPolling();
  }

  // Stop listening for notifications
  stopListening(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
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
  private startPolling(): void {
    const poll = async () => {
      try {
        const response = await apiService.checkHealAndRestoreStatus();
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
            // Notify listeners to show modal
            this.notifyListeners(notification);
          }
        }
      } catch (error) {
        console.error('Error polling for heal and restore status:', error);
      }

      // Poll every 5 seconds
      setTimeout(poll, 5000);
    };

    poll();
  }
}

export const healAndRestoreService = new HealAndRestoreService();
export default healAndRestoreService;
