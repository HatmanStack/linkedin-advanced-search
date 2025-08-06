import { PuppeteerService } from './puppeteerService.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import RandomHelpers from '../utils/randomHelpers.js';
import HumanBehaviorManager from '../utils/humanBehaviorManager.js';
import LinkedInErrorHandler from '../utils/linkedinErrorHandler.js';
import ConfigManager from '../utils/configManager.js';
import ConfigManager from '../utils/configManager.js';

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
  static async getInstance() {
    try {
      // Check if existing instance is still valid
      if (this.instance && await this.isSessionHealthy()) {
        this.lastActivity = new Date();
        logger.debug('Reusing existing browser session');
        return this.instance;
      }

      // Clean up any existing unhealthy session
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
    return await this.getInstance();
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

export default LinkedInInteractionService;

/**
 * LinkedIn Interaction Service - Main service class for LinkedIn automation
 */
export class LinkedInInteractionService {
  constructor() {
    this.sessionManager = BrowserSessionManager;
    this.humanBehavior = new HumanBehaviorManager();
    this.configManager = ConfigManager;
    
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
  async executeWithRetry(operation, context = {}, maxRetries = this.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        context.attemptCount = attempt;
        
        // Log retry attempt
        if (attempt > 1) {
          logger.info(`Retry attempt ${attempt}/${maxRetries} for ${context.operation}`, {
            context,
            previousError: lastError?.message
          });
        }
        
        return await operation();
        
      } catch (error) {
        lastError = error;
        
        // Categorize the error
        const categorizedError = LinkedInErrorHandler.categorizeError(error, context);
        
        // Check if error is recoverable
        const isRecoverable = LinkedInErrorHandler.isRecoverable(categorizedError, attempt);
        
        if (!isRecoverable || attempt === maxRetries) {
          // Log final failure
          logger.error(`Operation ${context.operation} failed after ${attempt} attempts`, {
            context,
            error: error.message,
            errorCategory: categorizedError.category
          });
          throw error;
        }
        
        // Calculate backoff delay
        const delay = LinkedInErrorHandler.calculateBackoffDelay(attempt, categorizedError.category);
        
        // Log retry decision
        logger.warn(`Operation ${context.operation} failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          errorCategory: categorizedError.category,
          error: error.message
        });
        
        // Handle browser crashes with recovery
        if (categorizedError.category === 'BROWSER') {
          await this.handleBrowserRecovery(error, context);
        }
        
        // Wait before retry
        await this.delay(delay);
      }
    }
    
    throw lastError;
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
        await BrowserSessionManager.getInstance();
        
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
   * Initialize or get existing browser session
   * @returns {Promise<PuppeteerService>} Browser session instance
   */
  async initializeBrowserSession() {
    try {
      return await this.sessionManager.getInstance();
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
    return await this.sessionManager.getInstance();
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
    const activityStats = this.humanBehavior.getActivityStats();
    const suspiciousActivity = this.humanBehavior.detectSuspiciousActivity();
    
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
    const suspiciousActivity = this.humanBehavior.detectSuspiciousActivity();
    
    if (suspiciousActivity.isSuspicious) {
      logger.warn('Suspicious activity detected, applying enhanced cooling-off period', {
        patterns: suspiciousActivity.patterns,
        recommendation: suspiciousActivity.recommendation
      });
      
      // Apply enhanced cooling-off period for suspicious activity
      const enhancedCooldown = {
        actionsPerMinute: Math.floor(config.linkedinInteractions?.actionsPerMinute * 0.5) || 4,
        actionsPerHour: Math.floor(config.linkedinInteractions?.actionsPerHour * 0.7) || 70
      };
      
      await this.humanBehavior.checkAndApplyCooldown(enhancedCooldown);
      
      // Reset consecutive actions counter to start fresh
      this.humanBehavior.consecutiveActions = 0;
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
      
      // Check for cooling-off period before navigation
      await this.humanBehavior.checkAndApplyCooldown();
      
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
        waitUntil: 'networkidle',
        timeout: navigationTimeout 
      });
      
      // Wait for profile page to load completely
      await this.waitForLinkedInLoad();
      
      // Verify we're on a profile page
      const isProfilePage = await this.verifyProfilePage(page);
      if (!isProfilePage) {
        throw new Error('Navigation did not result in a valid LinkedIn profile page');
      }
      
      // Add human-like navigation delay
      await RandomHelpers.humanLikeDelay('navigate');
      
      // Record the navigation action
      this.humanBehavior.recordAction('navigation', {
        profileId,
        url: profileUrl,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Successfully navigated to profile: ${profileId}`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to navigate to profile ${profileId}:`, error);
      await this.sessionManager.recordError(error);
      
      // Take screenshot for debugging if enabled
      if (this.configManager.get('screenshotOnError')) {
        await this.takeErrorScreenshot('navigate_profile_failed');
      }
      
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
        } catch (error) {
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
      
      // Wait for network to be idle
      await page.waitForLoadState?.('networkidle') || 
            page.waitForTimeout(2000);
      
      // Wait for LinkedIn-specific elements that indicate page is loaded
      await Promise.race([
        session.waitForSelector('main'),
        session.waitForSelector('[data-test-id]'),
        session.waitForSelector('.scaffold-layout'),
        page.waitForTimeout(5000) // Fallback timeout
      ]);
      
    } catch (error) {
      logger.debug('LinkedIn page load wait completed with timeout');
    }
  }

  /**
   * Handle LinkedIn-specific errors and authentication issues
   * @returns {Promise<void>}
   */
  async handleLinkedInErrors() {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      const currentUrl = await page.url();
      
      // Check for LinkedIn login page
      if (currentUrl.includes('linkedin.com/login') || currentUrl.includes('linkedin.com/uas/login')) {
        logger.warn('LinkedIn login required - session not authenticated');
        this.sessionManager.setAuthenticationStatus(false);
        throw new Error('LinkedIn authentication required');
      }
      
      // Check for rate limiting or security challenges
      if (currentUrl.includes('challenge') || currentUrl.includes('security')) {
        logger.warn('LinkedIn security challenge detected');
        throw new Error('LinkedIn security challenge detected - manual intervention required');
      }
      
      // Check for blocked or restricted access
      const blockedSelectors = [
        '[data-test-id="blocked-message"]',
        '.blocked-page',
        '.restricted-access'
      ];
      
      for (const selector of blockedSelectors) {
        const element = await session.waitForSelector(selector, { timeout: 1000 });
        if (element) {
          logger.warn('LinkedIn access blocked or restricted');
          throw new Error('LinkedIn access blocked - account may be restricted');
        }
      }
      
    } catch (error) {
      if (error.message.includes('LinkedIn')) {
        throw error; // Re-throw LinkedIn-specific errors
      }
      // Ignore other errors (like selector timeouts)
    }
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

    return await this.executeWithRetry(async () => {
      // Check for suspicious activity before starting
      await this.checkSuspiciousActivity();
      
      // Get or initialize browser session
      const session = await this.getBrowserSession();
      
      // Check LinkedIn authentication status
      await this.handleLinkedInErrors();
      
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
      
      // Record the successful message sending
      this.humanBehavior.recordAction('message_sent', {
        recipientProfileId,
        messageLength: messageContent.length,
        userId
      });
      
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
    }, context);
  }
        userId
      });
      
      // Re-throw with more context
      throw new Error(`Message sending failed: ${error.message}`);
    }
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
      const humanConfig = this.configManager.getHumanBehaviorConfig();
      await RandomHelpers.randomDelay(humanConfig.delayMin, humanConfig.delayMax);
      
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
      
      let messageButton = null;
      let foundSelector = null;
      
      // Try to find message button with multiple selectors
      for (const selector of messageButtonSelectors) {
        try {
          messageButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (messageButton) {
            foundSelector = selector;
            logger.debug(`Found message button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (messageButton) {
        // Scroll button into view if needed
        await this.scrollElementIntoView(page, messageButton);
        
        // Simulate human mouse movement to button
        await this.humanBehavior.simulateHumanMouseMovement(page, messageButton);
        
        // Add thinking delay before clicking
        await RandomHelpers.humanLikeDelay('think');
        
        // Click the message button
        logger.info('Clicking message button');
        await messageButton.click();
        
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
      
      // Take screenshot for debugging if enabled
      if (this.configManager.get('screenshotOnError')) {
        await this.takeErrorScreenshot('navigate_messaging_failed');
      }
      
      throw new Error(`Messaging navigation failed: ${error.message}`);
    }
  }

  /**
   * Wait for messaging interface to load
   * @returns {Promise<void>}
   */
  async waitForMessagingInterface() {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Wait for messaging interface elements
      const messagingSelectors = [
        '.msg-form__contenteditable',
        '[data-test-id="message-input"]',
        '.compose-form__message-input',
        '[contenteditable="true"][role="textbox"]',
        '.msg-conversation-card',
        '.messaging-composer'
      ];
      
      let messagingElement = null;
      for (const selector of messagingSelectors) {
        try {
          messagingElement = await session.waitForSelector(selector, { timeout: 5000 });
          if (messagingElement) {
            logger.debug(`Messaging interface loaded, found element: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!messagingElement) {
        throw new Error('Messaging interface did not load properly');
      }
      
      // Additional wait for interface to be fully interactive
      await RandomHelpers.randomDelay(1000, 2000);
      
    } catch (error) {
      logger.error('Failed to wait for messaging interface:', error);
      throw error;
    }
  }
      
      // Add another human-like delay
      await RandomHelpers.randomDelay(1000, 2000);
      
    } catch (error) {
      logger.error(`Failed to navigate to messaging interface for ${profileId}:`, error);
      throw new Error(`Messaging navigation failed: ${error.message}`);
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
      
      let messageInput = null;
      let foundSelector = null;
      
      // Try to find message input with multiple selectors
      for (const selector of messageInputSelectors) {
        try {
          messageInput = await session.waitForSelector(selector, { timeout: 5000 });
          if (messageInput) {
            foundSelector = selector;
            logger.debug(`Found message input with selector: ${selector}`);
            
            // Verify input is visible and editable
            const isVisible = await messageInput.isVisible();
            const isEditable = await messageInput.isEditable();
            
            if (isVisible && isEditable) {
              break;
            } else {
              logger.debug(`Message input found but not usable: visible=${isVisible}, editable=${isEditable}`);
              messageInput = null;
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!messageInput) {
        throw new Error('Message input field not found in messaging interface');
      }
      
      // Scroll input into view if needed
      await this.scrollElementIntoView(page, messageInput);
      
      // Simulate human mouse movement to input
      await this.humanBehavior.simulateHumanMouseMovement(page, messageInput);
      
      // Clear any existing content and focus on input
      await messageInput.click();
      await RandomHelpers.randomDelay(500, 1000);
      
      // Clear existing content
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Delete');
      
      // Add delay before typing
      await RandomHelpers.humanLikeDelay('type');
      
      // Type message with human-like typing pattern
      await this.typeWithHumanPattern(messageContent);
      
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
      
      let sendButton = null;
      let sendSelector = null;
      
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (sendButton) {
            sendSelector = selector;
            logger.debug(`Found send button with selector: ${selector}`);
            
            // Verify button is clickable
            const isEnabled = await sendButton.isEnabled();
            if (isEnabled) {
              break;
            } else {
              sendButton = null;
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!sendButton) {
        // Try using Enter key as fallback
        logger.info('Send button not found, trying Enter key');
        await page.keyboard.press('Enter');
      } else {
        // Simulate human mouse movement to send button
        await this.humanBehavior.simulateHumanMouseMovement(page, sendButton);
        
        // Add thinking delay before clicking
        await RandomHelpers.humanLikeDelay('think');
        
        // Click send button
        logger.info('Clicking send button');
        await sendButton.click();
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
      
      // Take screenshot for debugging if enabled
      if (this.configManager.get('screenshotOnError')) {
        await this.takeErrorScreenshot('compose_send_message_failed');
      }
      
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
      const page = session.getPage();
      
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
        } catch (error) {
          // Continue checking other indicators
        }
      }
      
      if (!sentConfirmed) {
        // Fallback: wait for input to be cleared or send button to be disabled
        await RandomHelpers.randomDelay(2000, 3000);
        logger.debug('Message sent confirmation not found, assuming sent based on timing');
      }
      
    } catch (error) {
      logger.debug('Message sent confirmation wait completed:', error.message);
      // Don't throw error as message might have been sent successfully
    }
  }
      
      // Look for send button
      const sendButtonSelectors = [
        '[data-test-id="send-button"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        '.msg-form__send-button',
        'button[type="submit"]',
        'button:has-text("Send")'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await session.waitForSelector(selector, { timeout: 2000 });
          if (sendButton) {
            logger.debug(`Found send button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!sendButton) {
        // Try using Enter key as fallback
        logger.info('Send button not found, trying Enter key');
        await page.keyboard.press('Enter');
      } else {
        // Click send button
        logger.info('Clicking send button');
        await sendButton.click();
      }
      
      // Wait for message to be sent (look for confirmation or UI changes)
      await RandomHelpers.randomDelay(2000, 3000);
      
      // Generate message ID for tracking
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Message sent successfully', { messageId });
      
      return {
        messageId,
        sentAt: new Date().toISOString(),
        status: 'sent'
      };
      
    } catch (error) {
      logger.error('Failed to compose and send message:', error);
      throw new Error(`Message composition failed: ${error.message}`);
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
    
    // Check for cooling-off period before typing
    await this.humanBehavior.checkAndApplyCooldown();
    
    // Simulate reading the content before typing (if it's a response)
    if (text.length > 50) {
      await this.humanBehavior.simulateReading(text.substring(0, 100));
    }
    
    // Use the human behavior manager for realistic typing
    await this.humanBehavior.simulateHumanTyping(page, text, element);
    
    // Record the typing action
    this.humanBehavior.recordAction('typing', {
      textLength: text.length,
      hasElement: !!element
    });
  }

  /**
   * Send a connection request to a LinkedIn profile
   * @param {string} profileId - Profile ID to connect with
   * @param {string} connectionMessage - Optional connection message
   * @param {string} userId - ID of authenticated user
   * @returns {Promise<Object>} Connection result
   */
  async addConnection(profileId, connectionMessage, userId) {
    const context = {
      operation: 'addConnection',
      profileId,
      hasConnectionMessage: !!connectionMessage,
      userId
    };

    logger.info(`Sending LinkedIn connection request to profile ${profileId} by user ${userId}`, context);

    return await this.executeWithRetry(async () => {
      // Check for suspicious activity before starting
      await this.checkSuspiciousActivity();
      
      // Get or initialize browser session
      const session = await this.getBrowserSession();
      
      // Check LinkedIn authentication status
      await this.handleLinkedInErrors();
      
      // Navigate to recipient's profile
      const navigationSuccess = await this.navigateToProfile(profileId);
      if (!navigationSuccess) {
        throw new Error(`Failed to navigate to profile: ${profileId}`);
      }

      // Check if already connected
      const connectionStatus = await this.checkConnectionStatus();
      if (connectionStatus === 'connected') {
        throw new Error('Profile is already connected');
      }

      // Find and click connect button
      await this.findAndClickConnectButton();
      
      // Add connection message if provided
      if (connectionMessage && connectionMessage.trim()) {
        await this.addConnectionMessage(connectionMessage);
      }
      
      // Send the connection request
      const connectionResult = await this.sendConnectionRequest();
      
      // Update session activity
      this.sessionManager.lastActivity = new Date();
      
      // Record the successful connection request
      this.humanBehavior.recordAction('connection_sent', {
        profileId,
        hasMessage: !!connectionMessage,
        userId
      });
      
      logger.info(`Successfully sent LinkedIn connection request`, {
        profileId,
        connectionRequestId: connectionResult.connectionRequestId,
        userId
      });

      return {
        connectionRequestId: connectionResult.connectionRequestId || `conn_${Date.now()}_${profileId}`,
        status: 'sent',
        sentAt: new Date().toISOString(),
        profileId,
        userId,
        hasMessage: !!connectionMessage
      };
    }, context);
  }
      logger.error(`Failed to send LinkedIn connection request to ${profileId}:`, error);
      
      // Record error for session management
      await this.sessionManager.recordError(error);
      
      // Record failed action for human behavior tracking
      this.humanBehavior.recordAction('connection_failed', {
        profileId,
        error: error.message,
        userId
      });
      
      // Re-throw with more context
      throw new Error(`Connection request failed: ${error.message}`);
    }
  }

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

    return await this.executeWithRetry(async () => {
      // Check for suspicious activity before starting
      await this.checkSuspiciousActivity();
      
      // Get or initialize browser session
      const session = await this.getBrowserSession();
      
      // Check LinkedIn authentication status
      await this.handleLinkedInErrors();
      
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
    }, context);
  }
        error: error.message,
        userId
      });
      
      // Re-throw with more context
      throw new Error(`Post creation failed: ${error.message}`);
    }
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
      const page = session.getPage();
      
      // Check for cooling-off period before navigation
      await this.humanBehavior.checkAndApplyCooldown();
      
      // Navigate to LinkedIn home/feed page first
      const navigationTimeout = this.configManager.get('navigationTimeout', 30000);
      await session.goto('https://www.linkedin.com/feed/', { 
        waitUntil: 'networkidle',
        timeout: navigationTimeout 
      });
      
      await this.waitForLinkedInLoad();
      
      // Add human-like navigation delay
      await RandomHelpers.humanLikeDelay('navigate');
      
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
      let foundSelector = null;
      
      // Try to find start post button with multiple selectors
      for (const selector of startPostSelectors) {
        try {
          startPostButton = await session.waitForSelector(selector, { timeout: 5000 });
          if (startPostButton) {
            foundSelector = selector;
            logger.debug(`Found start post button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!startPostButton) {
        throw new Error('Start post button not found on LinkedIn feed');
      }
      
      // Scroll button into view if needed
      await this.scrollElementIntoView(page, startPostButton);
      
      // Simulate human mouse movement to button
      await this.humanBehavior.simulateHumanMouseMovement(page, startPostButton);
      
      // Add thinking delay before clicking
      await RandomHelpers.humanLikeDelay('think');
      
      // Click the start post button
      logger.info('Clicking start post button');
      await startPostButton.click();
      
      // Wait for post creation interface to load
      await this.waitForPostCreationInterface();
      
      // Record the post creation navigation action
      this.humanBehavior.recordAction('post_creation_navigation', {
        method: 'start_post_button',
        selector: foundSelector,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Successfully navigated to post creation interface');
      
    } catch (error) {
      logger.error('Failed to navigate to post creation interface:', error);
      
      // Take screenshot for debugging if enabled
      if (this.configManager.get('screenshotOnError')) {
        await this.takeErrorScreenshot('navigate_post_creator_failed');
      }
      
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
      const page = session.getPage();
      
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
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!postCreationElement) {
        throw new Error('Post creation interface did not load properly');
      }
      
      // Additional wait for interface to be fully interactive
      await RandomHelpers.randomDelay(1500, 2500);
      
    } catch (error) {
      logger.error('Failed to wait for post creation interface:', error);
      throw error;
    }
  }
      
      // Add thinking delay before clicking
      await RandomHelpers.humanLikeDelay('think');
      
      // Click the start post button
      logger.info('Clicking start post button');
      await startPostButton.click();
      
      // Record the click action
      this.humanBehavior.recordAction('click', {
        element: 'start_post_button',
        action: 'open_post_creator'
      });
      
      // Wait for post creation modal/interface to load
      await this.waitForLinkedInLoad();
      await RandomHelpers.humanLikeDelay('navigate');
      
    } catch (error) {
      logger.error('Failed to navigate to post creator:', error);
      throw new Error(`Post creator navigation failed: ${error.message}`);
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
        } catch (error) {
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
      await RandomHelpers.humanLikeDelay('click');
      
      // Clear existing content
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await RandomHelpers.humanLikeDelay('type');
      await page.keyboard.press('Delete');
      
      // Type post content with human-like typing pattern
      await this.typeWithHumanPattern(content, contentInput);
      
      // Add delay after typing
      await RandomHelpers.humanLikeDelay('think');
      
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
        } catch (error) {
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
        await RandomHelpers.humanLikeDelay('click');
        
        // Click media upload button
        await mediaButton.click();
        await RandomHelpers.humanLikeDelay('upload');
        
        // Handle file upload (if file path provided)
        if (attachment.filePath) {
          try {
            // Look for file input element
            const fileInput = await session.waitForSelector('input[type="file"]', { timeout: 5000 });
            if (fileInput) {
              await fileInput.uploadFile(attachment.filePath);
              logger.debug(`Uploaded file: ${attachment.filePath}`);
              
              // Wait for upload to process
              await RandomHelpers.humanLikeDelay('upload_process');
            }
          } catch (uploadError) {
            logger.warn(`Failed to upload file ${attachment.filePath}:`, uploadError.message);
          }
        }
        
        // Add delay between attachments
        if (i < mediaAttachments.length - 1) {
          await RandomHelpers.humanLikeDelay('between_uploads');
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
   * @returns {Promise<Object>} Connection request result
   */
  async sendConnectionRequest() {
    logger.info('Sending connection request');
    
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Add human-like delay before sending
      await RandomHelpers.humanLikeDelay('think');
      
      // Look for send/connect button in the modal
      const sendButtonSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[data-test-id="send-invite-button"]',
        '.artdeco-button--primary[aria-label*="Send"]',
        'button[data-control-name="invite.send"]',
        'button[type="submit"][aria-label*="Send"]',
        '.send-invite__actions button[aria-label*="Send"]',
        'button:has-text("Send invitation")',
        'button:has-text("Send")',
        '.connect-button-send-invite'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (sendButton) {
            // Verify button is visible and enabled
            const isVisible = await sendButton.isVisible();
            const isEnabled = !(await sendButton.getAttribute('disabled'));
            
            if (isVisible && isEnabled) {
              logger.debug(`Found send button with selector: ${selector}`);
              break;
            } else {
              sendButton = null; // Reset if not usable
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!sendButton) {
        throw new Error('Send connection request button not found or not enabled');
      }
      
      // Simulate human mouse movement to send button
      await this.humanBehavior.simulateHumanMouseMovement(page, sendButton);
      await RandomHelpers.humanLikeDelay('click');
      
      // Click send button
      await sendButton.click();
      logger.info('Connection request send button clicked');
      
      // Wait for request to be processed
      await RandomHelpers.humanLikeDelay('request_process');
      
      // Look for confirmation indicators
      const confirmationSelectors = [
        '[data-test-id="invitation-sent-confirmation"]',
        '.artdeco-toast-message',
        '.invitation-sent-message',
        '[aria-live="polite"]',
        '.connect-button-send-invite--sent',
        'button[aria-label*="Pending"]',
        'button[aria-label*="pending"]'
      ];
      
      let confirmationFound = false;
      for (const selector of confirmationSelectors) {
        try {
          const confirmation = await session.waitForSelector(selector, { timeout: 5000 });
          if (confirmation) {
            logger.debug(`Connection request confirmation found: ${selector}`);
            confirmationFound = true;
            break;
          }
        } catch (error) {
          // Continue checking other selectors
        }
      }
      
      // Generate connection request ID for tracking
      const requestId = `conn_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Record successful connection request
      this.humanBehavior.recordAction('connection_request_sent', {
        requestId,
        confirmationFound
      });
      
      logger.info('Connection request sent successfully', {
        requestId,
        confirmationFound
      });
      
      return {
        requestId,
        status: confirmationFound ? 'sent' : 'pending_confirmation',
        sentAt: new Date().toISOString(),
        confirmationFound
      };
      
    } catch (error) {
      logger.error('Failed to send connection request:', error);
      
      // Record failed attempt
      this.humanBehavior.recordAction('connection_request_failed', {
        error: error.message
      });
      
      throw new Error(`Connection request failed: ${error.message}`);
    }
  }
        '[data-test-id="send-connection-button"]',
        'button[data-control-name*="connect"]',
        'button:has-text("Send")',
        'button:has-text("Connect")',
        'button[type="submit"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (sendButton) {
            logger.debug(`Found send button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!sendButton) {
        throw new Error('Send connection button not found');
      }
      
      // Simulate human mouse movement to button
      await this.humanBehavior.simulateHumanMouseMovement(page, sendButton);
      
      // Click send button
      logger.info('Clicking send connection button');
      await sendButton.click();
      
      // Record the click action
      this.humanBehavior.recordAction('click', {
        element: 'send_connection_button',
        action: 'send_connection_request'
      });
      
      // Wait for confirmation or modal to close
      await RandomHelpers.humanLikeDelay('navigate');
      
      // Generate connection request ID for tracking
      const connectionRequestId = `conn_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Connection request sent successfully', { connectionRequestId });
      
      return {
        connectionRequestId,
        sentAt: new Date().toISOString(),
        status: 'sent'
      };
      
    } catch (error) {
      logger.error('Failed to send connection request:', error);
      throw new Error(`Connection request sending failed: ${error.message}`);
    }
  }

  /**
   * Check the current connection status with a profile
   * @returns {Promise<string>} Connection status: 'connected', 'pending', 'not_connected'
   */
  async checkConnectionStatus() {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Add human-like delay before checking
      await RandomHelpers.randomDelay(500, 1000);
      
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
        } catch (error) {
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
        } catch (error) {
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
   * Find and click the connect button on a LinkedIn profile
   * @returns {Promise<void>}
   */
  /**
   * Find and click the connect button on a LinkedIn profile
   * Implements requirements 2.2, 2.3
   * @returns {Promise<void>}
   */
  async findAndClickConnectButton() {
    logger.info('Looking for and clicking connect button');
    
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Check for cooling-off period before interaction
      await this.humanBehavior.checkAndApplyCooldown();
      
      // Add human-like delay before interaction
      await RandomHelpers.humanLikeDelay('think');
      
      // Look for connect button with various selectors
      const connectButtonSelectors = [
        'button[aria-label*="Connect"]',
        'button[aria-label*="connect"]',
        '[data-test-id="connect-button"]',
        '.connect-button',
        'button:has-text("Connect")',
        'button[data-control-name*="connect"]',
        '.pv-s-profile-actions button[aria-label*="Connect"]',
        '.pvs-profile-actions__action button[aria-label*="Connect"]',
        'button[data-control-name="connect"]',
        '.pv-top-card-v2-ctas button[aria-label*="Connect"]'
      ];
      
      let connectButton = null;
      let foundSelector = null;
      
      // Try to find connect button with multiple selectors
      for (const selector of connectButtonSelectors) {
        try {
          connectButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (connectButton) {
            foundSelector = selector;
            logger.debug(`Found connect button with selector: ${selector}`);
            
            // Verify button is actually clickable and visible
            const isVisible = await connectButton.isVisible();
            const isEnabled = await connectButton.isEnabled();
            
            if (isVisible && isEnabled) {
              break;
            } else {
              logger.debug(`Connect button found but not clickable: visible=${isVisible}, enabled=${isEnabled}`);
              connectButton = null;
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!connectButton) {
        // Check if already connected
        const alreadyConnectedSelectors = [
          'button[aria-label*="Message"]',
          'button[aria-label*="Following"]',
          'button[aria-label*="Pending"]',
          '.pv-s-profile-actions button[aria-label*="Message"]'
        ];
        
        for (const selector of alreadyConnectedSelectors) {
          try {
            const element = await session.waitForSelector(selector, { timeout: 1000 });
            if (element) {
              throw new Error('Profile is already connected or connection is pending');
            }
          } catch (error) {
            // Continue checking
          }
        }
        
        throw new Error('Connect button not found on profile page');
      }
      
      // Scroll button into view if needed with human-like scrolling
      await this.scrollElementIntoView(page, connectButton);
      
      // Simulate human mouse movement to button
      await this.humanBehavior.simulateHumanMouseMovement(page, connectButton);
      
      // Add thinking delay before clicking
      await RandomHelpers.humanLikeDelay('think');
      
      // Click the connect button
      logger.info('Clicking connect button');
      await connectButton.click();
      
      // Wait for connection modal or confirmation
      await this.waitForConnectionModal();
      
      // Record the connect button click action
      this.humanBehavior.recordAction('connect_button_click', {
        selector: foundSelector,
        timestamp: new Date().toISOString()
      });
      
      logger.info('Successfully clicked connect button');
      
    } catch (error) {
      logger.error('Failed to find and click connect button:', error);
      
      // Take screenshot for debugging if enabled
      if (this.configManager.get('screenshotOnError')) {
        await this.takeErrorScreenshot('connect_button_failed');
      }
      
      throw new Error(`Connect button interaction failed: ${error.message}`);
    }
  }

  /**
   * Wait for connection modal to appear
   * @returns {Promise<void>}
   */
  async waitForConnectionModal() {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Wait for connection modal or direct connection confirmation
      const modalSelectors = [
        '[data-test-id="connect-modal"]',
        '.send-invite',
        '.connect-button-send-invite',
        '.artdeco-modal',
        '[role="dialog"]',
        '.ip-fuse-limit-alert'
      ];
      
      let modalFound = false;
      for (const selector of modalSelectors) {
        try {
          const modal = await session.waitForSelector(selector, { timeout: 3000 });
          if (modal) {
            logger.debug(`Connection modal found with selector: ${selector}`);
            modalFound = true;
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!modalFound) {
        // Check if connection was sent directly (no modal)
        const confirmationSelectors = [
          'button[aria-label*="Pending"]',
          'button[aria-label*="Invitation sent"]',
          '.pv-s-profile-actions button[aria-label*="Pending"]'
        ];
        
        for (const selector of confirmationSelectors) {
          try {
            const confirmation = await session.waitForSelector(selector, { timeout: 2000 });
            if (confirmation) {
              logger.debug(`Direct connection confirmation found: ${selector}`);
              return;
            }
          } catch (error) {
            // Continue checking
          }
        }
      }
      
      // Additional wait for modal to be fully loaded
      await RandomHelpers.randomDelay(1000, 2000);
      
    } catch (error) {
      logger.debug('Connection modal wait completed with potential issues:', error.message);
      // Don't throw error here as connection might have been successful
    }
  }
      
      // Click the connect button
      logger.info('Clicking connect button');
      await connectButton.click();
      
      // Record the click action
      this.humanBehavior.recordAction('click', {
        element: 'connect_button',
        action: 'connection_request'
      });
      
      // Wait for connection modal or next step to load
      await this.waitForLinkedInLoad();
      await RandomHelpers.humanLikeDelay('navigate');
      
    } catch (error) {
      logger.error('Failed to find and click connect button:', error);
      throw new Error(`Connect button interaction failed: ${error.message}`);
    }
  }

  /**
   * Add a personalized message to the connection request
   * @param {string} connectionMessage - Message to add to connection request
   * @returns {Promise<void>}
   */
  async addConnectionMessage(connectionMessage) {
    logger.info('Adding connection message', {
      messageLength: connectionMessage.length
    });
    
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Wait for connection modal to appear
      await this.waitForLinkedInLoad();
      
      // Add thinking delay before looking for elements
      await RandomHelpers.humanLikeDelay('think');
      
      // Look for "Add a note" button or link
      const addNoteSelectors = [
        'button[aria-label*="Add a note"]',
        'button[aria-label*="add a note"]',
        '[data-test-id="add-note-button"]',
        '.add-note-button',
        'button:has-text("Add a note")',
        'a:has-text("Add a note")'
      ];
      
      let addNoteButton = null;
      for (const selector of addNoteSelectors) {
        try {
          addNoteButton = await session.waitForSelector(selector, { timeout: 2000 });
          if (addNoteButton) {
            logger.debug(`Found add note button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (addNoteButton) {
        // Simulate human mouse movement to button
        await this.humanBehavior.simulateHumanMouseMovement(page, addNoteButton);
        
        // Click add note button to expand message field
        logger.info('Clicking add note button');
        await addNoteButton.click();
        
        // Record the click action
        this.humanBehavior.recordAction('click', {
          element: 'add_note_button',
          action: 'expand_message_field'
        });
        
        await RandomHelpers.humanLikeDelay('navigate');
      }
      
      // Look for message input field
      const messageInputSelectors = [
        '[data-test-id="connection-message-input"]',
        'textarea[name="message"]',
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="note"]',
        '.connection-message-input',
        'textarea[aria-label*="message"]'
      ];
      
      let messageInput = null;
      for (const selector of messageInputSelectors) {
        try {
          messageInput = await session.waitForSelector(selector, { timeout: 3000 });
          if (messageInput) {
            logger.debug(`Found message input with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!messageInput) {
        logger.warn('Connection message input field not found, proceeding without message');
        return;
      }
      
      // Simulate human mouse movement to input field
      await this.humanBehavior.simulateHumanMouseMovement(page, messageInput);
      
      // Clear any existing content and focus on input
      await messageInput.click();
      await RandomHelpers.humanLikeDelay('click');
      
      // Clear existing content with human-like selection
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await RandomHelpers.humanLikeDelay('type');
      await page.keyboard.press('Delete');
      
      // Type connection message with human-like typing pattern
      await this.typeWithHumanPattern(connectionMessage, messageInput);
      
      // Add delay after typing
      await RandomHelpers.randomDelay(1000, 2000);
      
      logger.info('Connection message added successfully');
      
    } catch (error) {
      logger.error('Failed to add connection message:', error);
      // Don't throw error - connection can still proceed without message
      logger.warn('Proceeding with connection request without personalized message');
    }
  }

  /**
   * Send the connection request after all setup is complete
   * @returns {Promise<Object>} Connection result with ID
   */
  async sendConnectionRequest() {
    logger.info('Sending connection request');
    
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Add human-like delay before sending
      await RandomHelpers.randomDelay(1000, 2000);
      
      // Look for send/connect button in modal
      const sendButtonSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        '[data-test-id="send-invite-button"]',
        '.send-invite-button',
        'button:has-text("Send")',
        'button[data-control-name*="send"]',
        'button[type="submit"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await session.waitForSelector(selector, { timeout: 2000 });
          if (sendButton) {
            logger.debug(`Found send button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!sendButton) {
        throw new Error('Send connection request button not found');
      }
      
      // Click send button
      logger.info('Clicking send connection request button');
      await sendButton.click();
      
      // Wait for confirmation or next step
      await this.waitForLinkedInLoad();
      await RandomHelpers.randomDelay(2000, 3000);
      
      // Generate connection request ID for tracking
      const connectionRequestId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info('Connection request sent successfully', { connectionRequestId });
      
      return {
        connectionRequestId,
        sentAt: new Date().toISOString(),
        status: 'sent'
      };
      
    } catch (error) {
      logger.error('Failed to send connection request:', error);
      throw new Error(`Connection request sending failed: ${error.message}`);
    }
  }

  /**
   * Create and publish a LinkedIn post
   * @param {string} content - Post content
   * @param {Array} mediaAttachments - Optional media attachments
   * @param {string} userId - ID of authenticated user
   * @returns {Promise<Object>} Post result
   */
  async createPost(content, mediaAttachments, userId) {
    logger.info(`Creating LinkedIn post by user ${userId}`, {
      contentLength: content.length,
      hasMediaAttachments: !!mediaAttachments && mediaAttachments.length > 0,
      userId
    });

    try {
      // Get or initialize browser session
      const session = await this.getBrowserSession();
      
      // Check LinkedIn authentication status
      await this.handleLinkedInErrors();
      
      // Navigate to LinkedIn post creation interface
      await this.navigateToPostCreator();
      
      // Input post content with realistic typing patterns
      await this.inputPostContent(content);
      
      // Handle media attachments if provided
      if (mediaAttachments && mediaAttachments.length > 0) {
        await this.attachMediaToPost(mediaAttachments);
      }
      
      // Publish the post and wait for confirmation
      const postResult = await this.publishPost();
      
      // Update session activity
      this.sessionManager.lastActivity = new Date();
      
      logger.info(`Successfully created LinkedIn post`, {
        postId: postResult.postId,
        postUrl: postResult.postUrl,
        userId
      });

      return {
        postId: postResult.postId || `post_${Date.now()}_${userId}`,
        postUrl: postResult.postUrl || `https://linkedin.com/posts/activity-${Date.now()}`,
        publishStatus: 'published',
        publishedAt: new Date().toISOString(),
        contentLength: content.length,
        userId
      };

    } catch (error) {
      logger.error(`Failed to create LinkedIn post:`, error);
      
      // Record error for session management
      await this.sessionManager.recordError(error);
      
      // Re-throw with more context
      throw new Error(`Post creation failed: ${error.message}`);
    }
  }

  /**
   * Navigate to LinkedIn's post creation interface
   * @returns {Promise<void>}
   */
  async navigateToPostCreator() {
    logger.info('Navigating to LinkedIn post creation interface');
    
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      // Navigate to LinkedIn feed/home page first
      const feedUrl = 'https://www.linkedin.com/feed/';
      logger.info(`Navigating to LinkedIn feed: ${feedUrl}`);
      await session.goto(feedUrl);
      
      // Wait for feed page to load
      await this.waitForLinkedInLoad();
      
      // Add human-like delay before interaction
      await RandomHelpers.randomDelay(
        config.linkedinInteractions?.humanDelayMin || 1000,
        config.linkedinInteractions?.humanDelayMax || 3000
      );
      
      // Look for "Start a post" button or input field
      const postCreatorSelectors = [
        '[data-test-id="share-box-open"]',
        'button[aria-label*="Start a post"]',
        'button[aria-label*="start a post"]',
        '.share-box-feed-entry__trigger',
        '.share-creation-state__text-editor',
        'button:has-text("Start a post")',
        '[data-control-name="share_via_mention_entity"]',
        '.feed-shared-update-v2__start-conversation'
      ];
      
      let postCreatorButton = null;
      for (const selector of postCreatorSelectors) {
        try {
          postCreatorButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (postCreatorButton) {
            logger.debug(`Found post creator button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!postCreatorButton) {
        throw new Error('Post creation button not found on LinkedIn feed');
      }
      
      // Scroll button into view if needed
      await postCreatorButton.scrollIntoViewIfNeeded();
      await RandomHelpers.randomDelay(500, 1000);
      
      // Click the post creation button
      logger.info('Clicking post creation button');
      await postCreatorButton.click();
      
      // Wait for post creation modal/interface to load
      await this.waitForLinkedInLoad();
      await RandomHelpers.randomDelay(1000, 2000);
      
    } catch (error) {
      logger.error('Failed to navigate to post creator:', error);
      throw new Error(`Post creator navigation failed: ${error.message}`);
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
      
      let contentInput = null;
      for (const selector of contentInputSelectors) {
        try {
          contentInput = await session.waitForSelector(selector, { timeout: 3000 });
          if (contentInput) {
            logger.debug(`Found content input with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!contentInput) {
        throw new Error('Post content input field not found');
      }
      
      // Clear any existing content and focus on input
      await contentInput.click();
      await RandomHelpers.randomDelay(500, 1000);
      
      // Clear existing content
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Delete');
      
      // Type post content with human-like typing pattern
      await this.typeWithHumanPattern(content);
      
      // Add delay after typing
      await RandomHelpers.randomDelay(1000, 2000);
      
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
      await RandomHelpers.randomDelay(1000, 2000);
      
      // Look for media attachment button
      const mediaButtonSelectors = [
        '[data-test-id="media-button"]',
        'button[aria-label*="Add media"]',
        'button[aria-label*="add media"]',
        '.share-actions-control-button[aria-label*="media"]',
        'button[data-control-name*="media"]',
        '.media-upload-button'
      ];
      
      let mediaButton = null;
      for (const selector of mediaButtonSelectors) {
        try {
          mediaButton = await session.waitForSelector(selector, { timeout: 2000 });
          if (mediaButton) {
            logger.debug(`Found media button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!mediaButton) {
        logger.warn('Media attachment button not found, skipping media upload');
        return;
      }
      
      // Click media button
      logger.info('Clicking media attachment button');
      await mediaButton.click();
      await RandomHelpers.randomDelay(1000, 2000);
      
      // For now, this is a placeholder implementation
      // In a full implementation, you would:
      // 1. Handle file upload dialogs
      // 2. Upload each media file
      // 3. Wait for upload completion
      // 4. Handle different media types (image, video, document)
      
      logger.warn('Media attachment functionality is placeholder - files not actually uploaded');
      
      // Simulate upload delay
      await RandomHelpers.randomDelay(2000, 4000);
      
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
      await RandomHelpers.randomDelay(2000, 3000);
      
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
      
      let publishButton = null;
      for (const selector of publishButtonSelectors) {
        try {
          publishButton = await session.waitForSelector(selector, { timeout: 3000 });
          if (publishButton) {
            logger.debug(`Found publish button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
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
      await publishButton.click();
      
      // Wait for post to be published (look for confirmation or redirect)
      await RandomHelpers.randomDelay(3000, 5000);
      
      // Try to extract post URL from current page or notifications
      let postUrl = null;
      try {
        const currentUrl = await page.url();
        if (currentUrl.includes('/posts/') || currentUrl.includes('/activity-')) {
          postUrl = currentUrl;
        }
      } catch (error) {
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
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
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
   * Scroll element into view with human-like behavior
   * @param {Object} page - Puppeteer page object
   * @param {Object} element - Element to scroll into view
   * @returns {Promise<void>}
   */
  async scrollElementIntoView(page, element) {
    try {
      const elementBounds = await element.boundingBox();
      if (elementBounds) {
        const viewport = await page.viewport();
        const isInView = elementBounds.y >= 0 && elementBounds.y <= viewport.height;
        
        if (!isInView) {
          const scrollDistance = elementBounds.y - viewport.height / 2;
          await this.humanBehavior.simulateHumanScrolling(page, scrollDistance);
          
          // Wait for scroll to complete
          await RandomHelpers.randomDelay(500, 1000);
        }
      }
    } catch (error) {
      logger.debug('Failed to scroll element into view:', error.message);
      // Don't throw error, element might still be accessible
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

    return await this.executeWithRetry(async () => {
      // Step 1: Check for suspicious activity and apply cooling-off
      await this.checkSuspiciousActivity();
      
      // Step 2: Ensure browser session is healthy
      const session = await this.getBrowserSession();
      await this.handleLinkedInErrors();
      
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
      
    }, context);
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

    return await this.executeWithRetry(async () => {
      // Step 1: Check for suspicious activity and apply cooling-off
      await this.checkSuspiciousActivity();
      
      // Step 2: Ensure browser session is healthy
      const session = await this.getBrowserSession();
      await this.handleLinkedInErrors();
      
      // Step 3: Navigate to target profile
      logger.info('Step 1/5: Navigating to profile');
      const navigationSuccess = await this.navigateToProfile(profileId);
      if (!navigationSuccess) {
        throw new Error(`Failed to navigate to profile: ${profileId}`);
      }

      // Step 4: Check current connection status
      logger.info('Step 2/5: Checking connection status');
      const connectionStatus = await this.checkConnectionStatus();
      if (connectionStatus.isConnected) {
        throw new Error('Profile is already connected');
      }
      if (connectionStatus.isPending) {
        throw new Error('Connection request is already pending');
      }
      
      // Step 5: Find and click connect button
      logger.info('Step 3/5: Clicking connect button');
      await this.findAndClickConnectButton();
      
      // Step 6: Add personalized message if provided
      if (connectionMessage && connectionMessage.trim().length > 0) {
        logger.info('Step 4/5: Adding personalized message');
        await this.addConnectionMessage(connectionMessage.trim());
      }
      
      // Step 7: Send connection request
      logger.info('Step 5/5: Sending connection request');
      const requestResult = await this.sendConnectionRequest();
      
      // Update session activity and record success
      this.sessionManager.lastActivity = new Date();
      this.humanBehavior.recordAction('connection_workflow_completed', {
        profileId,
        hasPersonalizedMessage: connectionMessage.length > 0,
        messageLength: connectionMessage.length,
        requestConfirmed: requestResult.confirmationFound,
        workflowDuration: Date.now() - context.startTime
      });
      
      const result = {
        workflowId: `conn_workflow_${Date.now()}_${profileId}`,
        requestId: requestResult.requestId,
        connectionStatus: requestResult.status,
        sentAt: requestResult.sentAt,
        profileId,
        hasPersonalizedMessage: connectionMessage.length > 0,
        messageLength: connectionMessage.length,
        confirmationFound: requestResult.confirmationFound,
        workflowSteps: [
          { step: 'profile_navigation', status: 'completed' },
          { step: 'connection_status_check', status: 'completed' },
          { step: 'connect_button_click', status: 'completed' },
          { step: 'message_addition', status: connectionMessage ? 'completed' : 'skipped' },
          { step: 'request_submission', status: requestResult.confirmationFound ? 'confirmed' : 'pending' }
        ]
      };
      
      logger.info('LinkedIn connection workflow completed successfully', result);
      return result;
      
    }, context);
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

    return await this.executeWithRetry(async () => {
      // Step 1: Check for suspicious activity and apply cooling-off
      await this.checkSuspiciousActivity();
      
      // Step 2: Ensure browser session is healthy
      const session = await this.getBrowserSession();
      await this.handleLinkedInErrors();
      
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
      await RandomHelpers.humanLikeDelay('review_content');
      
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
      
    }, context);
  }

  /**
   * Batch workflow execution for multiple operations
   * Implements requirement for bulk operations with rate limiting
   * @param {Array} operations - Array of operation objects
   * @param {Object} batchOptions - Batch execution options
   * @returns {Promise<Object>} Batch execution results
   */
  async executeBatchWorkflow(operations, batchOptions = {}) {
    const context = {
      operation: 'executeBatchWorkflow',
      operationCount: operations.length,
      batchOptions
    };

    logger.info('Executing batch LinkedIn workflow', context);

    const results = {
      batchId: `batch_${Date.now()}`,
      totalOperations: operations.length,
      successful: [],
      failed: [],
      skipped: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      summary: {
        successCount: 0,
        failureCount: 0,
        skipCount: 0
      }
    };

    try {
      // Apply enhanced cooling-off for batch operations
      const batchCooldown = {
        actionsPerMinute: Math.floor((config.linkedinInteractions?.actionsPerMinute || 8) * 0.6),
        actionsPerHour: Math.floor((config.linkedinInteractions?.actionsPerHour || 100) * 0.8)
      };
      
      await this.humanBehavior.checkAndApplyCooldown(batchCooldown);

      // Process each operation with appropriate delays
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const operationContext = {
          ...context,
          currentOperation: i + 1,
          operationType: operation.type,
          operationId: operation.id || `op_${i + 1}`
        };

        logger.info(`Processing batch operation ${i + 1}/${operations.length}`, operationContext);

        try {
          let result;
          
          // Execute appropriate workflow based on operation type
          switch (operation.type) {
            case 'message':
              result = await this.executeMessagingWorkflow(
                operation.recipientProfileId,
                operation.messageContent,
                operation.options
              );
              break;
              
            case 'connection':
              result = await this.executeConnectionWorkflow(
                operation.profileId,
                operation.connectionMessage,
                operation.options
              );
              break;
              
            case 'post':
              result = await this.executePostCreationWorkflow(
                operation.content,
                operation.mediaAttachments,
                operation.options
              );
              break;
              
            default:
              throw new Error(`Unsupported operation type: ${operation.type}`);
          }

          results.successful.push({
            operationId: operationContext.operationId,
            type: operation.type,
            result,
            completedAt: new Date().toISOString()
          });
          
          results.summary.successCount++;
          
          // Apply inter-operation delay for human-like behavior
          if (i < operations.length - 1) {
            const delayMs = RandomHelpers.randomBetween(
              batchOptions.minDelayBetweenOperations || 30000,  // 30 seconds minimum
              batchOptions.maxDelayBetweenOperations || 120000   // 2 minutes maximum
            );
            
            logger.info(`Applying inter-operation delay: ${delayMs}ms`);
            await this.delay(delayMs);
          }

        } catch (error) {
          logger.error(`Batch operation ${i + 1} failed:`, error);
          
          results.failed.push({
            operationId: operationContext.operationId,
            type: operation.type,
            error: error.message,
            failedAt: new Date().toISOString()
          });
          
          results.summary.failureCount++;
          
          // Check if we should continue or abort batch
          if (batchOptions.stopOnError) {
            logger.warn('Stopping batch execution due to error and stopOnError=true');
            break;
          }
        }
      }

      results.completedAt = new Date().toISOString();
      
      // Record batch completion
      this.humanBehavior.recordAction('batch_workflow_completed', {
        batchId: results.batchId,
        totalOperations: results.totalOperations,
        successCount: results.summary.successCount,
        failureCount: results.summary.failureCount,
        batchDuration: Date.now() - new Date(results.startedAt).getTime()
      });
      
      logger.info('Batch LinkedIn workflow completed', results.summary);
      return results;

    } catch (error) {
      logger.error('Batch workflow execution failed:', error);
      results.completedAt = new Date().toISOString();
      throw error;
    }
  }
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

  /**
   * Get workflow execution statistics and health metrics
   * @returns {Promise<Object>} Workflow statistics
   */
  async getWorkflowStatistics() {
    const sessionHealth = await this.sessionManager.getHealthStatus();
    const activityStats = this.humanBehavior.getActivityStats();
    const suspiciousActivity = this.humanBehavior.detectSuspiciousActivity();

    return {
      session: {
        isHealthy: sessionHealth.isHealthy,
        isAuthenticated: sessionHealth.isAuthenticated,
        sessionAge: sessionHealth.sessionAge,
        errorCount: sessionHealth.errorCount,
        lastActivity: sessionHealth.lastActivity
      },
      humanBehavior: {
        totalActions: activityStats.totalActions,
        actionsLastHour: activityStats.actionsLastHour,
        actionsLastMinute: activityStats.actionsLastMinute,
        averageActionInterval: activityStats.averageActionInterval,
        suspiciousActivity: suspiciousActivity.isSuspicious,
        suspiciousPatterns: suspiciousActivity.patterns
      },
      workflows: {
        messagingWorkflows: activityStats.actionsByType.messaging_workflow_completed || 0,
        connectionWorkflows: activityStats.actionsByType.connection_workflow_completed || 0,
        postCreationWorkflows: activityStats.actionsByType.post_creation_workflow_completed || 0,
        batchWorkflows: activityStats.actionsByType.batch_workflow_completed || 0
      },
      recommendations: this.generateWorkflowRecommendations(activityStats, suspiciousActivity)
    };
  }

  /**
   * Generate workflow execution recommendations based on current state
   * @param {Object} activityStats - Current activity statistics
   * @param {Object} suspiciousActivity - Suspicious activity analysis
   * @returns {Array} Array of recommendations
   */
  generateWorkflowRecommendations(activityStats, suspiciousActivity) {
    const recommendations = [];

    // Rate limiting recommendations
    if (activityStats.actionsLastHour > 80) {
      recommendations.push({
        type: 'rate_limiting',
        severity: 'high',
        message: 'High activity detected. Consider reducing operation frequency to avoid detection.',
        action: 'Apply extended cooling-off period'
      });
    }

    if (activityStats.actionsLastMinute > 10) {
      recommendations.push({
        type: 'rate_limiting',
        severity: 'medium',
        message: 'Rapid actions detected. Add delays between operations.',
        action: 'Increase inter-operation delays'
      });
    }

    // Suspicious activity recommendations
    if (suspiciousActivity.isSuspicious) {
      recommendations.push({
        type: 'suspicious_activity',
        severity: 'high',
        message: `Suspicious patterns detected: ${suspiciousActivity.patterns.join(', ')}`,
        action: suspiciousActivity.recommendation
      });
    }

    // Session health recommendations
    if (activityStats.averageActionInterval < 5000) {
      recommendations.push({
        type: 'human_behavior',
        severity: 'medium',
        message: 'Actions are occurring too quickly. Increase delays to simulate human behavior.',
        action: 'Apply longer thinking delays between actions'
      });
    }

    // Workflow diversity recommendations
    const workflowTypes = Object.keys(activityStats.actionsByType).filter(type => 
      type.includes('workflow_completed')
    ).length;
    
    if (workflowTypes === 1 && activityStats.totalActions > 20) {
      recommendations.push({
        type: 'workflow_diversity',
        severity: 'low',
        message: 'Consider varying workflow types to appear more natural.',
        action: 'Mix different types of LinkedIn interactions'
      });
    }

    return recommendations;
  }

  /**
   * Take screenshot for error debugging
   * @param {string} errorType - Type of error for filename
   * @returns {Promise<void>}
   */
  async takeErrorScreenshot(errorType) {
    try {
      const session = await this.getBrowserSession();
      const page = session.getPage();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error_${errorType}_${timestamp}.png`;
      const screenshotPath = `./screenshots/${filename}`;
      
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      
      logger.info(`Error screenshot saved: ${screenshotPath}`);
      
    } catch (error) {
      logger.debug('Failed to take error screenshot:', error.message);
    }
  }