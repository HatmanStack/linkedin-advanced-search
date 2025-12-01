import { logger } from '../../../shared/utils/logger.js';


export class LinkedInAuditLogger {
  
  
  static logInteractionAttempt(operation, context, requestId) {
    const auditData = {
      eventType: 'INTERACTION_ATTEMPT',
      operation,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      context: {
        ...context,
        messageContent: context.messageContent ? '[REDACTED]' : undefined,
        connectionMessage: context.connectionMessage ? '[REDACTED]' : undefined,
        content: context.content ? '[REDACTED]' : undefined
      }
    };

    logger.info('LinkedIn interaction attempt', auditData);
  }

  
  static logInteractionSuccess(operation, result, context, requestId) {
    const auditData = {
      eventType: 'INTERACTION_SUCCESS',
      operation,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      result: {
        ...result,
        duration: context.duration,
        attemptCount: context.attemptCount || 1
      },
      context: {
        profileId: context.profileId,
        recipientProfileId: context.recipientProfileId,
        contentLength: context.contentLength,
        hasMedia: context.hasMedia,
        hasMessage: context.hasMessage
      }
    };

    logger.info('LinkedIn interaction success', auditData);
  }

  
  static logInteractionFailure(operation, error, context, requestId) {
    const auditData = {
      eventType: 'INTERACTION_FAILURE',
      operation,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        category: context.errorCategory,
        code: context.errorCode,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      context: {
        profileId: context.profileId,
        recipientProfileId: context.recipientProfileId,
        attemptCount: context.attemptCount || 1,
        duration: context.duration
      }
    };

    logger.error('LinkedIn interaction failure', auditData);
  }

  
  static logRateLimitDetected(operation, context, requestId) {
    const auditData = {
      eventType: 'RATE_LIMIT_DETECTED',
      operation,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      rateLimitInfo: {
        retryAfter: context.retryAfter,
        attemptCount: context.attemptCount,
        recentInteractions: context.recentInteractions
      }
    };

    logger.warn('LinkedIn rate limiting detected', auditData);
  }

  
  static logSessionEvent(eventType, sessionInfo, requestId = null) {
    const auditData = {
      eventType: `SESSION_${eventType.toUpperCase()}`,
      requestId,
      timestamp: new Date().toISOString(),
      sessionInfo: {
        isActive: sessionInfo.isActive,
        isHealthy: sessionInfo.isHealthy,
        isAuthenticated: sessionInfo.isAuthenticated,
        sessionAge: sessionInfo.sessionAge,
        errorCount: sessionInfo.errorCount,
        memoryUsage: sessionInfo.memoryUsage
      }
    };

    const logLevel = eventType === 'crash' || eventType === 'error' ? 'error' : 'info';
    logger[logLevel](`LinkedIn session ${eventType}`, auditData);
  }

  
  static logAuthenticationEvent(eventType, context, requestId) {
    const auditData = {
      eventType: `AUTH_${eventType.toUpperCase()}`,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      authInfo: {
        jwtValid: context.jwtValid,
        linkedinAuthenticated: context.linkedinAuthenticated,
        sessionExpired: context.sessionExpired
      }
    };

    const logLevel = eventType === 'failure' || eventType === 'expired' ? 'warn' : 'info';
    logger[logLevel](`LinkedIn authentication ${eventType}`, auditData);
  }

  
  static logSuspiciousActivity(activityType, context, requestId) {
    const auditData = {
      eventType: 'SUSPICIOUS_ACTIVITY_DETECTED',
      activityType,
      requestId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      activityInfo: {
        interactionCount: context.interactionCount,
        timeWindow: context.timeWindow,
        patterns: context.patterns,
        riskLevel: context.riskLevel
      }
    };

    logger.warn('Suspicious activity detected', auditData);
  }

  
  static logHumanBehavior(behaviorType, context, requestId) {
    const auditData = {
      eventType: 'HUMAN_BEHAVIOR_SIMULATION',
      behaviorType,
      requestId,
      timestamp: new Date().toISOString(),
      behaviorInfo: {
        delay: context.delay,
        typingSpeed: context.typingSpeed,
        mouseMovement: context.mouseMovement,
        scrollPattern: context.scrollPattern
      }
    };

    logger.debug('Human behavior simulation', auditData);
  }

  
  static logRecoveryAttempt(recoveryType, context, requestId) {
    const auditData = {
      eventType: 'RECOVERY_ATTEMPT',
      recoveryType,
      requestId,
      timestamp: new Date().toISOString(),
      recoveryInfo: {
        originalError: context.originalError,
        attemptCount: context.attemptCount,
        recoveryActions: context.recoveryActions,
        success: context.success
      }
    };

    const logLevel = context.success ? 'info' : 'warn';
    logger[logLevel](`Recovery attempt ${context.success ? 'succeeded' : 'failed'}`, auditData);
  }

  
  static generateInteractionSummary(timeframe = 'last_hour') {
    const summary = {
      timeframe,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalInteractions: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        rateLimitEvents: 0,
        sessionCrashes: 0,
        averageResponseTime: 0
      },
      errorBreakdown: {
        authentication: 0,
        browser: 0,
        linkedin: 0,
        validation: 0,
        network: 0,
        system: 0
      },
      topErrors: [],
      recommendations: []
    };

    logger.info('Generated interaction summary', summary);
    return summary;
  }

  
  static logPerformanceMetrics(operation, duration, context, requestId) {
    const auditData = {
      eventType: 'PERFORMANCE_METRICS',
      operation,
      requestId,
      timestamp: new Date().toISOString(),
      performance: {
        duration,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        browserMetrics: context.browserMetrics
      }
    };

    const logLevel = duration > 30000 ? 'warn' : 'debug';
    logger[logLevel]('Performance metrics', auditData);
  }
}

export default LinkedInAuditLogger;
