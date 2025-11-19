import { logger } from './logger.js';
import RandomHelpers from './randomHelpers.js';
import config from '../../shared/config/index.js';

/**
 * Human Behavior Manager - Tracks activity and manages human-like behavior patterns
 */
export class HumanBehaviorManager {
  constructor() {
    this.activityLog = [];
    this.suspiciousActivityDetected = false;
    this.lastCooldownTime = null;
    this.consecutiveActions = 0;
    this.sessionStartTime = new Date();
  }

  /**
   * Record an action in the activity log
   * @param {string} actionType - Type of action performed
   * @param {Object} metadata - Additional metadata about the action
   */
  recordAction(actionType, metadata = {}) {
    const actionRecord = {
      type: actionType,
      timestamp: new Date(),
      metadata,
      sessionTime: Date.now() - this.sessionStartTime.getTime()
    };

    this.activityLog.push(actionRecord);
    this.consecutiveActions++;

    // Keep only last 1000 actions to prevent memory issues
    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(-1000);
    }

    logger.debug(`Action recorded: ${actionType}`, {
      consecutiveActions: this.consecutiveActions,
      totalActions: this.activityLog.length
    });
  }

  /**
   * Check if cooling-off period is needed and apply it
   * @param {Object} customThresholds - Custom activity thresholds
   * @returns {Promise<Object>} Cooldown information
   */
  async checkAndApplyCooldown(customThresholds = {}) {
    const recentTimestamps = this.activityLog
      .slice(-100) // Check last 100 actions
      .map(action => action.timestamp);

    // Use configuration values for thresholds
    const thresholds = {
      actionsPerMinute: config.linkedinInteractions?.actionsPerMinute || 8,
      actionsPerHour: config.linkedinInteractions?.actionsPerHour || 100,
      ...customThresholds
    };

    const cooldownInfo = RandomHelpers.calculateCooldownNeeds(recentTimestamps, thresholds);

    if (cooldownInfo.needsCooldown) {
      // Use configuration values for cooldown duration
      const minDuration = config.linkedinInteractions?.cooldownMinDuration || 30000;
      const maxDuration = config.linkedinInteractions?.cooldownMaxDuration || 300000;
      
      // Override with configured duration if not already set
      if (!cooldownInfo.cooldownDuration || cooldownInfo.cooldownDuration < minDuration) {
        cooldownInfo.cooldownDuration = RandomHelpers.randomInRange(minDuration, maxDuration);
      }

      logger.info(`Applying cooldown: ${cooldownInfo.reason}`, {
        duration: cooldownInfo.cooldownDuration,
        consecutiveActions: this.consecutiveActions
      });

      this.lastCooldownTime = new Date();
      this.consecutiveActions = 0;

      // Apply the cooldown delay
      await new Promise(resolve => setTimeout(resolve, cooldownInfo.cooldownDuration));

      logger.info('Cooldown period completed');
    }

    return cooldownInfo;
  }

  /**
   * Detect suspicious activity patterns
   * @returns {Object} Suspicious activity analysis
   */
  detectSuspiciousActivity() {
    const now = new Date();
    const recentActions = this.activityLog.filter(
      action => now.getTime() - action.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const suspiciousPatterns = {
      tooFast: false,
      tooRegular: false,
      tooManyActions: false,
      unusualTiming: false
    };

    // Check for actions that are too fast
    if (recentActions.length >= 3) {
      const intervals = [];
      for (let i = 1; i < recentActions.length; i++) {
        const interval = recentActions[i].timestamp.getTime() - recentActions[i-1].timestamp.getTime();
        intervals.push(interval);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 500) { // Less than 500ms between actions
        suspiciousPatterns.tooFast = true;
      }

      // Check for too regular timing (robotic behavior)
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      
      if (variance < 10000) { // Very low variance indicates robotic timing
        suspiciousPatterns.tooRegular = true;
      }
    }

    // Check for too many actions in short time
    if (recentActions.length > 50) { // More than 50 actions in 5 minutes
      suspiciousPatterns.tooManyActions = true;
    }

    // Check for unusual timing patterns (e.g., actions at exact intervals)
    const exactIntervals = this.findExactIntervals(recentActions);
    if (exactIntervals.length > 3) {
      suspiciousPatterns.unusualTiming = true;
    }

    const isSuspicious = Object.values(suspiciousPatterns).some(pattern => pattern);
    
    if (isSuspicious && !this.suspiciousActivityDetected) {
      this.suspiciousActivityDetected = true;
      logger.warn('Suspicious activity patterns detected', suspiciousPatterns);
    } else if (!isSuspicious && this.suspiciousActivityDetected) {
      this.suspiciousActivityDetected = false;
      logger.info('Activity patterns normalized');
    }

    return {
      isSuspicious,
      patterns: suspiciousPatterns,
      recentActionCount: recentActions.length,
      recommendation: this.getSuspiciousActivityRecommendation(suspiciousPatterns)
    };
  }

  /**
   * Find actions that occur at exact intervals (suspicious)
   * @param {Array} actions - Array of action records
   * @returns {Array} Array of exact intervals found
   */
  findExactIntervals(actions) {
    const intervals = [];
    const exactIntervals = [];

    for (let i = 1; i < actions.length; i++) {
      const interval = actions[i].timestamp.getTime() - actions[i-1].timestamp.getTime();
      intervals.push(interval);
    }

    // Find intervals that repeat exactly
    const intervalCounts = {};
    intervals.forEach(interval => {
      intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
    });

    Object.entries(intervalCounts).forEach(([interval, count]) => {
      if (count >= 3) { // Same interval repeated 3+ times
        exactIntervals.push(parseInt(interval));
      }
    });

    return exactIntervals;
  }

  /**
   * Get recommendation based on suspicious activity patterns
   * @param {Object} patterns - Detected suspicious patterns
   * @returns {string} Recommendation text
   */
  getSuspiciousActivityRecommendation(patterns) {
    if (patterns.tooFast) {
      return 'Slow down interactions - add more delays between actions';
    }
    if (patterns.tooRegular) {
      return 'Add more randomness to timing patterns';
    }
    if (patterns.tooManyActions) {
      return 'Take a longer break - too many actions in short time';
    }
    if (patterns.unusualTiming) {
      return 'Vary timing patterns - avoid exact intervals';
    }
    return 'Activity patterns appear normal';
  }

  /**
   * Simulate human-like mouse movement to a target element
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Target element
   * @returns {Promise<void>}
   */
  async simulateHumanMouseMovement(page, element) {
    try {
      const viewport = await page.viewport();
      const elementBounds = await element.boundingBox();

      if (!elementBounds) {
        logger.debug('Element bounds not available, skipping mouse movement simulation');
        return;
      }

      const mousePath = RandomHelpers.generateMousePath(viewport, elementBounds);
      
      // Move mouse along the generated path
      for (let i = 0; i < mousePath.length; i++) {
        const point = mousePath[i];
        await page.mouse.move(point.x, point.y);
        
        // Small delay between mouse movements
        await RandomHelpers.humanLikeDelay('click');
      }

      // Record the mouse movement action
      this.recordAction('mouse_movement', {
        target: 'element',
        pathLength: mousePath.length
      });

    } catch (error) {
      logger.debug('Mouse movement simulation failed:', error.message);
    }
  }

  /**
   * Simulate human-like scrolling behavior
   * @param {Object} page - Puppeteer page object
   * @param {number} distance - Distance to scroll (positive = down, negative = up)
   * @returns {Promise<void>}
   */
  async simulateHumanScrolling(page, distance) {
    try {
      const direction = distance > 0 ? 'down' : 'up';
      const scrollPattern = RandomHelpers.generateScrollPattern(Math.abs(distance), direction);

      for (const scrollAction of scrollPattern) {
        if (scrollAction.delta !== 0) {
          await page.mouse.wheel({ deltaY: scrollAction.delta });
        }
        
        if (scrollAction.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, scrollAction.delay));
        }
      }

      // Record the scrolling action
      this.recordAction('scroll', {
        distance,
        direction,
        steps: scrollPattern.length
      });

    } catch (error) {
      logger.debug('Scrolling simulation failed:', error.message);
    }
  }

  /**
   * Simulate human-like typing with variable speed and patterns
   * @param {Object} page - Puppeteer page object
   * @param {string} text - Text to type
   * @param {Object} element - Target input element (optional)
   * @returns {Promise<void>}
   */
  async simulateHumanTyping(page, text, element = null) {
    try {
      // Focus on element if provided
      if (element) {
        await element.click();
        await RandomHelpers.humanLikeDelay('click');
      }

      const typingPattern = RandomHelpers.generateTypingPattern(text);
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const delay = typingPattern[i];

        await page.keyboard.type(char);
        
        if (i < text.length - 1) { // Don't delay after last character
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Occasional typo simulation (very rare)
        if (Math.random() < 0.01 && char !== ' ') { // 1% chance, not on spaces
          await this.simulateTypo(page, char);
        }
      }

      // Record the typing action
      this.recordAction('typing', {
        textLength: text.length,
        avgDelay: typingPattern.reduce((a, b) => a + b, 0) / typingPattern.length
      });

    } catch (error) {
      logger.debug('Human typing simulation failed:', error.message);
    }
  }

  /**
   * Simulate occasional typos and corrections
   * @param {Object} page - Puppeteer page object
   * @param {string} correctChar - The correct character that was typed
   * @returns {Promise<void>}
   */
  async simulateTypo(page, correctChar) {
    try {
      // Common typo patterns (adjacent keys, etc.)
      const typoChars = this.getTypoCharacters(correctChar);
      
      if (typoChars.length > 0) {
        const typoChar = typoChars[Math.floor(Math.random() * typoChars.length)];
        
        // Backspace to remove correct character
        await page.keyboard.press('Backspace');
        await RandomHelpers.humanLikeDelay('type');
        
        // Type wrong character
        await page.keyboard.type(typoChar);
        await RandomHelpers.humanLikeDelay('type');
        
        // Pause (realize mistake)
        await RandomHelpers.humanLikeDelay('think');
        
        // Backspace to remove typo
        await page.keyboard.press('Backspace');
        await RandomHelpers.humanLikeDelay('type');
        
        // Type correct character
        await page.keyboard.type(correctChar);
      }
    } catch (error) {
      logger.debug('Typo simulation failed:', error.message);
    }
  }

  /**
   * Get common typo characters for a given character
   * @param {string} char - Original character
   * @returns {Array<string>} Array of possible typo characters
   */
  getTypoCharacters(char) {
    const qwertyLayout = {
      'a': ['s', 'q', 'w'],
      's': ['a', 'd', 'w', 'e'],
      'd': ['s', 'f', 'e', 'r'],
      'f': ['d', 'g', 'r', 't'],
      'g': ['f', 'h', 't', 'y'],
      'h': ['g', 'j', 'y', 'u'],
      'j': ['h', 'k', 'u', 'i'],
      'k': ['j', 'l', 'i', 'o'],
      'l': ['k', 'o', 'p'],
      'q': ['w', 'a'],
      'w': ['q', 'e', 'a', 's'],
      'e': ['w', 'r', 's', 'd'],
      'r': ['e', 't', 'd', 'f'],
      't': ['r', 'y', 'f', 'g'],
      'y': ['t', 'u', 'g', 'h'],
      'u': ['y', 'i', 'h', 'j'],
      'i': ['u', 'o', 'j', 'k'],
      'o': ['i', 'p', 'k', 'l'],
      'p': ['o', 'l']
    };

    return qwertyLayout[char.toLowerCase()] || [];
  }

  /**
   * Simulate reading/scanning behavior before taking action
   * @param {string} content - Content being read
   * @param {Object} options - Reading options
   * @returns {Promise<void>}
   */
  async simulateReading(content, options = {}) {
    const readingTime = RandomHelpers.calculateReadingTime(
      content, 
      options.wordsPerMinute || 200
    );

    logger.debug(`Simulating reading time: ${readingTime}ms for ${content.length} characters`);

    // Break reading time into smaller chunks with occasional pauses
    const chunks = Math.ceil(readingTime / 3000); // 3-second chunks
    const chunkTime = readingTime / chunks;

    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, chunkTime));
      
      // Occasional longer pause (simulate re-reading or thinking)
      if (Math.random() < 0.2) { // 20% chance
        await RandomHelpers.humanLikeDelay('think');
      }
    }

    // Record the reading action
    this.recordAction('reading', {
      contentLength: content.length,
      readingTime,
      chunks
    });
  }

  /**
   * Get activity statistics
   * @returns {Object} Activity statistics
   */
  getActivityStats() {
    const now = new Date();
    const sessionDuration = now.getTime() - this.sessionStartTime.getTime();
    
    const recentActions = this.activityLog.filter(
      action => now.getTime() - action.timestamp.getTime() < 3600000 // Last hour
    );

    const actionTypes = {};
    this.activityLog.forEach(action => {
      actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
    });

    return {
      totalActions: this.activityLog.length,
      recentActions: recentActions.length,
      consecutiveActions: this.consecutiveActions,
      sessionDuration,
      actionTypes,
      lastCooldownTime: this.lastCooldownTime,
      suspiciousActivityDetected: this.suspiciousActivityDetected
    };
  }

  /**
   * Reset activity tracking (useful for new sessions)
   */
  resetActivity() {
    this.activityLog = [];
    this.suspiciousActivityDetected = false;
    this.lastCooldownTime = null;
    this.consecutiveActions = 0;
    this.sessionStartTime = new Date();
    
    logger.info('Activity tracking reset');
  }
}

export default HumanBehaviorManager;