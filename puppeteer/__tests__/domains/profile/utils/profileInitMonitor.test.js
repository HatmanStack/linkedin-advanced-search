import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { ProfileInitMonitor } from '../../../../src/domains/profile/utils/profileInitMonitor.js';
import { logger as mockLogger } from '../../../../src/shared/utils/logger.js';

describe('ProfileInitMonitor', () => {
  let monitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new ProfileInitMonitor();
  });

  describe('constructor', () => {
    it('should initialize with zero request counts', () => {
      expect(monitor.metrics.requests.total).toBe(0);
      expect(monitor.metrics.requests.successful).toBe(0);
      expect(monitor.metrics.requests.failed).toBe(0);
    });

    it('should initialize with zero connection counts', () => {
      expect(monitor.metrics.connections.processed).toBe(0);
      expect(monitor.metrics.connections.skipped).toBe(0);
      expect(monitor.metrics.connections.errors).toBe(0);
    });

    it('should initialize with empty active requests', () => {
      expect(monitor.activeRequests.size).toBe(0);
    });

    it('should initialize with empty error patterns', () => {
      expect(monitor.errorPatterns.size).toBe(0);
    });
  });

  describe('startRequest', () => {
    it('should add request to active requests', () => {
      monitor.startRequest('req-123');

      expect(monitor.activeRequests.has('req-123')).toBe(true);
    });

    it('should increment total requests', () => {
      monitor.startRequest('req-123');

      expect(monitor.metrics.requests.total).toBe(1);
    });

    it('should store context with request', () => {
      monitor.startRequest('req-123', { userId: 'user-1' });

      const request = monitor.activeRequests.get('req-123');
      expect(request.context).toEqual({ userId: 'user-1' });
    });

    it('should log request start', () => {
      monitor.startRequest('req-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Profile init monitoring: Request started',
        expect.objectContaining({ requestId: 'req-123' })
      );
    });
  });

  describe('recordSuccess', () => {
    beforeEach(() => {
      monitor.startRequest('req-123');
    });

    it('should increment successful requests', () => {
      monitor.recordSuccess('req-123', {});

      expect(monitor.metrics.requests.successful).toBe(1);
    });

    it('should remove request from active requests', () => {
      monitor.recordSuccess('req-123', {});

      expect(monitor.activeRequests.has('req-123')).toBe(false);
    });

    it('should track processed connections', () => {
      monitor.recordSuccess('req-123', { data: { processed: 10, skipped: 5, errors: 2 } });

      expect(monitor.metrics.connections.processed).toBe(10);
      expect(monitor.metrics.connections.skipped).toBe(5);
      expect(monitor.metrics.connections.errors).toBe(2);
    });

    it('should warn for unknown request ID', () => {
      monitor.recordSuccess('unknown-id', {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Profile init monitoring: Unknown request ID for success',
        expect.objectContaining({ requestId: 'unknown-id' })
      );
    });

    it('should log success with metrics', () => {
      monitor.recordSuccess('req-123', { data: { processed: 5 } });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Profile init monitoring: Request completed successfully',
        expect.objectContaining({
          requestId: 'req-123',
          processed: 5,
        })
      );
    });
  });

  describe('recordFailure', () => {
    beforeEach(() => {
      monitor.startRequest('req-123');
    });

    it('should increment failed requests', () => {
      monitor.recordFailure('req-123', new Error('Test error'), {});

      expect(monitor.metrics.requests.failed).toBe(1);
    });

    it('should remove request from active requests', () => {
      monitor.recordFailure('req-123', new Error('Test error'), {});

      expect(monitor.activeRequests.has('req-123')).toBe(false);
    });

    it('should track error by type', () => {
      monitor.recordFailure('req-123', new Error('Test'), { type: 'NetworkError' });

      expect(monitor.metrics.errors.byType.NetworkError).toBe(1);
    });

    it('should track error by category', () => {
      monitor.recordFailure('req-123', new Error('Test'), { category: 'browser' });

      expect(monitor.metrics.errors.byCategory.browser).toBe(1);
    });

    it('should increment recoverable error count', () => {
      monitor.recordFailure('req-123', new Error('Test'), { isRecoverable: true });

      expect(monitor.metrics.errors.recoverableCount).toBe(1);
    });

    it('should increment non-recoverable error count', () => {
      monitor.recordFailure('req-123', new Error('Test'), { isRecoverable: false });

      expect(monitor.metrics.errors.nonRecoverableCount).toBe(1);
    });

    it('should warn for unknown request ID', () => {
      monitor.recordFailure('unknown-id', new Error('Test'), {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Profile init monitoring: Unknown request ID for failure',
        expect.objectContaining({ requestId: 'unknown-id' })
      );
    });
  });

  describe('recordHealing', () => {
    beforeEach(() => {
      monitor.startRequest('req-123');
    });

    it('should increment healing request count', () => {
      monitor.recordHealing('req-123', {});

      expect(monitor.metrics.requests.healing).toBe(1);
    });

    it('should increment total healing attempts', () => {
      monitor.recordHealing('req-123', {});

      expect(monitor.metrics.healing.totalHealingAttempts).toBe(1);
    });

    it('should track healing attempts per request', () => {
      monitor.recordHealing('req-123', {});
      monitor.recordHealing('req-123', {});

      const request = monitor.activeRequests.get('req-123');
      expect(request.healingAttempts).toBe(2);
    });

    it('should update average recursion count', () => {
      monitor.recordHealing('req-123', { recursionCount: 2 });

      expect(monitor.metrics.healing.averageRecursionCount).toBe(2);
    });

    it('should log healing initiation', () => {
      monitor.recordHealing('req-123', { healPhase: 'link-collection', healReason: 'timeout' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Profile init monitoring: Healing initiated',
        expect.objectContaining({
          requestId: 'req-123',
          healPhase: 'link-collection',
          healReason: 'timeout',
        })
      );
    });
  });

  describe('recordConnection', () => {
    beforeEach(() => {
      monitor.startRequest('req-123');
    });

    it('should increment processed connections', () => {
      monitor.recordConnection('req-123', 'profile-456', 'processed', 100);

      expect(monitor.metrics.connections.processed).toBe(1);
    });

    it('should increment skipped connections', () => {
      monitor.recordConnection('req-123', 'profile-456', 'skipped', 0);

      expect(monitor.metrics.connections.skipped).toBe(1);
    });

    it('should increment error connections', () => {
      monitor.recordConnection('req-123', 'profile-456', 'errors', 0);

      expect(monitor.metrics.connections.errors).toBe(1);
    });

    it('should update request-level connection counts', () => {
      monitor.recordConnection('req-123', 'profile-456', 'processed', 100);

      const request = monitor.activeRequests.get('req-123');
      expect(request.connections.processed).toBe(1);
    });

    it('should log connection processing', () => {
      monitor.recordConnection('req-123', 'profile-456', 'processed', 100);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Profile init monitoring: Connection processed',
        expect.objectContaining({
          requestId: 'req-123',
          status: 'processed',
          duration: 100,
        })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return complete metrics object', () => {
      const metrics = monitor.getMetrics();

      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('healing');
      expect(metrics).toHaveProperty('activeRequests');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('failureRate');
      expect(metrics).toHaveProperty('timestamp');
    });

    it('should calculate success rate', () => {
      monitor.startRequest('req-1');
      monitor.recordSuccess('req-1', {});
      monitor.startRequest('req-2');
      monitor.recordSuccess('req-2', {});
      monitor.startRequest('req-3');
      monitor.recordFailure('req-3', new Error('Test'), {});

      const metrics = monitor.getMetrics();

      expect(parseFloat(metrics.successRate)).toBeCloseTo(66.67, 1);
    });

    it('should calculate failure rate', () => {
      monitor.startRequest('req-1');
      monitor.recordSuccess('req-1', {});
      monitor.startRequest('req-2');
      monitor.recordFailure('req-2', new Error('Test'), {});

      const metrics = monitor.getMetrics();

      expect(parseFloat(metrics.failureRate)).toBeCloseTo(50, 1);
    });

    it('should include active request count', () => {
      monitor.startRequest('req-1');
      monitor.startRequest('req-2');

      const metrics = monitor.getMetrics();

      expect(metrics.activeRequests).toBe(2);
    });
  });

  describe('logSummary', () => {
    it('should log summary', () => {
      monitor.startRequest('req-1');
      monitor.recordSuccess('req-1', { data: { processed: 5 } });

      monitor.logSummary();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Profile init monitoring summary',
        expect.objectContaining({
          requests: expect.any(Object),
          connections: expect.any(Object),
        })
      );
    });
  });

  describe('_getTopErrorPatterns', () => {
    it('should return top error patterns', () => {
      monitor.startRequest('req-1');
      monitor.recordFailure('req-1', new Error('Test'), { type: 'NetworkError', category: 'network' });
      monitor.startRequest('req-2');
      monitor.recordFailure('req-2', new Error('Test'), { type: 'NetworkError', category: 'network' });
      monitor.startRequest('req-3');
      monitor.recordFailure('req-3', new Error('Test'), { type: 'BrowserError', category: 'browser' });

      const patterns = monitor._getTopErrorPatterns();

      expect(patterns[0].pattern).toBe('NetworkError:network');
      expect(patterns[0].count).toBe(2);
    });

    it('should limit to top 5 patterns', () => {
      for (let i = 0; i < 10; i++) {
        monitor.startRequest(`req-${i}`);
        monitor.recordFailure(`req-${i}`, new Error('Test'), { type: `Error${i}`, category: 'test' });
      }

      const patterns = monitor._getTopErrorPatterns();

      expect(patterns.length).toBe(5);
    });
  });
});
