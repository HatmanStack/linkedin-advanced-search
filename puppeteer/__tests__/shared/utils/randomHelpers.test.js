import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RandomHelpers } from '../../../src/shared/utils/randomHelpers.js';

describe('RandomHelpers', () => {
  describe('randomInRange', () => {
    it('should return a number within the specified range', () => {
      for (let i = 0; i < 100; i++) {
        const result = RandomHelpers.randomInRange(5, 10);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThanOrEqual(10);
      }
    });

    it('should return min when min equals max', () => {
      const result = RandomHelpers.randomInRange(5, 5);
      expect(result).toBe(5);
    });

    it('should return integer values', () => {
      for (let i = 0; i < 50; i++) {
        const result = RandomHelpers.randomInRange(1, 100);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle negative ranges', () => {
      for (let i = 0; i < 50; i++) {
        const result = RandomHelpers.randomInRange(-10, -5);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThanOrEqual(-5);
      }
    });
  });

  describe('randomDelay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return a promise', () => {
      const result = RandomHelpers.randomDelay(100, 200);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve after delay', async () => {
      const promise = RandomHelpers.randomDelay(100, 100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should use default values when no args provided', () => {
      const promise = RandomHelpers.randomDelay();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('shuffleArray', () => {
    it('should return an array of the same length', () => {
      const input = [1, 2, 3, 4, 5];
      const result = RandomHelpers.shuffleArray(input);
      expect(result.length).toBe(input.length);
    });

    it('should contain all original elements', () => {
      const input = [1, 2, 3, 4, 5];
      const result = RandomHelpers.shuffleArray(input);
      input.forEach(item => {
        expect(result).toContain(item);
      });
    });

    it('should not modify the original array', () => {
      const input = [1, 2, 3, 4, 5];
      const original = [...input];
      RandomHelpers.shuffleArray(input);
      expect(input).toEqual(original);
    });

    it('should handle empty arrays', () => {
      const result = RandomHelpers.shuffleArray([]);
      expect(result).toEqual([]);
    });

    it('should handle single-element arrays', () => {
      const result = RandomHelpers.shuffleArray([1]);
      expect(result).toEqual([1]);
    });
  });

  describe('getRandomUserAgent', () => {
    it('should return a string', () => {
      const result = RandomHelpers.getRandomUserAgent();
      expect(typeof result).toBe('string');
    });

    it('should return a valid user agent string', () => {
      const result = RandomHelpers.getRandomUserAgent();
      expect(result).toContain('Mozilla');
      expect(result).toContain('Chrome');
    });

    it('should return different user agents over multiple calls', () => {
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(RandomHelpers.getRandomUserAgent());
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('humanLikeDelay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return a promise', () => {
      const result = RandomHelpers.humanLikeDelay();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept different action types', () => {
      const actionTypes = ['click', 'type', 'scroll', 'navigate', 'think', 'default'];
      actionTypes.forEach(type => {
        expect(() => RandomHelpers.humanLikeDelay(type)).not.toThrow();
      });
    });

    it('should fall back to default for unknown action types', () => {
      expect(() => RandomHelpers.humanLikeDelay('unknown')).not.toThrow();
    });
  });

  describe('generateTypingPattern', () => {
    it('should return an array of delays for each character', () => {
      const text = 'hello';
      const result = RandomHelpers.generateTypingPattern(text);
      expect(result.length).toBe(text.length);
    });

    it('should return array of positive numbers', () => {
      const result = RandomHelpers.generateTypingPattern('test');
      result.forEach(delay => {
        expect(delay).toBeGreaterThan(0);
        expect(typeof delay).toBe('number');
      });
    });

    it('should handle empty string', () => {
      const result = RandomHelpers.generateTypingPattern('');
      expect(result).toEqual([]);
    });

    it('should handle special characters', () => {
      const result = RandomHelpers.generateTypingPattern('Hello, World! 123');
      expect(result.length).toBe(17);
    });
  });

  describe('generateMousePath', () => {
    it('should return an array of coordinates', () => {
      const viewport = { width: 1920, height: 1080 };
      const target = { x: 100, y: 200, width: 50, height: 30 };
      const result = RandomHelpers.generateMousePath(viewport, target);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return objects with x and y coordinates', () => {
      const viewport = { width: 1920, height: 1080 };
      const target = { x: 100, y: 200, width: 50, height: 30 };
      const result = RandomHelpers.generateMousePath(viewport, target);

      result.forEach(point => {
        expect(typeof point.x).toBe('number');
        expect(typeof point.y).toBe('number');
      });
    });

    it('should generate path ending near target', () => {
      const viewport = { width: 1920, height: 1080 };
      const target = { x: 100, y: 200, width: 50, height: 30 };
      const result = RandomHelpers.generateMousePath(viewport, target);

      const lastPoint = result[result.length - 1];
      const targetCenter = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2
      };

      expect(Math.abs(lastPoint.x - targetCenter.x)).toBeLessThan(100);
      expect(Math.abs(lastPoint.y - targetCenter.y)).toBeLessThan(100);
    });
  });

  describe('generateScrollPattern', () => {
    it('should return an array of scroll actions', () => {
      const result = RandomHelpers.generateScrollPattern(500);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return actions with delta and delay', () => {
      const result = RandomHelpers.generateScrollPattern(500);
      result.forEach(action => {
        expect(typeof action.delta).toBe('number');
        expect(typeof action.delay).toBe('number');
      });
    });

    it('should handle downward scrolling', () => {
      const result = RandomHelpers.generateScrollPattern(500, 'down');
      const nonPauseActions = result.filter(a => a.delta !== 0);
      nonPauseActions.forEach(action => {
        expect(action.delta).toBeGreaterThan(0);
      });
    });

    it('should handle upward scrolling', () => {
      const result = RandomHelpers.generateScrollPattern(500, 'up');
      const nonPauseActions = result.filter(a => a.delta !== 0);
      nonPauseActions.forEach(action => {
        expect(action.delta).toBeLessThan(0);
      });
    });

    it('should cover the total distance', () => {
      const totalDistance = 500;
      const result = RandomHelpers.generateScrollPattern(totalDistance, 'down');
      const totalScrolled = result.reduce((sum, action) => sum + Math.abs(action.delta), 0);
      expect(totalScrolled).toBeGreaterThanOrEqual(totalDistance);
    });
  });

  describe('calculateCooldownNeeds', () => {
    it('should return object with needsCooldown property', () => {
      const result = RandomHelpers.calculateCooldownNeeds([]);
      expect(typeof result.needsCooldown).toBe('boolean');
      expect(typeof result.cooldownDuration).toBe('number');
      expect(typeof result.reason).toBe('string');
    });

    it('should trigger cooldown for high minute activity', () => {
      const now = new Date();
      const recentActions = Array(15).fill(null).map(() => new Date(now.getTime() - 30000));
      const result = RandomHelpers.calculateCooldownNeeds(recentActions);
      expect(result.needsCooldown).toBe(true);
      expect(result.reason).toContain('minute');
    });

    it('should trigger cooldown for high hourly activity', () => {
      const now = new Date();
      const recentActions = Array(150).fill(null).map((_, i) =>
        new Date(now.getTime() - (i * 20000))
      );
      const result = RandomHelpers.calculateCooldownNeeds(recentActions);
      expect(result.needsCooldown).toBe(true);
    });

    it('should accept custom thresholds', () => {
      const now = new Date();
      const recentActions = Array(5).fill(null).map(() => new Date(now.getTime() - 30000));
      const result = RandomHelpers.calculateCooldownNeeds(recentActions, { actionsPerMinute: 3 });
      expect(result.needsCooldown).toBe(true);
    });

    it('should return cooldown duration when needed', () => {
      const now = new Date();
      const recentActions = Array(15).fill(null).map(() => new Date(now.getTime() - 30000));
      const result = RandomHelpers.calculateCooldownNeeds(recentActions);
      if (result.needsCooldown) {
        expect(result.cooldownDuration).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateReadingTime', () => {
    it('should return reading time in milliseconds', () => {
      const content = 'This is a test sentence with about ten words here.';
      const result = RandomHelpers.calculateReadingTime(content);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should increase with longer content', () => {
      const short = 'Short.';
      const long = 'This is a much longer piece of content that should take more time to read.';
      const shortTime = RandomHelpers.calculateReadingTime(short);
      const longTime = RandomHelpers.calculateReadingTime(long);
      expect(longTime).toBeGreaterThan(shortTime);
    });

    it('should cap at 30 seconds', () => {
      const veryLong = Array(1000).fill('word').join(' ');
      const result = RandomHelpers.calculateReadingTime(veryLong);
      expect(result).toBeLessThanOrEqual(30000);
    });

    it('should respect custom words per minute', () => {
      const content = Array(100).fill('word').join(' ');
      const fast = RandomHelpers.calculateReadingTime(content, 400);
      const slow = RandomHelpers.calculateReadingTime(content, 100);
      expect(slow).toBeGreaterThan(fast);
    });

    it('should return at least 1000ms', () => {
      const result = RandomHelpers.calculateReadingTime('hi');
      expect(result).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('generateViewportAdjustment', () => {
    it('should return null most of the time (98%)', () => {
      let nullCount = 0;
      for (let i = 0; i < 1000; i++) {
        const result = RandomHelpers.generateViewportAdjustment({ width: 1920, height: 1080 });
        if (result === null) nullCount++;
      }
      expect(nullCount).toBeGreaterThan(900);
    });

    it('should return adjustment object when not null', () => {
      let adjustment = null;
      for (let i = 0; i < 1000 && !adjustment; i++) {
        adjustment = RandomHelpers.generateViewportAdjustment({ width: 1920, height: 1080 });
      }

      // Ensure we actually found an adjustment to test
      expect(adjustment).not.toBeNull();
      expect(
        ('width' in adjustment && 'height' in adjustment) || 'zoom' in adjustment
      ).toBe(true);
    });

    it('should maintain minimum dimensions for resize', () => {
      let resizeFound = false;
      for (let i = 0; i < 5000 && !resizeFound; i++) {
        const result = RandomHelpers.generateViewportAdjustment({ width: 850, height: 650 });
        if (result && 'width' in result) {
          resizeFound = true;
          expect(result.width).toBeGreaterThanOrEqual(800);
          expect(result.height).toBeGreaterThanOrEqual(600);
        }
      }
      // Ensure we actually found a resize adjustment to test
      expect(resizeFound).toBe(true);
    });
  });
});
