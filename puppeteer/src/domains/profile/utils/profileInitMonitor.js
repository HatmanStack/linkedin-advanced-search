import { logger } from './logger.js';


export class ProfileInitMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        healing: 0
      },
      connections: {
        processed: 0,
        skipped: 0,
        errors: 0
      },
      performance: {
        averageRequestDuration: 0,
        averageConnectionProcessingTime: 0,
        totalProcessingTime: 0
      },
      errors: {
        byType: {},
        byCategory: {},
        recoverableCount: 0,
        nonRecoverableCount: 0
      },
      healing: {
        totalHealingAttempts: 0,
        successfulHealings: 0,
        failedHealings: 0,
        averageRecursionCount: 0
      }
    };
    
    this.activeRequests = new Map();
    this.errorPatterns = new Map();
  }

  
  startRequest(requestId, context = {}) {
    const requestData = {
      requestId,
      startTime: Date.now(),
      context,
      connections: {
        processed: 0,
        skipped: 0,
        errors: 0
      },
      errors: [],
      healingAttempts: 0
    };

    this.activeRequests.set(requestId, requestData);
    this.metrics.requests.total++;

    logger.info('Profile init monitoring: Request started', {
      requestId,
      totalRequests: this.metrics.requests.total,
      activeRequests: this.activeRequests.size,
      context
    });
  }

  
  recordSuccess(requestId, result = {}) {
    const requestData = this.activeRequests.get(requestId);
    if (!requestData) {
      logger.warn('Profile init monitoring: Unknown request ID for success', { requestId });
      return;
    }

    const duration = Date.now() - requestData.startTime;
    this.metrics.requests.successful++;
    
    if (result.data) {
      this.metrics.connections.processed += result.data.processed || 0;
      this.metrics.connections.skipped += result.data.skipped || 0;
      this.metrics.connections.errors += result.data.errors || 0;
    }

    this._updatePerformanceMetrics(duration);

    logger.info('Profile init monitoring: Request completed successfully', {
      requestId,
      duration,
      processed: result.data?.processed || 0,
      skipped: result.data?.skipped || 0,
      errors: result.data?.errors || 0,
      successRate: this._calculateSuccessRate(),
      averageDuration: this.metrics.performance.averageRequestDuration
    });

    this.activeRequests.delete(requestId);
  }

  
  recordFailure(requestId, error, errorDetails = {}) {
    const requestData = this.activeRequests.get(requestId);
    if (!requestData) {
      logger.warn('Profile init monitoring: Unknown request ID for failure', { requestId });
      return;
    }

    const duration = Date.now() - requestData.startTime;
    this.metrics.requests.failed++;

    this._trackErrorPattern(error, errorDetails);

    const errorType = errorDetails.type || 'UnknownError';
    const errorCategory = errorDetails.category || 'unknown';
    
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    this.metrics.errors.byCategory[errorCategory] = (this.metrics.errors.byCategory[errorCategory] || 0) + 1;
    
    if (errorDetails.isRecoverable) {
      this.metrics.errors.recoverableCount++;
    } else {
      this.metrics.errors.nonRecoverableCount++;
    }

    logger.error('Profile init monitoring: Request failed', {
      requestId,
      duration,
      errorType,
      errorCategory,
      isRecoverable: errorDetails.isRecoverable,
      message: error.message,
      totalFailures: this.metrics.requests.failed,
      failureRate: this._calculateFailureRate(),
      errorPatterns: this._getTopErrorPatterns()
    });

    this.activeRequests.delete(requestId);
  }

  
  recordHealing(requestId, healingContext = {}) {
    const requestData = this.activeRequests.get(requestId);
    if (requestData) {
      requestData.healingAttempts++;
    }

    this.metrics.requests.healing++;
    this.metrics.healing.totalHealingAttempts++;

    const recursionCount = healingContext.recursionCount || 0;
    this._updateAverageRecursionCount(recursionCount);

    logger.info('Profile init monitoring: Healing initiated', {
      requestId,
      recursionCount,
      healPhase: healingContext.healPhase,
      healReason: healingContext.healReason,
      totalHealingAttempts: this.metrics.healing.totalHealingAttempts,
      averageRecursionCount: this.metrics.healing.averageRecursionCount
    });
  }

  
  recordConnection(requestId, profileId, status, duration, details = {}) {
    const requestData = this.activeRequests.get(requestId);
    if (requestData) {
      requestData.connections[status]++;
    }

    this.metrics.connections[status]++;

    if (status === 'processed' && duration) {
      this._updateConnectionProcessingTime(duration);
    }

    logger.debug('Profile init monitoring: Connection processed', {
      requestId,
      profileId: profileId.substring(0, 8) + '...',
      status,
      duration,
      totalProcessed: this.metrics.connections.processed,
      totalSkipped: this.metrics.connections.skipped,
      totalErrors: this.metrics.connections.errors,
      details
    });
  }

  
  getMetrics() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests.size,
      successRate: this._calculateSuccessRate(),
      failureRate: this._calculateFailureRate(),
      healingSuccessRate: this._calculateHealingSuccessRate(),
      topErrorPatterns: this._getTopErrorPatterns(),
      timestamp: new Date().toISOString()
    };
  }

  
  logSummary() {
    const metrics = this.getMetrics();
    
    logger.info('Profile init monitoring summary', {
      requests: metrics.requests,
      connections: metrics.connections,
      performance: {
        averageRequestDuration: metrics.performance.averageRequestDuration,
        averageConnectionProcessingTime: metrics.performance.averageConnectionProcessingTime
      },
      errorSummary: {
        totalErrors: metrics.errors.recoverableCount + metrics.errors.nonRecoverableCount,
        recoverableErrors: metrics.errors.recoverableCount,
        nonRecoverableErrors: metrics.errors.nonRecoverableCount,
        topErrorTypes: Object.entries(metrics.errors.byType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
      },
      healing: metrics.healing,
      successRate: metrics.successRate,
      failureRate: metrics.failureRate,
      activeRequests: metrics.activeRequests
    });
  }

  
  _trackErrorPattern(error, errorDetails) {
    const pattern = `${errorDetails.type || 'Unknown'}:${errorDetails.category || 'unknown'}`;
    const count = this.errorPatterns.get(pattern) || 0;
    this.errorPatterns.set(pattern, count + 1);
  }

  
  _updatePerformanceMetrics(duration) {
    const totalRequests = this.metrics.requests.successful + this.metrics.requests.failed;
    const currentTotal = this.metrics.performance.averageRequestDuration * (totalRequests - 1);
    this.metrics.performance.averageRequestDuration = (currentTotal + duration) / totalRequests;
    this.metrics.performance.totalProcessingTime += duration;
  }

  
  _updateConnectionProcessingTime(duration) {
    const totalProcessed = this.metrics.connections.processed;
    const currentTotal = this.metrics.performance.averageConnectionProcessingTime * (totalProcessed - 1);
    this.metrics.performance.averageConnectionProcessingTime = (currentTotal + duration) / totalProcessed;
  }

  
  _updateAverageRecursionCount(recursionCount) {
    const totalAttempts = this.metrics.healing.totalHealingAttempts;
    const currentTotal = this.metrics.healing.averageRecursionCount * (totalAttempts - 1);
    this.metrics.healing.averageRecursionCount = (currentTotal + recursionCount) / totalAttempts;
  }

  
  _calculateSuccessRate() {
    const total = this.metrics.requests.successful + this.metrics.requests.failed;
    return total > 0 ? ((this.metrics.requests.successful / total) * 100).toFixed(2) : 0;
  }

  
  _calculateFailureRate() {
    const total = this.metrics.requests.successful + this.metrics.requests.failed;
    return total > 0 ? ((this.metrics.requests.failed / total) * 100).toFixed(2) : 0;
  }

  
  _calculateHealingSuccessRate() {
    const total = this.metrics.healing.successfulHealings + this.metrics.healing.failedHealings;
    return total > 0 ? ((this.metrics.healing.successfulHealings / total) * 100).toFixed(2) : 0;
  }

  
  _getTopErrorPatterns() {
    return Array.from(this.errorPatterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));
  }
}

export const profileInitMonitor = new ProfileInitMonitor();

setInterval(() => {
  profileInitMonitor.logSummary();
}, 5 * 60 * 1000);

export default ProfileInitMonitor;