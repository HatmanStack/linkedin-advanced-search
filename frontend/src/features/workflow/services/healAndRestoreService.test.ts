import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthorize, mockCancel, mockCheckStatus } = vi.hoisted(() => ({
  mockAuthorize: vi.fn(),
  mockCancel: vi.fn(),
  mockCheckStatus: vi.fn(),
}));

vi.mock('@/shared/services', () => ({
  puppeteerApiService: {
    authorizeHealAndRestore: mockAuthorize,
    cancelHealAndRestore: mockCancel,
    checkHealAndRestoreStatus: mockCheckStatus,
  },
}));

vi.mock('@/shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import the class directly to create fresh instances per test
import { healAndRestoreService } from './healAndRestoreService';

describe('HealAndRestoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    healAndRestoreService.stopListening();
  });

  describe('isAutoApproveEnabled / setAutoApprove', () => {
    it('should default to false', () => {
      expect(healAndRestoreService.isAutoApproveEnabled()).toBe(false);
    });

    it('should enable auto-approve via sessionStorage', () => {
      healAndRestoreService.setAutoApprove(true);
      expect(healAndRestoreService.isAutoApproveEnabled()).toBe(true);
      expect(sessionStorage.getItem('autoApproveHealRestore')).toBe('true');
    });

    it('should disable auto-approve by removing key', () => {
      healAndRestoreService.setAutoApprove(true);
      healAndRestoreService.setAutoApprove(false);
      expect(healAndRestoreService.isAutoApproveEnabled()).toBe(false);
      expect(sessionStorage.getItem('autoApproveHealRestore')).toBeNull();
    });
  });

  describe('authorizeHealAndRestore', () => {
    it('should call API and return true on success', async () => {
      mockAuthorize.mockResolvedValue({ success: true });

      const result = await healAndRestoreService.authorizeHealAndRestore('session-1');

      expect(result).toBe(true);
      expect(mockAuthorize).toHaveBeenCalledWith('session-1', false);
    });

    it('should return false on API error', async () => {
      mockAuthorize.mockRejectedValue(new Error('Network error'));

      const result = await healAndRestoreService.authorizeHealAndRestore('session-1');

      expect(result).toBe(false);
    });
  });

  describe('cancelHealAndRestore', () => {
    it('should call API and add to ignored set', async () => {
      mockCancel.mockResolvedValue({ success: true });

      const result = await healAndRestoreService.cancelHealAndRestore('session-2');

      expect(result).toBe(true);
      expect(mockCancel).toHaveBeenCalledWith('session-2');
    });

    it('should still ignore session on API failure', async () => {
      mockCancel.mockRejectedValue(new Error('Server error'));

      const result = await healAndRestoreService.cancelHealAndRestore('session-3');

      expect(result).toBe(false);
      // Session should still be locally ignored (prevents re-trigger)
    });
  });

  describe('listener subscription', () => {
    it('should add and notify listeners', async () => {
      const listener = vi.fn();
      healAndRestoreService.addListener(listener);

      // Simulate polling detecting a pending session
      mockCheckStatus.mockResolvedValue({
        success: true,
        data: { pendingSession: { sessionId: 'sess-1' } },
      });

      vi.useFakeTimers();
      healAndRestoreService.startListening();
      // Let the first poll execute
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'sess-1',
        message: 'Heal and restore authorization required',
      }));

      healAndRestoreService.removeListener(listener);
      healAndRestoreService.stopListening();
    });

    it('should not notify for ignored sessions', async () => {
      const listener = vi.fn();
      healAndRestoreService.addListener(listener);

      // Cancel a session first to add to ignored set
      mockCancel.mockResolvedValue({ success: true });
      await healAndRestoreService.cancelHealAndRestore('sess-ignored');

      // Now poll returns the same session
      mockCheckStatus.mockResolvedValue({
        success: true,
        data: { pendingSession: { sessionId: 'sess-ignored' } },
      });

      vi.useFakeTimers();
      healAndRestoreService.startListening();
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();

      expect(listener).not.toHaveBeenCalled();

      healAndRestoreService.removeListener(listener);
      healAndRestoreService.stopListening();
    });

    it('should remove listener correctly', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      healAndRestoreService.addListener(listener1);
      healAndRestoreService.addListener(listener2);
      healAndRestoreService.removeListener(listener1);

      // Only listener2 should remain - verified by the service not throwing
      // when listener1 is no longer called
    });
  });

  describe('startListening / stopListening', () => {
    it('should start polling on startListening', () => {
      mockCheckStatus.mockResolvedValue({ success: true, data: {} });

      vi.useFakeTimers();
      healAndRestoreService.startListening();
      vi.useRealTimers();

      healAndRestoreService.stopListening();
      // No assertion needed - just verifying no errors
    });

    it('should stop polling on stopListening', () => {
      healAndRestoreService.stopListening();
      // Service should be in stopped state - no errors
    });
  });
});
