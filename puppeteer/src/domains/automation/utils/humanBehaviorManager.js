import { logger } from '../../../shared/utils/logger.js';
import RandomHelpers from '../../../shared/utils/randomHelpers.js';
import config from '../../../../config/index.js';


export class HumanBehaviorManager {
  constructor() {
    this.activityLog = [];
    this.suspiciousActivityDetected = false;
    this.lastCooldownTime = null;
    this.consecutiveActions = 0;
    this.sessionStartTime = new Date();
  }

  
  recordAction(actionType, metadata = {}) {
    const actionRecord = {
      type: actionType,
      timestamp: new Date(),
      metadata,
      sessionTime: Date.now() - this.sessionStartTime.getTime()
    };

    this.activityLog.push(actionRecord);
    this.consecutiveActions++;

    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(-1000);
    }

    logger.debug(`Action recorded: ${actionType}`, {
      consecutiveActions: this.consecutiveActions,
      totalActions: this.activityLog.length
    });
  }

  
  async checkAndApplyCooldown(customThresholds = {}) {
    const recentTimestamps = this.activityLog
      .slice(-100)
      .map(action => action.timestamp);

    const thresholds = {
      actionsPerMinute: config.linkedinInteractions?.actionsPerMinute || 8,
      actionsPerHour: config.linkedinInteractions?.actionsPerHour || 100,
      ...customThresholds
    };

    const cooldownInfo = RandomHelpers.calculateCooldownNeeds(recentTimestamps, thresholds);

    if (cooldownInfo.needsCooldown) {
      const minDuration = config.linkedinInteractions?.cooldownMinDuration || 30000;
      const maxDuration = config.linkedinInteractions?.cooldownMaxDuration || 300000;
      
      if (!cooldownInfo.cooldownDuration || cooldownInfo.cooldownDuration < minDuration) {
        cooldownInfo.cooldownDuration = RandomHelpers.randomInRange(minDuration, maxDuration);
      }

      logger.info(`Applying cooldown: ${cooldownInfo.reason}`, {
        duration: cooldownInfo.cooldownDuration,
        consecutiveActions: this.consecutiveActions
      });

      this.lastCooldownTime = new Date();
      this.consecutiveActions = 0;

      await new Promise(resolve => setTimeout(resolve, cooldownInfo.cooldownDuration));

      logger.info('Cooldown period completed');
    }

    return cooldownInfo;
  }

  
  detectSuspiciousActivity() {
    const now = new Date();
    const recentActions = this.activityLog.filter(
      action => now.getTime() - action.timestamp.getTime() < 300000
    );

    const suspiciousPatterns = {
      tooFast: false,
      tooRegular: false,
      tooManyActions: false,
      unusualTiming: false
    };

    if (recentActions.length >= 3) {
      const intervals = [];
      for (let i = 1; i < recentActions.length; i++) {
        const interval = recentActions[i].timestamp.getTime() - recentActions[i-1].timestamp.getTime();
        intervals.push(interval);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval < 500) {
        suspiciousPatterns.tooFast = true;
      }

      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      
      if (variance < 10000) {
        suspiciousPatterns.tooRegular = true;
      }
    }

    if (recentActions.length > 50) {
      suspiciousPatterns.tooManyActions = true;
    }

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

  
  findExactIntervals(actions) {
    const intervals = [];
    const exactIntervals = [];

    for (let i = 1; i < actions.length; i++) {
      const interval = actions[i].timestamp.getTime() - actions[i-1].timestamp.getTime();
      intervals.push(interval);
    }

    const intervalCounts = {};
    intervals.forEach(interval => {
      intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
    });

    Object.entries(intervalCounts).forEach(([interval, count]) => {
      if (count >= 3) {
        exactIntervals.push(parseInt(interval));
      }
    });

    return exactIntervals;
  }

  
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

  
  async simulateHumanMouseMovement(page, element) {
    try {
      const viewport = await page.viewport();
      const elementBounds = await element.boundingBox();

      if (!elementBounds) {
        logger.debug('Element bounds not available, skipping mouse movement simulation');
        return;
      }

      const mousePath = RandomHelpers.generateMousePath(viewport, elementBounds);
      
      for (let i = 0; i < mousePath.length; i++) {
        const point = mousePath[i];
        await page.mouse.move(point.x, point.y);
        
        await RandomHelpers.humanLikeDelay('click');
      }

      this.recordAction('mouse_movement', {
        target: 'element',
        pathLength: mousePath.length
      });

    } catch (error) {
      logger.debug('Mouse movement simulation failed:', error.message);
    }
  }

  
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

      this.recordAction('scroll', {
        distance,
        direction,
        steps: scrollPattern.length
      });

    } catch (error) {
      logger.debug('Scrolling simulation failed:', error.message);
    }
  }

  
  async simulateHumanTyping(page, text, element = null) {
    try {
      if (element) {
        await element.click();
        await RandomHelpers.humanLikeDelay('click');
      }

      const typingPattern = RandomHelpers.generateTypingPattern(text);
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const delay = typingPattern[i];

        await page.keyboard.type(char);
        
        if (i < text.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (Math.random() < 0.01 && char !== ' ') {
          await this.simulateTypo(page, char);
        }
      }

      this.recordAction('typing', {
        textLength: text.length,
        avgDelay: typingPattern.reduce((a, b) => a + b, 0) / typingPattern.length
      });

    } catch (error) {
      logger.debug('Human typing simulation failed:', error.message);
    }
  }

  
  async simulateTypo(page, correctChar) {
    try {
      const typoChars = this.getTypoCharacters(correctChar);
      
      if (typoChars.length > 0) {
        const typoChar = typoChars[Math.floor(Math.random() * typoChars.length)];
        
        await page.keyboard.press('Backspace');
        await RandomHelpers.humanLikeDelay('type');
        
        await page.keyboard.type(typoChar);
        await RandomHelpers.humanLikeDelay('type');
        
        await RandomHelpers.humanLikeDelay('think');
        
        await page.keyboard.press('Backspace');
        await RandomHelpers.humanLikeDelay('type');
        
        await page.keyboard.type(correctChar);
      }
    } catch (error) {
      logger.debug('Typo simulation failed:', error.message);
    }
  }

  
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

  
  async simulateReading(content, options = {}) {
    const readingTime = RandomHelpers.calculateReadingTime(
      content, 
      options.wordsPerMinute || 200
    );

    logger.debug(`Simulating reading time: ${readingTime}ms for ${content.length} characters`);

    const chunks = Math.ceil(readingTime / 3000);
    const chunkTime = readingTime / chunks;

    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, chunkTime));
      
      if (Math.random() < 0.2) {
        await RandomHelpers.humanLikeDelay('think');
      }
    }

    this.recordAction('reading', {
      contentLength: content.length,
      readingTime,
      chunks
    });
  }

  
  getActivityStats() {
    const now = new Date();
    const sessionDuration = now.getTime() - this.sessionStartTime.getTime();
    
    const recentActions = this.activityLog.filter(
      action => now.getTime() - action.timestamp.getTime() < 3600000
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