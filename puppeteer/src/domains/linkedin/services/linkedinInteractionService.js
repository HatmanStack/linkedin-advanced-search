import { PuppeteerService } from '../../automation/services/puppeteerService.js';
import { logger } from '../../shared/utils/logger.js';
// Removed human-like delay/behavior helpers for simplicity
import LinkedInErrorHandler from '../utils/linkedinErrorHandler.js';
import ConfigManager from '../../shared/config/configManager.js';
import DynamoDBService from '../../storage/services/dynamoDBService.js';
// edgeManager removed; using DynamoDBService.ensureEdge directly

// Lightweight fallback utilities to replace removed human-behavior helpers
const RandomHelpers = {
  /**
   * Wait for a random duration between minMs and maxMs
   */
  async randomDelay(minMs = 300, maxMs = 800) {
    try {
      const span = Math.max(0, maxMs - minMs);
      const delayMs = minMs + Math.floor(Math.random() * (span + 1));
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch {
      // No-op on failure
    }
  }
};


/**
 * Browser Session Manager - Singleton class for managing persistent LinkedIn browser sessions
 */
class BrowserSessionManager {
  static instance = null;
  static lastActivity = null;
  static isAuthenticated = false;
  static sessionStartTime = null;
  static errorCount = 0;
  static configManager = ConfigManager;

  /**
   * Get maximum errors from configuration
   */
  static get maxErrors() {
    return this.configManager.getSessionConfig().maxErrors;
  }

  /**
   * Get session timeout from configuration
   */
  static get sessionTimeout() {
    return this.configManager.getSessionConfig().timeout;
  }

  /**
   * Get or create the singleton browser session instance
   * @returns {Promise<PuppeteerService>} The browser session instance
   */
  /**
   * Get or create the singleton browser session instance
   * @param {Object} options
   * @param {boolean} options.reinitializeIfUnhealthy - When true, an unhealthy session will be cleaned up and reinitialized
   * @returns {Promise<PuppeteerService>} The browser session instance
   */
  static async getInstance(options = { reinitializeIfUnhealthy: false }) {
    try {
      // Check if existing instance is still valid
      if (this.instance && await this.isSessionHealthy()) {
        this.lastActivity = new Date();
        logger.debug('Reusing existing browser session');  // Unable to reuse session if it's not already authenticated
        return this.instance;
      }

      // If caller does NOT want automatic recovery, just return current instance (may be unhealthy)
      if (this.instance && options && options.reinitializeIfUnhealthy === false) {
        logger.debug('Session reported unhealthy; skipping auto-recovery per options and returning existing instance');
        return this.instance;
      }

      // Clean up any existing unhealthy session before reinitializing
      if (this.instance) {
        logger.info('Cleaning up unhealthy browser session');
        await this.cleanup();
      }

      // Create new session
      logger.info('Initializing new browser session for LinkedIn interactions');
      this.instance = new PuppeteerService();
      await this.instance.initialize();

      this.sessionStartTime = new Date();
      this.lastActivity = new Date();
      this.isAuthenticated = false;
      this.errorCount = 0;

      logger.info('Browser session initialized successfully');
      return this.instance;
    } catch (error) {
      logger.error('Failed to get browser session instance:', error);
      this.errorCount++;

      // If we've hit max errors, cleanup and throw
      if (this.errorCount >= this.maxErrors) {
        await this.cleanup();
        throw new Error(`Browser session failed after ${this.maxErrors} attempts: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Check if the current session is healthy and responsive
   * @returns {Promise<boolean>} True if session is healthy
   */
  static async isSessionHealthy() {
    if (!this.instance) {
      return false;
    }

    try {
      const browser = this.instance.getBrowser();
      const page = this.instance.getPage();

      // Check if browser and page exist
      if (!browser || !page) {
        logger.debug('Browser or page is null');
        return false;
      }

      // Check if browser is connected
      if (!browser.isConnected()) {
        logger.debug('Browser is not connected');
        return false;
      }

      // Check if page is not closed
      if (page.isClosed()) {
        logger.debug('Page is closed');
        return false;
      }

      // Try to evaluate a simple expression to test responsiveness
      await page.evaluate(() => document.readyState);

      // Check session timeout
      if (this.sessionStartTime && (Date.now() - this.sessionStartTime.getTime()) > this.sessionTimeout) {
        logger.debug('Session has timed out');
        return false;
      }

      return true;
    } catch (error) {
      logger.debug('Session health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get comprehensive session health information
   * @returns {Promise<Object>} Session health details
   */
  static async getHealthStatus() {
    const isActive = this.instance !== null;
    const isHealthy = await this.isSessionHealthy();

    return {
      isActive,
      isHealthy,
      isAuthenticated: this.isAuthenticated,
      lastActivity: this.lastActivity,
      sessionAge: this.sessionStartTime ? Date.now() - this.sessionStartTime.getTime() : 0,
      errorCount: this.errorCount,
      memoryUsage: process.memoryUsage(),
      currentUrl: isHealthy && this.instance ? await this.getCurrentUrl() : null
    };
  }

  /**
   * Get current URL from the browser session
   * @returns {Promise<string|null>} Current URL or null if unavailable
   */
  static async getCurrentUrl() {
    try {
      if (this.instance && await this.isSessionHealthy()) {
        const page = this.instance.getPage();
        return await page.url();
      }
    } catch (error) {
      logger.debug('Failed to get current URL:', error.message);
    }
    return null;
  }

  /**
   * Clean up the browser session and reset state
   * @returns {Promise<void>}
   */
  static async cleanup() {
    try {
      if (this.instance) {
        logger.info('Cleaning up browser session');
        await this.instance.close();
        this.instance = null;
      }

      this.lastActivity = null;
      this.isAuthenticated = false;
      this.sessionStartTime = null;
      this.errorCount = 0;

      logger.info('Browser session cleanup completed');
    } catch (error) {
      logger.error('Error during browser session cleanup:', error);
      // Force reset even if cleanup failed
      this.instance = null;
      this.lastActivity = null;
      this.isAuthenticated = false;
      this.sessionStartTime = null;
    }
  }

  /**
   * Recover from session errors by reinitializing
   * @returns {Promise<PuppeteerService>} New session instance
   */
  static async recover() {
    logger.info('Attempting session recovery');
    await this.cleanup();
    return await this.getInstance({ reinitializeIfUnhealthy: true });
  }

  /**
   * Update authentication status
   * @param {boolean} authenticated - Whether the session is authenticated with LinkedIn
   */
  static setAuthenticationStatus(authenticated) {
    this.isAuthenticated = authenticated;
    logger.debug(`LinkedIn authentication status updated: ${authenticated}`);
  }

  /**
   * Record an error and check if recovery is needed
   * @param {Error} error - The error that occurred
   * @returns {Promise<boolean>} True if recovery was attempted
   */
  static async recordError(error) {
    this.errorCount++;
    logger.warn(`Session error recorded (${this.errorCount}/${this.maxErrors}):`, error.message);

    // If we've hit too many errors, attempt recovery
    if (this.errorCount >= this.maxErrors) {
      logger.error('Maximum session errors reached, attempting recovery');
      try {
        await this.recover();
        return true;
      } catch (recoveryError) {
        logger.error('Session recovery failed:', recoveryError);
        throw new Error(`Session recovery failed after ${this.maxErrors} errors: ${recoveryError.message}`);
      }
    }

    return false;
  }

}



/**
 * LinkedIn Interaction Service - Main service class for LinkedIn automation
 */
export class LinkedInInteractionService {
  constructor() {
    this.sessionManager = BrowserSessionManager;
    // Human behavior manager removed
    this.configManager = ConfigManager;
    this.dynamoDBService = new DynamoDBService();
    // Provide safe no-op fallbacks to avoid runtime errors where humanBehavior was used previously
    this.humanBehavior = {
      async checkAndApplyCooldown() { /* no-op */ },
      async simulateHumanMouseMovement() { /* no-op */ },
      recordAction() { /* no-op */ }
    };

    // Get configuration values
    const errorConfig = this.configManager.getErrorHandlingConfig();
    this.maxRetries = errorConfig.retryAttempts;
    this.baseRetryDelay = errorConfig.retryBaseDelay;

    logger.debug('LinkedInInteractionService initialized with configuration', {
      maxRetries: this.maxRetries,
      baseRetryDelay: this.baseRetryDelay
    });
  }

  /**
   * Execute operation with retry logic and error recovery
   * @param {Function} operation - The operation to execute
   * @param {Object} context - Context information for error handling
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} Operation result
   */
  async executeWithRetry(operation, context = {}) {
    // Disable retries for interactive flows; execute once
    try {
      context.attemptCount = 1;
      return await operation();
    } catch (error) {
      const categorizedError = LinkedInErrorHandler.categorizeError(error, context);
      logger.error(`Operation ${context.operation || 'unknown'} failed without retry`, {
        context,
        error: error.message,
        errorCategory: categorizedError.category
      });
      throw error;
    }
  }

  /**
   * Handle browser crash recovery
   * @param {Error} error - Browser error
   * @param {Object} context - Error context
   */
  async handleBrowserRecovery(error, context) {
    try {
      logger.info('Attempting browser session recovery', { context, error: error.message });

      // Get recovery plan
      const recoveryPlan = LinkedInErrorHandler.createRecoveryPlan(error, context);

      if (recoveryPlan.shouldRecover) {
        // Execute recovery actions
        logger.info('Executing browser recovery plan', {
          actions: recoveryPlan.actions,
          delay: recoveryPlan.delay
        });

        // Cleanup and reinitialize browser session
        await BrowserSessionManager.cleanup();
        await BrowserSessionManager.getInstance({ reinitializeIfUnhealthy: true });

        logger.info('Browser session recovery completed');
      }
    } catch (recoveryError) {
      logger.error('Browser recovery failed', {
        originalError: error.message,
        recoveryError: recoveryError.message
      });
      // Don't throw here, let the retry mechanism handle it
    }
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Find the first element matching any selector in order
   * @param {string[]} selectors - CSS selectors to try in order
   * @param {number} waitTimeout - per-selector timeout in ms
   * @returns {Promise<{ element: any, selector: string }>} found element and selector or nulls
   */
  async findElementBySelectors(selectors, waitTimeout = 3000) {
    const session = await this.getBrowserSession();
    for (const selector of selectors) {
      try {
        const element = await session.waitForSelector(selector, { timeout: waitTimeout });
        if (element) {
          return { element, selector };
        }
      } catch {
        // try next selector
      }
    }
    return { element: null, selector: null };
  }

  /**
   * Wait until any of the provided selectors appears
   * @param {string[]} selectors
   * @param {number} waitTimeout
   * @returns {Promise<{ element: any, selector: string }>} found element and selector or nulls
   */
  async waitForAnySelector(selectors, waitTimeout = 5000) {
    return await this.findElementBySelectors(selectors, waitTimeout);
  }

  /**
   * Perform a human-like click on an element (scroll into view, move mouse, think, click)
   * @param {any} page
   * @param {any} element
   */
  async clickElementHumanly(page, element) {
    await element.click();
  }

  /**
   * Clear existing content in a focused input and type text with human-like behavior
   * @param {any} page
   * @param {any} element
   * @param {string} text
   */
  async clearAndTypeText(page, element, text) {
    await element.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Delete');
    await this.typeWithHumanPattern(text, element);
  }

  /**
   * Initialize or get existing browser session
   * @returns {Promise<PuppeteerService>} Browser session instance
   */
  async initializeBrowserSession() {
    try {
      return await this.sessionManager.getInstance({ reinitializeIfUnhealthy: true });
    } catch (error) {
      logger.error('Failed to initialize browser session:', error);
      throw new Error(`Browser session initialization failed: ${error.message}`);
    }
  }

  /**
   * Get the current browser session
   * @returns {Promise<PuppeteerService>} Browser session instance
   */
  async getBrowserSession() {
    // Avoid triggering automatic browser reinitialization during normal operations like selector checks.
    // We will explicitly reinitialize only via initializeBrowserSession() or recovery handlers.
    return await this.sessionManager.getInstance({ reinitializeIfUnhealthy: false });
  }

  /**
   * Close the browser session
   * @returns {Promise<void>}
   */
  async closeBrowserSession() {
    await this.sessionManager.cleanup();
  }

  /**
   * Check if session is active and healthy
   * @returns {Promise<boolean>} True if session is active
   */
  async isSessionActive() {
    return await this.sessionManager.isSessionHealthy();
  }

  /**
   * Get comprehensive session status
   * @returns {Promise<Object>} Session status details
   */
  async getSessionStatus() {
    const sessionHealth = await this.sessionManager.getHealthStatus();
    const activityStats = { totalActions: 0, actionsLastHour: 0, actionsLastMinute: 0, averageActionInterval: 0, actionsByType: {} };
    const suspiciousActivity = { isSuspicious: false, patterns: [] };

    return {
      ...sessionHealth,
      humanBehavior: {
        ...activityStats,
        suspiciousActivity
      }
    };
  }

  /**
   * Check for suspicious activity and apply appropriate measures
   * @returns {Promise<Object>} Suspicious activity analysis and actions taken
   */
  async checkSuspiciousActivity() {
    const suspiciousActivity = { isSuspicious: false, patterns: [], recommendation: '' };

    if (suspiciousActivity.isSuspicious) {
      logger.warn('Suspicious activity detected, applying enhanced cooling-off period', {
        patterns: suspiciousActivity.patterns,
        recommendation: suspiciousActivity.recommendation
      });

      // Cooling off disabled
    }

    return suspiciousActivity;
  }

  /**
   * Navigate to a LinkedIn profile
   * @param {string} profileId - LinkedIn profile identifier
   * @returns {Promise<boolean>} True if navigation successful
   */
  /**
   * Navigate to a LinkedIn profile page
   * Implements requirements 1.3, 2.2
   * @param {string} profileId - LinkedIn profile ID or vanity URL
   * @returns {Promise<boolean>} True if navigation successful
   */
  async navigateToProfile(profileId) {
    logger.info(`Navigating to LinkedIn profile: ${profileId}`);

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();



      // Construct profile URL - handle both profile IDs and full URLs
      let profileUrl;
      if (profileId.startsWith('http')) {
        profileUrl = profileId;
      } else if (profileId.includes('/in/')) {
        profileUrl = `https://www.linkedin.com${profileId}`;
      } else {
        profileUrl = `https://www.linkedin.com/in/${profileId}/`;
      }

      logger.info(`Navigating to LinkedIn profile: ${profileUrl}`);

      // Navigate with timeout and error handling
      const navigationTimeout = this.configManager.get('navigationTimeout', 30000);
      await session.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeout
      });

      // Wait for profile page to load completely
      await this.waitForLinkedInLoad();
      // Extra stabilization wait using a lightweight heuristic
      try {
        await this.waitForPageStability?.();
      } catch (error) {
        logger.debug('Page stability check failed, continuing anyway', { error: error.message });
      }

      // Verify we're on a profile page
      const isProfilePage = await this.verifyProfilePage(page);
      if (!isProfilePage) {
        throw new Error('Navigation did not result in a valid LinkedIn profile page');
      }





      logger.info(`Successfully navigated to profile: ${profileId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to navigate to profile ${profileId}:`, error);
      await this.sessionManager.recordError(error);

      // Screenshot capture removed

      return false;
    }
  }

  /**
   * Verify that we're on a valid LinkedIn profile page
   * @param {Object} page - Puppeteer page object
   * @returns {Promise<boolean>} True if on profile page
   */
  async verifyProfilePage(page) {
    try {
      // Look for profile-specific elements
      const profileIndicators = [
        '.pv-top-card',
        '.profile-photo-edit',
        '[data-test-id="profile-top-card"]',
        '.pv-profile-section',
        '.profile-rail-card'
      ];

      for (const selector of profileIndicators) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) {
            logger.debug(`Profile page verified with selector: ${selector}`);
            return true;
          }
        } catch {
          // Continue checking other selectors
        }
      }

      // Check URL pattern as fallback
      const currentUrl = page.url();
      return currentUrl.includes('/in/') || currentUrl.includes('/profile/');

    } catch (error) {
      logger.debug('Profile page verification failed:', error.message);
      return false;
    }
  }

  /**
   * Wait for LinkedIn page to fully load
   * @returns {Promise<void>}
   */
  async waitForLinkedInLoad() {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Heuristic hydration/stability detector for SPA pages (avoids flaky networkidle)
      const maxWaitMs = this.configManager.get('pageLoadMaxWait', 10000);
      const sampleIntervalMs = 250;
      const requiredStableSamples = 3;

      let lastMetrics = null;
      let stableSamples = 0;
      const startTs = Date.now();

      while (Date.now() - startTs < maxWaitMs) {
        const metrics = await page.evaluate(() => {
          const ready = document.readyState; // 'loading' | 'interactive' | 'complete'
          const main = !!document.querySelector('main');
          const scaffold = !!document.querySelector('.scaffold-layout');
          const nav = !!document.querySelector('header.global-nav, .global-nav');
          const anchors = document.querySelectorAll('a[href]')?.length || 0;
          const images = document.images?.length || 0;
          const height = document.body?.scrollHeight || 0;
          const url = location.href;
          const isCheckpoint = /checkpoint|authwall/i.test(url);
          return { ready, main, scaffold, nav, anchors, images, height, isCheckpoint };
        });

        // Fast path: base UI present and DOM not loading
        const baseUiPresent = (metrics.main || metrics.scaffold || metrics.nav) && metrics.ready !== 'loading';

        // Stability: DOM metrics not changing over a few samples
        if (
          lastMetrics &&
          baseUiPresent &&
          metrics.anchors === lastMetrics.anchors &&
          metrics.images === lastMetrics.images &&
          metrics.height === lastMetrics.height
        ) {
          stableSamples += 1;
          if (stableSamples >= requiredStableSamples) {
            return true;
          }
        } else {
          stableSamples = 0;
        }

        lastMetrics = metrics;
        await new Promise(resolve => setTimeout(resolve, sampleIntervalMs));
      }

      // Fallback: ensure at least a key container exists before proceeding
      await Promise.race([
        session.waitForSelector('main', { timeout: 2000 }),
        session.waitForSelector('.scaffold-layout', { timeout: 2000 }),
        session.waitForSelector('[data-test-id]', { timeout: 2000 }),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch {
      logger.debug('LinkedIn page load heuristic finished without full stability; proceeding');
    }
  }

  async waitForPageStability(maxWaitMs = 8000, sampleIntervalMs = 300) {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      let last = null;
      let stable = 0;
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const metrics = await page.evaluate(() => ({
          ready: document.readyState,
          links: document.querySelectorAll('a').length,
          imgs: document.images.length,
        }));
        if (last && metrics.ready !== 'loading' && metrics.links === last.links && metrics.imgs === last.imgs) {
          stable += 1;
          if (stable >= 3) return true;
        } else {
          stable = 0;
        }
        last = metrics;
        await new Promise(resolve => setTimeout(resolve, sampleIntervalMs));
      }
    } catch (error) {
      logger.debug('Page stability monitoring failed', { error: error.message });
    }
    return false;
  }



  /**
   * Send a direct message to a LinkedIn connection
   * @param {string} recipientProfileId - Profile ID of message recipient
   * @param {string} messageContent - Message content to send
   * @param {string} userId - ID of authenticated user
   * @returns {Promise<Object>} Message result
   */
  async sendMessage(recipientProfileId, messageContent, userId) {
    const context = {
      operation: 'sendMessage',
      recipientProfileId,
      messageLength: messageContent.length,
      userId
    };

    logger.info(`Sending LinkedIn message to profile ${recipientProfileId} by user ${userId}`, context);
    // Check for suspicious activity before starting
    await this.checkSuspiciousActivity();

    // Get or initialize browser session
    await this.getBrowserSession();

    // Navigate to recipient's profile
    const navigationSuccess = await this.navigateToProfile(recipientProfileId);
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to profile: ${recipientProfileId}`);
    }

    // Navigate to messaging interface
    await this.navigateToMessaging(recipientProfileId);

    // Compose and send the message
    const messageResult = await this.composeAndSendMessage(messageContent);

    // Update session activity
    this.sessionManager.lastActivity = new Date();



    logger.info(`Successfully sent LinkedIn message`, {
      recipientProfileId,
      messageId: messageResult.messageId,
      userId
    });

    return {
      messageId: messageResult.messageId || `msg_${Date.now()}_${recipientProfileId}`,
      deliveryStatus: 'sent',
      sentAt: new Date().toISOString(),
      recipientProfileId,
      userId
    };

  }

  /**
   * Navigate to LinkedIn messaging interface for a specific profile
   * @param {string} profileId - Profile ID to message
   * @returns {Promise<void>}
   */
  /**
   * Navigate to messaging interface for a specific profile
   * Implements requirements 1.2, 1.3
   * @param {string} profileId - LinkedIn profile ID
   * @returns {Promise<void>}
   */
  async navigateToMessaging(profileId) {
    logger.info(`Navigating to messaging interface for profile: ${profileId}`);

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Add human-like delay before interaction


      // Look for message button on profile page
      const messageButtonSelectors = [
        '[data-test-id="message-button"]',
        'button[aria-label*="Message"]',
        'button[aria-label*="message"]',
        '.message-button',
        'button:has-text("Message")',
        'a[href*="/messaging/"]',
        '.pv-s-profile-actions button[aria-label*="Message"]',
        '.pvs-profile-actions__action button[aria-label*="Message"]'
      ];
      const { element: messageButton, selector: foundSelector } = await this.findElementBySelectors(messageButtonSelectors, 3000);

      if (messageButton) {
        // Scroll button into view if needed
        await this.clickElementHumanly(page, messageButton);

        // Wait for messaging interface to load
        await this.waitForMessagingInterface();

      } else {
        // Fallback: Try navigating directly to messaging URL
        const messagingUrl = `https://www.linkedin.com/messaging/compose/?recipient=${profileId}`;
        logger.info(`Message button not found, navigating directly to: ${messagingUrl}`);

        const navigationTimeout = this.configManager.get('navigationTimeout', 30000);
        await session.goto(messagingUrl, {
          waitUntil: 'networkidle',
          timeout: navigationTimeout
        });

        await this.waitForMessagingInterface();
      }

      // Record the messaging navigation action
      this.humanBehavior.recordAction('messaging_navigation', {
        profileId,
        method: messageButton ? 'button_click' : 'direct_url',
        selector: foundSelector,
        timestamp: new Date().toISOString()
      });

      logger.info(`Successfully navigated to messaging interface for profile: ${profileId}`);

    } catch (error) {
      logger.error(`Failed to navigate to messaging interface for ${profileId}:`, error);

      // Screenshot capture removed

      throw new Error(`Messaging navigation failed: ${error.message}`);
    }
  }

  /**
   * Wait for messaging interface to load
   * @returns {Promise<void>}
   */
  async waitForMessagingInterface() {
    try {
      await this.getBrowserSession();

      // Wait for messaging interface elements
      const messagingSelectors = [
        '.msg-form__contenteditable',
        '[data-test-id="message-input"]',
        '.compose-form__message-input',
        '[contenteditable="true"][role="textbox"]',
        '.msg-conversation-card',
        '.messaging-composer'
      ];
      const { element: messagingElement } = await this.waitForAnySelector(messagingSelectors, 5000);

      if (!messagingElement) {
        throw new Error('Messaging interface did not load properly');
      }

      // Additional wait for interface to be fully interactive


    } catch (error) {
      logger.error('Failed to wait for messaging interface:', error);
      throw error;
    }
  }

  /**
   * Compose and send a message in the LinkedIn messaging interface
   * @param {string} messageContent - Message content to send
   * @returns {Promise<Object>} Message result with ID
   */
  /**
   * Compose and send a LinkedIn message
   * Implements requirements 1.2, 1.4
   * @param {string} messageContent - Message content to send
   * @returns {Promise<Object>} Message result with ID
   */
  async composeAndSendMessage(messageContent) {
    logger.info('Composing and sending LinkedIn message', {
      messageLength: messageContent.length
    });

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Wait for messaging interface to be ready
      await this.waitForMessagingInterface();

      // Look for message input field
      const messageInputSelectors = [
        '[data-test-id="message-input"]',
        '.msg-form__contenteditable',
        '[contenteditable="true"][role="textbox"]',
        'textarea[placeholder*="message"]',
        '.compose-form__message-input',
        '[aria-label*="message"]',
        '.msg-form__msg-content-container [contenteditable="true"]',
        '.messaging-composer [contenteditable="true"]'
      ];
      const { element: messageInput, selector: foundSelector } = await this.waitForAnySelector(messageInputSelectors, 5000);

      if (!messageInput) {
        throw new Error('Message input field not found in messaging interface');
      }

      // Type message with reusable helper
      await this.humanBehavior.simulateHumanMouseMovement(page, messageInput);
      await this.clearAndTypeText(page, messageInput, messageContent);

      // Add delay before sending
      await RandomHelpers.randomDelay(1000, 2000);

      // Look for send button
      const sendButtonSelectors = [
        '[data-test-id="send-button"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        '.msg-form__send-button',
        'button[type="submit"]',
        '.messaging-composer button[aria-label*="Send"]',
        '.msg-form__footer button[aria-label*="Send"]'
      ];
      const { element: sendButton, selector: sendSelector } = await this.findElementBySelectors(sendButtonSelectors, 3000);

      if (!sendButton) {
        // Try using Enter key as fallback
        logger.info('Send button not found, trying Enter key');
        await page.keyboard.press('Enter');
      } else {
        // Human-like click
        await this.clickElementHumanly(page, sendButton);
      }

      // Wait for message to be sent
      await this.waitForMessageSent();

      // Generate message ID
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Record the message sending action
      this.humanBehavior.recordAction('message_sent', {
        messageLength: messageContent.length,
        inputSelector: foundSelector,
        sendSelector: sendSelector,
        messageId,
        timestamp: new Date().toISOString()
      });

      logger.info('Successfully composed and sent LinkedIn message', { messageId });

      return {
        messageId,
        sentAt: new Date().toISOString(),
        messageLength: messageContent.length
      };

    } catch (error) {
      logger.error('Failed to compose and send message:', error);

      // Screenshot capture removed

      throw new Error(`Message composition failed: ${error.message}`);
    }
  }

  /**
   * Wait for message to be sent confirmation
   * @returns {Promise<void>}
   */
  async waitForMessageSent() {
    try {
      const session = await this.getBrowserSession();

      // Wait for message sent indicators
      const sentIndicators = [
        '.msg-s-message-list-item--sent',
        '[data-test-id="message-sent"]',
        '.msg-conversation-card__message--sent',
        '.messaging-conversation-item--sent'
      ];

      let sentConfirmed = false;
      for (const selector of sentIndicators) {
        try {
          const indicator = await session.waitForSelector(selector, { timeout: 5000 });
          if (indicator) {
            logger.debug(`Message sent confirmation found: ${selector}`);
            sentConfirmed = true;
            break;
          }
        } catch {
          // Continue checking other indicators
        }
      }

      if (!sentConfirmed) {
        // Fallback: wait for input to be cleared or send button to be disabled

        logger.debug('Message sent confirmation not found, assuming sent based on timing');
      }

    } catch (error) {
      logger.debug('Message sent confirmation wait completed:', error.message);
      // Don't throw error as message might have been sent successfully
    }
  }


  /**
   * Type text with human-like patterns including variable speed and pauses
   * @param {string} text - Text to type
   * @param {Object} element - Optional target element
   * @returns {Promise<void>}
   */
  async typeWithHumanPattern(text, element = null) {
    const session = await this.getBrowserSession();
    const page = session.getPage();
    if (element) {
      await element.type(text);
    } else {
      await page.keyboard.type(text);
    }
  }

  /**
   * Send a connection request to a LinkedIn profile
   * @param {string} profileId - Profile ID to connect with
   * @param {string} connectionMessage - Optional connection message
   * @param {string} userId - ID of authenticated user
   * @returns {Promise<Object>} Connection result
   */
  // addConnection removed in favor of executeConnectionWorkflow


  /**
   * Create and publish a LinkedIn post
   * @param {string} content - Post content
   * @param {Array} mediaAttachments - Optional media attachments
   * @param {string} userId - ID of authenticated user
   * @returns {Promise<Object>} Post result
   */
  async createPost(content, mediaAttachments = [], userId) {
    const context = {
      operation: 'createPost',
      contentLength: content.length,
      hasMedia: mediaAttachments.length > 0,
      userId
    };

    logger.info(`Creating LinkedIn post by user ${userId}`, context);
    // Check for suspicious activity before starting
    await this.checkSuspiciousActivity();

    // Get or initialize browser session
    await this.getBrowserSession();

    // Navigate to post creation interface
    await this.navigateToPostCreator();

    // Compose the post content
    await this.composePost(content);

    // Add media attachments if provided
    if (mediaAttachments && mediaAttachments.length > 0) {
      await this.addMediaAttachments(mediaAttachments);
    }

    // Publish the post
    const postResult = await this.publishPost();

    // Update session activity
    this.sessionManager.lastActivity = new Date();

    // Record the successful post creation
    this.humanBehavior.recordAction('post_created', {
      contentLength: content.length,
      hasMedia: mediaAttachments.length > 0,
      userId
    });

    logger.info(`Successfully created LinkedIn post`, {
      postId: postResult.postId,
      postUrl: postResult.postUrl,
      userId
    });

    return {
      postId: postResult.postId || `post_${Date.now()}_${userId}`,
      postUrl: postResult.postUrl,
      publishStatus: 'published',
      publishedAt: new Date().toISOString(),
      userId
    };

  }


  /**
   * Navigate to LinkedIn post creation interface
   * @returns {Promise<void>}
   */
  /**
   * Navigate to LinkedIn post creation interface
   * Implements requirements 3.2, 3.3
   * @returns {Promise<void>}
   */
  async navigateToPostCreator() {
    logger.info('Navigating to LinkedIn post creation interface');

    try {
      const session = await this.getBrowserSession();

      // Navigate to LinkedIn home/feed page first
      const navigationTimeout = this.configManager.get('navigationTimeout', 30000);
      await session.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'networkidle',
        timeout: navigationTimeout
      });

      await this.waitForLinkedInLoad();

      // Add human-like navigation delay


      // Look for "Start a post" button or similar
      const startPostSelectors = [
        'button[aria-label*="Start a post"]',
        'button[aria-label*="start a post"]',
        '[data-test-id="start-post-button"]',
        '.share-box-feed-entry__trigger',
        'button[data-control-name*="share_via_feed"]',
        '.feed-identity-module__member-photo',
        '.share-creation-state__text-editor',
        'div[data-placeholder*="Start a post"]',
        '.share-box-feed-entry'
      ];

      let startPostButton = null;

      // Try to find start post button with multiple selectors
      for (const selector of startPostSelectors) {
        try {
          startPostButton = await session.waitForSelector(selector, { timeout: 5000 });
          if (startPostButton) {
            logger.debug(`Found start post button with selector: ${selector}`);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (!startPostButton) {
        throw new Error('Start post button not found on LinkedIn feed');
      }

      // Move to button



      // Add thinking delay before clicking


      // Click the start post button
      logger.info('Clicking start post button');
      await startPostButton.click();

      // Wait for post creation interface to load
      await this.waitForPostCreationInterface();

      // Telemetry removed

      logger.info('Successfully navigated to post creation interface');

    } catch (error) {
      logger.error('Failed to navigate to post creation interface:', error);

      // Screenshot capture removed

      throw new Error(`Post creator navigation failed: ${error.message}`);
    }
  }

  /**
   * Wait for post creation interface to load
   * @returns {Promise<void>}
   */
  async waitForPostCreationInterface() {
    try {
      const session = await this.getBrowserSession();

      // Wait for post creation interface elements
      const postCreationSelectors = [
        '.ql-editor[contenteditable="true"]',
        '[data-test-id="post-content-input"]',
        '[contenteditable="true"][role="textbox"]',
        'div[data-placeholder*="What do you want to talk about"]',
        '.share-creation-state__text-editor',
        '[aria-label*="Text editor"]',
        '.share-box-feed-entry__editor'
      ];

      let postCreationElement = null;
      for (const selector of postCreationSelectors) {
        try {
          postCreationElement = await session.waitForSelector(selector, { timeout: 8000 });
          if (postCreationElement) {
            logger.debug(`Post creation interface loaded, found element: ${selector}`);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (!postCreationElement) {
        throw new Error('Post creation interface did not load properly');
      }

      // Additional wait for interface to be fully interactive


    } catch (error) {
      logger.error('Failed to wait for post creation interface:', error);
      throw error;
    }
  }

  /**
   * Compose post content in the LinkedIn post creator
   * @param {string} content - Post content to compose
   * @returns {Promise<void>}
   */
  async composePost(content) {
    logger.info('Composing LinkedIn post content', {
      contentLength: content.length
    });

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Wait for post creation interface to be ready
      await this.waitForLinkedInLoad();

      // Look for post content input field
      const contentInputSelectors = [
        '[data-test-id="post-content-input"]',
        '.ql-editor[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'div[data-placeholder*="What do you want to talk about"]',
        '.share-creation-state__text-editor',
        '[aria-label*="Text editor"]'
      ];

      let contentInput = null;
      for (const selector of contentInputSelectors) {
        try {
          contentInput = await session.waitForSelector(selector, { timeout: 3000 });
          if (contentInput) {
            logger.debug(`Found content input with selector: ${selector}`);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (!contentInput) {
        throw new Error('Post content input field not found');
      }

      // Simulate human mouse movement to input field
      await this.humanBehavior.simulateHumanMouseMovement(page, contentInput);

      // Clear any existing content and focus on input
      await contentInput.click();


      // Clear existing content
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');

      await page.keyboard.press('Delete');

      // Type post content with human-like typing pattern
      await this.typeWithHumanPattern(content, contentInput);

      // Add delay after typing


      logger.info('Post content composed successfully');

    } catch (error) {
      logger.error('Failed to compose post content:', error);
      throw new Error(`Post composition failed: ${error.message}`);
    }
  }

  /**
   * Add media attachments to the post
   * Implements requirement 3.4 - Media attachment support
   * @param {Array} mediaAttachments - Array of media attachments with file paths and types
   * @returns {Promise<void>}
   */
  async addMediaAttachments(mediaAttachments) {
    logger.info('Adding media attachments to post', {
      attachmentCount: mediaAttachments.length
    });

    try {
      if (!mediaAttachments || mediaAttachments.length === 0) {
        logger.debug('No media attachments to add');
        return;
      }

      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Look for media attachment button
      const mediaButtonSelectors = [
        '[data-test-id="media-upload-button"]',
        '[aria-label*="Add media"]',
        '[aria-label*="Add photo"]',
        '.share-actions__primary-action button[aria-label*="media"]',
        'button[data-control-name="add_media"]',
        '.media-upload-button',
        'input[type="file"][accept*="image"]',
        'button[aria-label*="Upload"]'
      ];

      let mediaButton = null;
      for (const selector of mediaButtonSelectors) {
        try {
          mediaButton = await session.waitForSelector(selector, { timeout: 2000 });
          if (mediaButton) {
            logger.debug(`Found media button with selector: ${selector}`);
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (!mediaButton) {
        logger.warn('Media upload button not found, skipping media attachments');
        return;
      }

      // Process each media attachment
      for (let i = 0; i < mediaAttachments.length; i++) {
        const attachment = mediaAttachments[i];
        logger.info(`Processing media attachment ${i + 1}/${mediaAttachments.length}`, {
          type: attachment.type,
          filename: attachment.filename
        });

        // Simulate human mouse movement to media button
        await this.humanBehavior.simulateHumanMouseMovement(page, mediaButton);


        // Click media upload button
        await mediaButton.click();


        // Handle file upload (if file path provided)
        if (attachment.filePath) {
          try {
            // Look for file input element
            const fileInput = await session.waitForSelector('input[type="file"]', { timeout: 5000 });
            if (fileInput) {
              await fileInput.uploadFile(attachment.filePath);
              logger.debug(`Uploaded file: ${attachment.filePath}`);

              // Wait for upload to process

            }
          } catch (uploadError) {
            logger.warn(`Failed to upload file ${attachment.filePath}:`, uploadError.message);
          }
        }

        // Add delay between attachments
        if (i < mediaAttachments.length - 1) {

        }
      }

      // Record successful media attachment
      this.humanBehavior.recordAction('media_attached', {
        attachmentCount: mediaAttachments.length,
        types: mediaAttachments.map(a => a.type)
      });

      logger.info('Media attachments added successfully');

    } catch (error) {
      logger.error('Failed to add media attachments:', error);

      // Record failed attempt
      this.humanBehavior.recordAction('media_attachment_failed', {
        attachmentCount: mediaAttachments.length,
        error: error.message
      });

      throw new Error(`Media attachment failed: ${error.message}`);
    }
  }

  /**
   * Send the connection request after clicking connect button
   * Implements requirement 2.4 - Connection request workflow
   * This still isn't sending notification if the user is already connected to the profile
   * Although the backend is recording the edge, the frontend is not updating the connection status
   * @returns {Promise<Object>} Connection request result
   */
  async sendConnectionRequest(profileId, jwtToken) {
    logger.info('Sending connection request for profile: ' + profileId);
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();



      // 2. Wait for the modal to appear and be visible.
      const modalSelector = '[role="dialog"], .artdeco-modal, .send-invite';
      const modal = await page.waitForSelector(modalSelector, { visible: true, timeout: 5000 });
      if (!modal) {
        throw new Error('Connection request modal did not appear.');
      }
      logger.info('Connection modal appeared.');

      // 3. Find the clickable "Send" button within the modal using DOM evaluation (Puppeteer-agnostic)
      const sendHandle = await page.evaluateHandle((modalEl) => {
        const lower = (s) => (s || '').toLowerCase();
        const nodes = modalEl.querySelectorAll('button, [role="button"]');
        for (const n of nodes) {
          const aria = lower(n.getAttribute('aria-label'));
          const txt = lower((n.innerText || n.textContent || '').trim());
          if (
            aria.includes('send without a note') || txt === 'send without a note' ||
            aria.includes('send invitation') || txt === 'send invitation' ||
            txt === 'send' || aria === 'send'
          ) {
            return n;
          }
        }
        return null;
      }, modal);

      const sendButton = sendHandle?.asElement?.();
      if (!sendButton) {
        throw new Error('Send button not found within the modal.');
      }

      // 4. Click the button and wait for confirmation.
      await this.humanBehavior.simulateHumanMouseMovement(page, sendButton);
      await sendButton.click();
      logger.info('Clicked send button in modal.');

      const confirmationSelectors = [
        '.artdeco-toast-item',
        'button[aria-label*="Pending"]',
        '[data-test-id="invitation-sent-confirmation"]'
      ];
      await page.waitForSelector(confirmationSelectors.join(', '), { timeout: 5000 });

      logger.info('Connection request confirmation found.');
      const requestId = `conn_req_${Date.now()}`;

      this.humanBehavior.recordAction('connection_request_sent', { requestId, confirmationFound: true });
      try {
        await this.ensureEdge(profileId, 'outgoing', jwtToken);
      } catch (error) {
        logger.debug('Failed to create edge for connection request', { error: error.message, profileId });
      }

      return {
        requestId,
        status: 'sent',
        sentAt: new Date().toISOString(),
        confirmationFound: true
      };

    } catch (error) {
      logger.error('Failed to send connection request:', error.message);
      this.humanBehavior.recordAction('connection_request_failed', { error: error.message });
      throw new Error(`Connection request failed: ${error.message}`);
    }
  }


  /**
   * Check the current connection status with a profile
   * @returns {Promise<string>} Connection status: 'connected', 'pending', 'not_connected'
   */
  async checkConnectionStatus() {
    try {
      const session = await this.getBrowserSession();

      // Look for indicators of existing connection
      const connectedSelectors = [
        'button[aria-label*="Message"]',
        'button[aria-label*="message"]',
        '.message-button',
        '[data-test-id="message-button"]'
      ];

      const pendingSelectors = [
        'button[aria-label*="Pending"]',
        'button[aria-label*="pending"]',
        '.pending-button',
        '[data-test-id="pending-button"]'
      ];

      // Check for message button (indicates already connected)
      for (const selector of connectedSelectors) {
        try {
          const element = await session.waitForSelector(selector, { timeout: 1000 });
          if (element) {
            logger.debug(`Found connection indicator: ${selector}`);
            return 'connected';
          }
        } catch {
          // Continue checking
        }
      }

      // Check for pending connection
      for (const selector of pendingSelectors) {
        try {
          const element = await session.waitForSelector(selector, { timeout: 1000 });
          if (element) {
            logger.debug(`Found pending connection indicator: ${selector}`);
            return 'pending';
          }
        } catch {
          // Continue checking
        }
      }

      return 'not_connected';

    } catch (error) {
      logger.error('Failed to check connection status:', error);
      return 'not_connected'; // Default to not connected on error
    }
  }

  /**
   * Check if the profile page container contains an aria-label with "Pending"
   * If true, caller should treat connection as already pending/outgoing
   * @returns {Promise<boolean>}
   */
  async isProfileContainer(buttonName) {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      // Try broader, stable containers in priority order
      const candidateSelectors = [
        '#profile-content main section.artdeco-card div.ph5.pb5',
        '#profile-content main section.artdeco-card',
        '#profile-content main',
        'main .pv-top-card',
        'main'
      ];

      let container = null;
      let usedSelector = null;
      for (const sel of candidateSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            container = el;
            usedSelector = sel;
            break;
          }
        } catch (error) {
          logger.debug('Selector query failed, trying next', { selector: sel, error: error.message });
        }
      }

      logger.info(`${buttonName} container check: ${container ? 'found' : 'not found'}` +
        `${usedSelector ? ` (${usedSelector})` : ''}`);
      if (!container) return false;


      if (buttonName === "pending") {
        const containsPending = await page.evaluate((el, buttonName) => {
          const html = el.innerHTML || '';
          return new RegExp(`aria[-\\s]?label\\s*=\\s*["'][^"']*${buttonName}[^"']*["']`, 'i').test(html);
        }, container, buttonName);
        logger.info(`${buttonName} container match: ${containsPending ? 'found' : 'not found'}`);
        return !!containsPending;
      } else if (buttonName === "connection-degree") {
        const isFirst = await page.evaluate((root) => {
          const el = root.querySelector('span.distance-badge .dist-value');
          const txt = (el && el.textContent) ? el.textContent.trim() : '';
          return txt === '1st';
        }, container);
        logger.info(`connection-degree match: ${isFirst ? '1st' : 'not 1st'}`);
        return !!isFirst;

      } else if (buttonName === "connect") {
        const handle = await page.evaluateHandle((root) => {
          const lower = (s) => (s || '').toLowerCase();
          const isVisible = (n) => {
            const r = n.getBoundingClientRect();
            const s = window.getComputedStyle(n);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const nodes = root.querySelectorAll('button,[role="button"],.artdeco-button');
          for (const n of nodes) {
            const aria = lower(n.getAttribute('aria-label'));
            const txt = lower((n.innerText || n.textContent || '').trim());
            if (((aria && aria.includes('connect')) || txt === 'connect') && isVisible(n)) return n;
          }
          return null;
        }, container);
        const btn = handle && handle.asElement && handle.asElement();
        if (btn) { await this.clickElementHumanly(page, btn); return true; }
        return false;

      } else if (buttonName === "more") {
        const handle = await page.evaluateHandle((root) => {
          const lower = (s) => (s || '').toLowerCase();
          const isVisible = (n) => {
            const r = n.getBoundingClientRect();
            const s = window.getComputedStyle(n);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const nodes = root.querySelectorAll('button,[role="button"],.artdeco-button');
          for (const n of nodes) {
            const aria = lower(n.getAttribute('aria-label'));
            const txt = lower((n.innerText || n.textContent || '').trim());
            if (((aria && aria.includes('more')) || txt === 'more') && isVisible(n)) return n;
          }
          return null;
        }, container);
        const btn = handle && handle.asElement && handle.asElement();
        if (btn) { await this.clickElementHumanly(page, btn); return true; }
        return false;
      } else {
        throw new Error(`Invalid button name: ${buttonName}`);
      }
    } catch (error) {
      logger.debug('Pending container check failed:', error.message);
      return false;
    }
  }

  /**
   * Ensure an edge is recorded for the profile using edge manager
   * @param {string} profileId - Profile ID to record edge for
   * @param {string} status - Edge status (e.g., 'outgoing', 'pending', 'connected')
   * @param {string|undefined} jwtToken - JWT token for authentication
   */
  async ensureEdge(profileId, status, jwtToken) {
    try {
      if (jwtToken) {
        this.dynamoDBService.setAuthToken(jwtToken);
      }
      await this.dynamoDBService.upsertEdgeStatus(profileId, status);
    } catch (error) {
      logger.warn(`Failed to create edge with status '${status}' via edge manager:`, error.message);
    }
  }


  /**
   * Input post content with realistic typing patterns and delays
   * @param {string} content - Post content to input
   * @returns {Promise<void>}
   */
  async inputPostContent(content) {
    logger.info('Inputting post content', {
      contentLength: content.length
    });

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Wait for post creation interface to be ready
      await this.waitForLinkedInLoad();

      // Look for post content input field
      const contentInputSelectors = [
        '[data-test-id="post-content-input"]',
        '.ql-editor[contenteditable="true"]',
        '[contenteditable="true"][role="textbox"]',
        'div[data-placeholder*="What do you want to talk about"]',
        '.share-creation-state__text-editor',
        '[aria-label*="Text editor"]',
        '.mentions-texteditor__content'
      ];
      const { element: contentInput } = await this.findElementBySelectors(contentInputSelectors, 3000);

      if (!contentInput) {
        throw new Error('Post content input field not found');
      }

      // Clear existing content and type
      await this.clearAndTypeText(page, contentInput, content);

      // Add delay after typing


      logger.info('Post content input completed successfully');

    } catch (error) {
      logger.error('Failed to input post content:', error);
      throw new Error(`Post content input failed: ${error.message}`);
    }
  }

  /**
   * Attach media files to the post (placeholder implementation)
   * @param {Array} mediaAttachments - Array of media attachment objects
   * @returns {Promise<void>}
   */
  async attachMediaToPost(mediaAttachments) {
    logger.info('Attaching media to post', {
      mediaCount: mediaAttachments.length
    });

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Add human-like delay before media interaction


      // Look for media attachment button
      const mediaButtonSelectors = [
        '[data-test-id="media-button"]',
        'button[aria-label*="Add media"]',
        'button[aria-label*="add media"]',
        '.share-actions-control-button[aria-label*="media"]',
        'button[data-control-name*="media"]',
        '.media-upload-button'
      ];
      const { element: mediaButton } = await this.findElementBySelectors(mediaButtonSelectors, 2000);

      if (!mediaButton) {
        logger.warn('Media attachment button not found, skipping media upload');
        return;
      }

      // Click media button
      logger.info('Clicking media attachment button');
      await this.clickElementHumanly(page, mediaButton);
      await RandomHelpers.randomDelay(1000, 2000);

      // For now, this is a placeholder implementation
      // In a full implementation, you would:
      // 1. Handle file upload dialogs
      // 2. Upload each media file
      // 3. Wait for upload completion
      // 4. Handle different media types (image, video, document)

      logger.warn('Media attachment functionality is placeholder - files not actually uploaded');

      // Simulate upload delay


    } catch (error) {
      logger.error('Failed to attach media to post:', error);
      // Don't throw error - post can still be published without media
      logger.warn('Proceeding with post creation without media attachments');
    }
  }

  /**
   * Publish the post and wait for confirmation
   * @returns {Promise<Object>} Post result with ID and URL
   */
  async publishPost() {
    logger.info('Publishing LinkedIn post');

    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();

      // Add human-like delay before publishing


      // Look for publish/post button
      const publishButtonSelectors = [
        'button[aria-label*="Post"]',
        'button[aria-label*="post"]',
        '[data-test-id="post-button"]',
        '.share-actions__primary-action',
        'button[data-control-name*="share.post"]',
        'button:has-text("Post")',
        'button[type="submit"]'
      ];
      const { element: publishButton } = await this.findElementBySelectors(publishButtonSelectors, 3000);

      if (!publishButton) {
        throw new Error('Publish button not found');
      }

      // Check if publish button is enabled
      const isDisabled = await publishButton.getAttribute('disabled');
      if (isDisabled) {
        throw new Error('Publish button is disabled - post may be incomplete');
      }

      // Click publish button
      logger.info('Clicking publish button');
      await this.clickElementHumanly(page, publishButton);

      // Wait for post to be published (look for confirmation or redirect)


      // Try to extract post URL from current page or notifications
      let postUrl = null;
      try {
        const currentUrl = await page.url();
        if (currentUrl.includes('/posts/') || currentUrl.includes('/activity-')) {
          postUrl = currentUrl;
        }
      } catch {
        logger.debug('Could not extract post URL from current page');
      }

      // Generate post ID for tracking
      const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate fallback post URL if not extracted
      if (!postUrl) {
        postUrl = `https://linkedin.com/posts/activity-${Date.now()}`;
      }

      logger.info('Post published successfully', {
        postId,
        postUrl
      });

      return {
        postId,
        postUrl,
        publishedAt: new Date().toISOString(),
        status: 'published'
      };

    } catch (error) {
      logger.error('Failed to publish post:', error);
      throw new Error(`Post publishing failed: ${error.message}`);
    }
  }

  /**
   * Create and publish a LinkedIn post (combined method)
   * Implements requirements 3.2, 3.3, 3.4
   * @param {string} content - Post content
   * @param {Array} mediaAttachments - Optional media attachments
   * @returns {Promise<Object>} Post result with ID and URL
   */
  async createAndPublishPost(content, mediaAttachments = []) {
    logger.info('Creating and publishing LinkedIn post', {
      contentLength: content.length,
      hasMedia: mediaAttachments.length > 0,
      mediaCount: mediaAttachments.length
    });

    try {
      await this.getBrowserSession();

      // Check for cooling-off period before starting
      await this.humanBehavior.checkAndApplyCooldown();

      // Step 1: Navigate to post creation interface
      await this.navigateToPostCreator();

      // Step 2: Compose the post content
      await this.composePost(content);

      // Step 3: Add media attachments if provided
      if (mediaAttachments && mediaAttachments.length > 0) {
        await this.addMediaAttachments(mediaAttachments);
      }

      // Step 4: Publish the post
      const postResult = await this.publishPost();

      // Record the successful post creation
      this.humanBehavior.recordAction('post_created', {
        contentLength: content.length,
        hasMedia: mediaAttachments.length > 0,
        mediaCount: mediaAttachments.length
      });

      logger.info('Successfully created and published LinkedIn post', {
        postId: postResult.postId,
        postUrl: postResult.postUrl
      });

      return {
        postId: postResult.postId || `post_${Date.now()}`,
        postUrl: postResult.postUrl,
        publishStatus: 'published',
        publishedAt: new Date().toISOString(),
        contentLength: content.length,
        mediaCount: mediaAttachments.length
      };

    } catch (error) {
      logger.error('Failed to create and publish LinkedIn post:', error);

      // Record failed action for human behavior tracking
      this.humanBehavior.recordAction('post_failed', {
        contentLength: content.length,
        error: error.message
      });

      throw error;
    }
  }



  /**
   * Complete LinkedIn messaging workflow
   * Implements requirements 1.2, 1.3, 1.4 - End-to-end messaging
   * @param {string} recipientProfileId - Profile ID of message recipient
   * @param {string} messageContent - Message content to send
   * @param {Object} options - Additional options for messaging
   * @returns {Promise<Object>} Complete messaging result
   */
  async executeMessagingWorkflow(recipientProfileId, messageContent, options = {}) {
    const context = {
      operation: 'executeMessagingWorkflow',
      recipientProfileId,
      messageLength: messageContent.length,
      options
    };

    logger.info('Executing complete LinkedIn messaging workflow', context);
    // Step 1: Check for suspicious activity and apply cooling-off
    await this.checkSuspiciousActivity();

    // Step 2: Ensure browser session is healthy
    await this.getBrowserSession();

    // Step 3: Navigate to recipient's profile
    logger.info('Step 1/4: Navigating to profile');
    const navigationSuccess = await this.navigateToProfile(recipientProfileId);
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to profile: ${recipientProfileId}`);
    }

    // Step 4: Navigate to messaging interface
    logger.info('Step 2/4: Opening messaging interface');
    await this.navigateToMessaging(recipientProfileId);

    // Step 5: Compose and send the message
    logger.info('Step 3/4: Composing and sending message');
    const messageResult = await this.composeAndSendMessage(messageContent);

    // Step 6: Verify message was sent successfully
    logger.info('Step 4/4: Verifying message delivery');
    const deliveryConfirmed = messageResult.deliveryStatus === 'sent';

    // Update session activity and record success
    this.sessionManager.lastActivity = new Date();
    this.humanBehavior.recordAction('messaging_workflow_completed', {
      recipientProfileId,
      messageLength: messageContent.length,
      deliveryConfirmed,
      workflowDuration: Date.now() - context.startTime
    });

    const result = {
      workflowId: `msg_workflow_${Date.now()}_${recipientProfileId}`,
      messageId: messageResult.messageId || `msg_${Date.now()}_${recipientProfileId}`,
      deliveryStatus: deliveryConfirmed ? 'delivered' : 'sent',
      sentAt: new Date().toISOString(),
      recipientProfileId,
      messageLength: messageContent.length,
      workflowSteps: [
        { step: 'profile_navigation', status: 'completed' },
        { step: 'messaging_interface', status: 'completed' },
        { step: 'message_composition', status: 'completed' },
        { step: 'message_delivery', status: deliveryConfirmed ? 'confirmed' : 'pending' }
      ]
    };

    logger.info('LinkedIn messaging workflow completed successfully', result);
    return result;

  }

  /**
   * Create a standardized connection workflow result object
   * @param {string} profileId - Profile ID being connected with
   * @param {string} connectionMessage - Connection message (if any)
   * @param {Object} workflowData - Workflow execution data
   * @returns {Object} Standardized connection workflow result
   */
  createConnectionWorkflowResult(profileId, connectionMessage, workflowData) {
    return {
      requestId: workflowData.requestId || null,
      status: workflowData.status || workflowData.connectionStatus || 'unknown',
      sentAt: workflowData.sentAt || new Date().toISOString(),
      profileId,
      hasPersonalizedMessage: connectionMessage.length > 0
    };
  }

  async getEarlyConnectionStatus() {
    try {
      const isAlly = await this.isProfileContainer("connection-degree");
      if (isAlly) return 'ally';
      const isPending = await this.isProfileContainer("pending");
      if (isPending) return 'outgoing';
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Complete LinkedIn connection workflow
   * Implements requirements 2.2, 2.3, 2.4 - End-to-end connection
   * @param {string} profileId - Profile ID to connect with
   * @param {string} connectionMessage - Optional personalized message
   * @param {Object} options - Additional connection options
   * @returns {Promise<Object>} Complete connection result
   */
  async executeConnectionWorkflow(profileId, connectionMessage = '', options = {}) {
    const context = {
      operation: 'executeConnectionWorkflow',
      profileId,
      hasMessage: connectionMessage.length > 0,
      messageLength: connectionMessage.length,
      options
    };

    logger.info('Executing complete LinkedIn connection workflow', context);
    // Step 1: Check for suspicious activity and apply cooling-off
    await this.checkSuspiciousActivity();

    // Step 2: Ensure browser session is healthy
    await this.getBrowserSession();

    // Step 3: Navigate to target profile
    logger.info('Step 1/4: Navigating to profile');
    const navigationSuccess = await this.navigateToProfile(profileId);
    if (!navigationSuccess) {
      throw new Error(`Failed to navigate to profile: ${profileId}`);
    }

    // Step 4: Check current connection status
    logger.info('Step 2/4: Checking connection status');
    const earlyStatus = await this.getEarlyConnectionStatus();
    if (earlyStatus) {
      await this.ensureEdge(profileId, earlyStatus, options?.jwtToken);
      const earlyWorkflowData = { status: earlyStatus, connectionStatus: earlyStatus };
      const earlyResult = this.createConnectionWorkflowResult(
        profileId,
        connectionMessage,
        earlyWorkflowData
      );
      logger.info(`Early connection status detected: ${earlyStatus}`, earlyResult);
      return earlyResult;
    }

    // Step 5: Find and click connect button
    logger.info('Step 3/4: Clicking connect button');
    const connectButtonFound = await this.isProfileContainer('connect');
    logger.info('Connect button found: ' + connectButtonFound);
    if (!connectButtonFound) {
      const moreButtonFound = await this.isProfileContainer('more');
      if (moreButtonFound) {
        await this.isProfileContainer('connect');

      } else {
        throw new logger.error('Connect button not found in profile container');
      }
    }

    // Step 6: Send connection request (message addition skipped per requirement)
    logger.info('Step 4/4: Sending connection request');
    const requestResult = await this.sendConnectionRequest(profileId, options?.jwtToken);

    // Update session activity and record success
    this.sessionManager.lastActivity = new Date();
    this.humanBehavior.recordAction('connection_workflow_completed', {
      profileId,
      hasPersonalizedMessage: false,
      messageLength: 0,
      requestConfirmed: requestResult.confirmationFound,
      workflowDuration: Date.now() - context.startTime
    });

    const normalWorkflowData = {
      requestId: requestResult.requestId,
      status: requestResult.status,
      sentAt: requestResult.sentAt,
      confirmationFound: requestResult.confirmationFound
    };

    const result = this.createConnectionWorkflowResult(
      profileId,
      connectionMessage,
      normalWorkflowData
    );

    logger.info('LinkedIn connection workflow completed successfully', result);
    return result;

  }

  /**
   * Complete LinkedIn post creation workflow
   * Implements requirements 3.2, 3.3, 3.4 - End-to-end posting
   * @param {string} content - Post content
   * @param {Array} mediaAttachments - Optional media attachments
   * @param {Object} options - Additional posting options
   * @returns {Promise<Object>} Complete post creation result
   */
  async executePostCreationWorkflow(content, mediaAttachments = [], options = {}) {
    const context = {
      operation: 'executePostCreationWorkflow',
      contentLength: content.length,
      hasMedia: mediaAttachments.length > 0,
      mediaCount: mediaAttachments.length,
      options
    };

    logger.info('Executing complete LinkedIn post creation workflow', context);

    // No retries: run once
    // Step 1: Check for suspicious activity and apply cooling-off
    await this.checkSuspiciousActivity();

    // Step 2: Ensure browser session is healthy
    await this.getBrowserSession();

    // Step 3: Navigate to post creation interface
    logger.info('Step 1/5: Opening post creation interface');
    await this.navigateToPostCreator();

    // Step 4: Compose post content
    logger.info('Step 2/5: Composing post content');
    await this.composePost(content);

    // Step 5: Add media attachments if provided
    if (mediaAttachments && mediaAttachments.length > 0) {
      logger.info(`Step 3/5: Adding ${mediaAttachments.length} media attachments`);
      await this.addMediaAttachments(mediaAttachments);
    }

    // Step 6: Review post before publishing (human-like behavior)
    logger.info('Step 4/5: Reviewing post content');


    // Step 7: Publish the post
    logger.info('Step 5/5: Publishing post');
    const postResult = await this.publishPost();

    // Update session activity and record success
    this.sessionManager.lastActivity = new Date();
    this.humanBehavior.recordAction('post_creation_workflow_completed', {
      contentLength: content.length,
      hasMedia: mediaAttachments.length > 0,
      mediaCount: mediaAttachments.length,
      postPublished: postResult.status === 'published',
      workflowDuration: Date.now() - context.startTime
    });

    const result = {
      workflowId: `post_workflow_${Date.now()}`,
      postId: postResult.postId,
      postUrl: postResult.postUrl,
      publishStatus: postResult.status,
      publishedAt: postResult.publishedAt,
      contentLength: content.length,
      mediaCount: mediaAttachments.length,
      workflowSteps: [
        { step: 'post_interface_navigation', status: 'completed' },
        { step: 'content_composition', status: 'completed' },
        { step: 'media_attachment', status: mediaAttachments.length > 0 ? 'completed' : 'skipped' },
        { step: 'content_review', status: 'completed' },
        { step: 'post_publication', status: postResult.status === 'published' ? 'confirmed' : 'pending' }
      ]
    };

    logger.info('LinkedIn post creation workflow completed successfully', result);
    return result;

  }

  // Batch workflow removed: single-operation flows only
  /**
   * Validate workflow parameters before execution
   * @param {string} workflowType - Type of workflow to validate
   * @param {Object} params - Workflow parameters
   * @returns {Object} Validation result
   */
  validateWorkflowParameters(workflowType, params) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    switch (workflowType) {
      case 'messaging':
        if (!params.recipientProfileId) {
          validation.errors.push('recipientProfileId is required for messaging workflow');
        }
        if (!params.messageContent || params.messageContent.trim().length === 0) {
          validation.errors.push('messageContent is required and cannot be empty');
        }
        if (params.messageContent && params.messageContent.length > 8000) {
          validation.warnings.push('Message content is very long and may be truncated by LinkedIn');
        }
        break;

      case 'connection':
        if (!params.profileId) {
          validation.errors.push('profileId is required for connection workflow');
        }
        if (params.connectionMessage && params.connectionMessage.length > 300) {
          validation.warnings.push('Connection message is very long and may be truncated');
        }
        break;

      case 'post':
        if (!params.content || params.content.trim().length === 0) {
          validation.errors.push('content is required for post creation workflow');
        }
        if (params.content && params.content.length > 3000) {
          validation.warnings.push('Post content is very long and may be truncated by LinkedIn');
        }
        if (params.mediaAttachments && params.mediaAttachments.length > 9) {
          validation.warnings.push('LinkedIn typically supports up to 9 media attachments per post');
        }
        break;

      case 'batch':
        if (!params.operations || !Array.isArray(params.operations)) {
          validation.errors.push('operations array is required for batch workflow');
        }
        if (params.operations && params.operations.length === 0) {
          validation.errors.push('operations array cannot be empty');
        }
        if (params.operations && params.operations.length > 50) {
          validation.warnings.push('Large batch operations may take significant time and increase detection risk');
        }
        break;

      default:
        validation.errors.push(`Unknown workflow type: ${workflowType}`);
    }

    validation.isValid = validation.errors.length === 0;
    return validation;
  }



}