import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { LinkedInAuditLogger } from '../../../../src/domains/linkedin/utils/linkedinAuditLogger.js';
import { logger as mockLogger } from '../../../../src/shared/utils/logger.js';

describe('LinkedInAuditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logInteractionAttempt', () => {
    it('should log interaction attempt with redacted content', () => {
      const context = {
        userId: 'user-123',
        messageContent: 'Secret message',
        connectionMessage: 'Connection note',
        content: 'Post content',
      };

      LinkedInAuditLogger.logInteractionAttempt('sendMessage', context, 'req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LinkedIn interaction attempt',
        expect.objectContaining({
          eventType: 'INTERACTION_ATTEMPT',
          operation: 'sendMessage',
          requestId: 'req-123',
          userId: 'user-123',
        })
      );

      const logData = mockLogger.info.mock.calls[0][1];
      expect(logData.context.messageContent).toBe('[REDACTED]');
      expect(logData.context.connectionMessage).toBe('[REDACTED]');
      expect(logData.context.content).toBe('[REDACTED]');
    });

    it('should include timestamp in log', () => {
      LinkedInAuditLogger.logInteractionAttempt('addConnection', {}, 'req-123');

      const logData = mockLogger.info.mock.calls[0][1];
      expect(logData.timestamp).toBeDefined();
      expect(new Date(logData.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('logInteractionSuccess', () => {
    it('should log successful interaction', () => {
      const result = { id: 'result-123' };
      const context = {
        userId: 'user-123',
        profileId: 'profile-456',
        duration: 1500,
        attemptCount: 1,
      };

      LinkedInAuditLogger.logInteractionSuccess('sendMessage', result, context, 'req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LinkedIn interaction success',
        expect.objectContaining({
          eventType: 'INTERACTION_SUCCESS',
          operation: 'sendMessage',
          requestId: 'req-123',
          userId: 'user-123',
        })
      );

      const logData = mockLogger.info.mock.calls[0][1];
      expect(logData.result.duration).toBe(1500);
      expect(logData.result.attemptCount).toBe(1);
    });
  });

  describe('logInteractionFailure', () => {
    it('should log failed interaction', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user-123',
        profileId: 'profile-456',
        errorCategory: 'BROWSER',
        errorCode: 'BROWSER_CRASH',
      };

      LinkedInAuditLogger.logInteractionFailure('sendMessage', error, context, 'req-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'LinkedIn interaction failure',
        expect.objectContaining({
          eventType: 'INTERACTION_FAILURE',
          operation: 'sendMessage',
        })
      );

      const logData = mockLogger.error.mock.calls[0][1];
      expect(logData.error.message).toBe('Test error');
      expect(logData.error.category).toBe('BROWSER');
    });
  });

  describe('logRateLimitDetected', () => {
    it('should log rate limit detection', () => {
      const context = {
        userId: 'user-123',
        retryAfter: 300000,
        attemptCount: 3,
        recentInteractions: 50,
      };

      LinkedInAuditLogger.logRateLimitDetected('search', context, 'req-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LinkedIn rate limiting detected',
        expect.objectContaining({
          eventType: 'RATE_LIMIT_DETECTED',
          operation: 'search',
        })
      );

      const logData = mockLogger.warn.mock.calls[0][1];
      expect(logData.rateLimitInfo.retryAfter).toBe(300000);
    });
  });

  describe('logSessionEvent', () => {
    it('should log session start event as info', () => {
      const sessionInfo = {
        isActive: true,
        isHealthy: true,
        isAuthenticated: true,
        sessionAge: 0,
        errorCount: 0,
      };

      LinkedInAuditLogger.logSessionEvent('start', sessionInfo, 'req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LinkedIn session start',
        expect.objectContaining({
          eventType: 'SESSION_START',
        })
      );
    });

    it('should log session crash event as error', () => {
      const sessionInfo = {
        isActive: false,
        isHealthy: false,
        isAuthenticated: false,
        sessionAge: 3600000,
        errorCount: 5,
      };

      LinkedInAuditLogger.logSessionEvent('crash', sessionInfo, 'req-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'LinkedIn session crash',
        expect.objectContaining({
          eventType: 'SESSION_CRASH',
        })
      );
    });
  });

  describe('logAuthenticationEvent', () => {
    it('should log successful authentication as info', () => {
      const context = {
        userId: 'user-123',
        jwtValid: true,
        linkedinAuthenticated: true,
        sessionExpired: false,
      };

      LinkedInAuditLogger.logAuthenticationEvent('success', context, 'req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LinkedIn authentication success',
        expect.objectContaining({
          eventType: 'AUTH_SUCCESS',
        })
      );
    });

    it('should log failed authentication as warning', () => {
      const context = {
        userId: 'user-123',
        jwtValid: false,
        linkedinAuthenticated: false,
        sessionExpired: true,
      };

      LinkedInAuditLogger.logAuthenticationEvent('failure', context, 'req-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'LinkedIn authentication failure',
        expect.objectContaining({
          eventType: 'AUTH_FAILURE',
        })
      );
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity detection', () => {
      const context = {
        userId: 'user-123',
        interactionCount: 100,
        timeWindow: 60000,
        patterns: ['high_frequency', 'unusual_timing'],
        riskLevel: 'high',
      };

      LinkedInAuditLogger.logSuspiciousActivity('high_frequency', context, 'req-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Suspicious activity detected',
        expect.objectContaining({
          eventType: 'SUSPICIOUS_ACTIVITY_DETECTED',
          activityType: 'high_frequency',
        })
      );
    });
  });

  describe('logHumanBehavior', () => {
    it('should log human behavior simulation as debug', () => {
      const context = {
        delay: 2500,
        typingSpeed: 120,
        mouseMovement: { steps: 5 },
        scrollPattern: { direction: 'down' },
      };

      LinkedInAuditLogger.logHumanBehavior('typing', context, 'req-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Human behavior simulation',
        expect.objectContaining({
          eventType: 'HUMAN_BEHAVIOR_SIMULATION',
          behaviorType: 'typing',
        })
      );
    });
  });

  describe('logRecoveryAttempt', () => {
    it('should log successful recovery as info', () => {
      const context = {
        originalError: 'Browser crash',
        attemptCount: 2,
        recoveryActions: ['restart_browser'],
        success: true,
      };

      LinkedInAuditLogger.logRecoveryAttempt('browser_restart', context, 'req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Recovery attempt succeeded',
        expect.objectContaining({
          eventType: 'RECOVERY_ATTEMPT',
        })
      );
    });

    it('should log failed recovery as warning', () => {
      const context = {
        originalError: 'Browser crash',
        attemptCount: 3,
        recoveryActions: ['restart_browser'],
        success: false,
      };

      LinkedInAuditLogger.logRecoveryAttempt('browser_restart', context, 'req-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Recovery attempt failed',
        expect.objectContaining({
          eventType: 'RECOVERY_ATTEMPT',
        })
      );
    });
  });

  describe('generateInteractionSummary', () => {
    it('should return interaction summary structure', () => {
      const summary = LinkedInAuditLogger.generateInteractionSummary('last_hour');

      expect(summary.timeframe).toBe('last_hour');
      expect(summary.generatedAt).toBeDefined();
      expect(summary.metrics).toBeDefined();
      expect(summary.errorBreakdown).toBeDefined();
      expect(summary.topErrors).toBeDefined();
      expect(summary.recommendations).toBeDefined();
    });

    it('should use default timeframe if not provided', () => {
      const summary = LinkedInAuditLogger.generateInteractionSummary();

      expect(summary.timeframe).toBe('last_hour');
    });
  });

  describe('logPerformanceMetrics', () => {
    it('should log short operations as debug', () => {
      const context = {
        browserMetrics: { memoryUsage: 100000000 },
      };

      LinkedInAuditLogger.logPerformanceMetrics('search', 5000, context, 'req-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Performance metrics',
        expect.objectContaining({
          eventType: 'PERFORMANCE_METRICS',
          operation: 'search',
        })
      );
    });

    it('should log long operations as warning', () => {
      const context = {
        browserMetrics: { memoryUsage: 100000000 },
      };

      LinkedInAuditLogger.logPerformanceMetrics('search', 35000, context, 'req-123');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Performance metrics',
        expect.objectContaining({
          eventType: 'PERFORMANCE_METRICS',
        })
      );
    });
  });
});
