import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../src/shared/utils/randomHelpers.js', () => ({
  default: {
    calculateCooldownNeeds: vi.fn().mockReturnValue({ needsCooldown: false, cooldownDuration: 0, reason: '' }),
    randomInRange: vi.fn().mockReturnValue(5000),
    generateMousePath: vi.fn().mockReturnValue([{ x: 100, y: 100 }]),
    humanLikeDelay: vi.fn().mockResolvedValue(undefined),
    generateScrollPattern: vi.fn().mockReturnValue([{ delta: 100, delay: 50 }]),
    generateTypingPattern: vi.fn().mockReturnValue([100, 100, 100]),
    calculateReadingTime: vi.fn().mockReturnValue(3000),
  },
}));

vi.mock('../../../../config/index.js', () => ({
  default: {
    linkedinInteractions: {
      actionsPerMinute: 8,
      actionsPerHour: 100,
      cooldownMinDuration: 30000,
      cooldownMaxDuration: 300000,
    },
  },
}));

import { HumanBehaviorManager } from '../../../../src/domains/automation/utils/humanBehaviorManager.js';

describe('HumanBehaviorManager', () => {
  let manager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new HumanBehaviorManager();
  });

  describe('constructor', () => {
    it('should initialize with empty activity log', () => {
      expect(manager.activityLog).toEqual([]);
    });

    it('should initialize with no suspicious activity', () => {
      expect(manager.suspiciousActivityDetected).toBe(false);
    });

    it('should initialize consecutiveActions to 0', () => {
      expect(manager.consecutiveActions).toBe(0);
    });

    it('should set session start time', () => {
      expect(manager.sessionStartTime).toBeInstanceOf(Date);
    });
  });

  describe('recordAction', () => {
    it('should add action to activity log', () => {
      manager.recordAction('click', { target: 'button' });

      expect(manager.activityLog).toHaveLength(1);
      expect(manager.activityLog[0].type).toBe('click');
      expect(manager.activityLog[0].metadata).toEqual({ target: 'button' });
    });

    it('should increment consecutive actions', () => {
      manager.recordAction('click');
      manager.recordAction('type');

      expect(manager.consecutiveActions).toBe(2);
    });

    it('should include timestamp', () => {
      manager.recordAction('scroll');

      expect(manager.activityLog[0].timestamp).toBeInstanceOf(Date);
    });

    it('should include session time', () => {
      manager.recordAction('navigate');

      expect(typeof manager.activityLog[0].sessionTime).toBe('number');
      expect(manager.activityLog[0].sessionTime).toBeGreaterThanOrEqual(0);
    });

    it('should trim activity log when exceeding 1000 entries', () => {
      for (let i = 0; i < 1010; i++) {
        manager.recordAction('action');
      }

      expect(manager.activityLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should return not suspicious for empty log', () => {
      const result = manager.detectSuspiciousActivity();

      expect(result.isSuspicious).toBe(false);
      expect(result.recentActionCount).toBe(0);
    });

    it('should return not suspicious for actions with varied intervals', () => {
      const now = Date.now();
      // Use varied, non-repeating intervals to avoid tooRegular detection
      manager.activityLog = [
        { timestamp: new Date(now - 120000), type: 'click' },
        { timestamp: new Date(now - 85000), type: 'scroll' },
        { timestamp: new Date(now - 40000), type: 'type' },
        { timestamp: new Date(now), type: 'navigate' },
      ];

      const result = manager.detectSuspiciousActivity();

      // Should not be too fast (intervals > 500ms)
      expect(result.patterns.tooFast).toBe(false);
    });

    it('should detect too fast actions', () => {
      const now = Date.now();
      manager.activityLog = [
        { timestamp: new Date(now - 200), type: 'click' },
        { timestamp: new Date(now - 100), type: 'click' },
        { timestamp: new Date(now), type: 'click' },
      ];

      const result = manager.detectSuspiciousActivity();

      expect(result.patterns.tooFast).toBe(true);
      expect(result.isSuspicious).toBe(true);
    });

    it('should detect too many actions', () => {
      const now = Date.now();
      manager.activityLog = Array(55).fill(null).map((_, i) => ({
        timestamp: new Date(now - i * 5000),
        type: 'click',
      }));

      const result = manager.detectSuspiciousActivity();

      expect(result.patterns.tooManyActions).toBe(true);
      expect(result.isSuspicious).toBe(true);
    });

    it('should include recommendation', () => {
      const result = manager.detectSuspiciousActivity();

      expect(result.recommendation).toBeDefined();
      expect(typeof result.recommendation).toBe('string');
    });
  });

  describe('findExactIntervals', () => {
    it('should find exact repeating intervals', () => {
      const now = Date.now();
      const actions = [
        { timestamp: new Date(now) },
        { timestamp: new Date(now + 1000) },
        { timestamp: new Date(now + 2000) },
        { timestamp: new Date(now + 3000) },
        { timestamp: new Date(now + 4000) },
      ];

      const result = manager.findExactIntervals(actions);

      expect(result).toContain(1000);
    });

    it('should return empty for varied intervals', () => {
      const now = Date.now();
      const actions = [
        { timestamp: new Date(now) },
        { timestamp: new Date(now + 1000) },
        { timestamp: new Date(now + 2500) },
        { timestamp: new Date(now + 5000) },
      ];

      const result = manager.findExactIntervals(actions);

      expect(result).toEqual([]);
    });
  });

  describe('getSuspiciousActivityRecommendation', () => {
    it('should return recommendation for tooFast', () => {
      const result = manager.getSuspiciousActivityRecommendation({ tooFast: true });
      expect(result).toContain('Slow down');
    });

    it('should return recommendation for tooRegular', () => {
      const result = manager.getSuspiciousActivityRecommendation({ tooRegular: true });
      expect(result).toContain('randomness');
    });

    it('should return recommendation for tooManyActions', () => {
      const result = manager.getSuspiciousActivityRecommendation({ tooManyActions: true });
      expect(result).toContain('break');
    });

    it('should return recommendation for unusualTiming', () => {
      const result = manager.getSuspiciousActivityRecommendation({ unusualTiming: true });
      expect(result).toContain('Vary timing');
    });

    it('should return normal message when no patterns', () => {
      const result = manager.getSuspiciousActivityRecommendation({});
      expect(result).toContain('normal');
    });
  });

  describe('getTypoCharacters', () => {
    it('should return adjacent keys for a', () => {
      const typos = manager.getTypoCharacters('a');
      expect(typos).toContain('s');
      expect(typos).toContain('q');
    });

    it('should return adjacent keys for uppercase letters', () => {
      const typos = manager.getTypoCharacters('A');
      expect(typos).toContain('s');
    });

    it('should return empty array for unknown characters', () => {
      const typos = manager.getTypoCharacters('1');
      expect(typos).toEqual([]);
    });

    it('should return empty array for special characters', () => {
      const typos = manager.getTypoCharacters('@');
      expect(typos).toEqual([]);
    });
  });

  describe('getActivityStats', () => {
    it('should return complete stats object', () => {
      manager.recordAction('click');
      manager.recordAction('scroll');

      const stats = manager.getActivityStats();

      expect(stats.totalActions).toBe(2);
      expect(stats.consecutiveActions).toBe(2);
      expect(stats.sessionDuration).toBeGreaterThanOrEqual(0);
      expect(stats.actionTypes).toBeDefined();
      expect(stats.actionTypes.click).toBe(1);
      expect(stats.actionTypes.scroll).toBe(1);
    });

    it('should track recent actions within last hour', () => {
      const now = Date.now();
      manager.activityLog = [
        { timestamp: new Date(now - 7200000), type: 'old' },
        { timestamp: new Date(now - 1800000), type: 'recent' },
        { timestamp: new Date(now), type: 'current' },
      ];

      const stats = manager.getActivityStats();

      expect(stats.recentActions).toBe(2);
    });

    it('should include suspicious activity status', () => {
      const stats = manager.getActivityStats();

      expect(stats.suspiciousActivityDetected).toBe(false);
    });
  });

  describe('resetActivity', () => {
    it('should clear activity log', () => {
      manager.recordAction('click');
      manager.recordAction('scroll');
      manager.resetActivity();

      expect(manager.activityLog).toEqual([]);
    });

    it('should reset consecutive actions', () => {
      manager.recordAction('click');
      manager.resetActivity();

      expect(manager.consecutiveActions).toBe(0);
    });

    it('should reset suspicious activity flag', () => {
      manager.suspiciousActivityDetected = true;
      manager.resetActivity();

      expect(manager.suspiciousActivityDetected).toBe(false);
    });

    it('should reset session start time', () => {
      const oldTime = manager.sessionStartTime;
      manager.resetActivity();

      expect(manager.sessionStartTime.getTime()).toBeGreaterThanOrEqual(oldTime.getTime());
    });

    it('should clear last cooldown time', () => {
      manager.lastCooldownTime = new Date();
      manager.resetActivity();

      expect(manager.lastCooldownTime).toBeNull();
    });
  });
});
