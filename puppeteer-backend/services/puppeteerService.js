import puppeteer from 'puppeteer';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import RandomHelpers from '../utils/randomHelpers.js';

export class PuppeteerService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      const resolvedHeadless = !!config.puppeteer.headless;
      const displayEnv = process.env.DISPLAY || '';
      const sessionType = process.env.XDG_SESSION_TYPE || '';
      logger.info(
        `Initializing Puppeteer browser... HEADLESS env=${process.env.HEADLESS} resolved headless=${resolvedHeadless} DISPLAY=${displayEnv || 'unset'} session=${sessionType || 'unknown'}`
      );
      
      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ];

      // Non-headless UI niceties
      if (!resolvedHeadless) {
        launchArgs.push('--start-maximized', '--window-size=1400,900');
        if ((process.platform === 'linux') && sessionType.toLowerCase() === 'wayland') {
          launchArgs.push('--ozone-platform=wayland', '--enable-features=UseOzonePlatform');
        }
      }

      // If user asked for UI but no DISPLAY is available, warn and keep headless to avoid crash
      const effectiveHeadless = !resolvedHeadless && !displayEnv ? 'new' : (resolvedHeadless ? 'new' : false);
      if (!resolvedHeadless && !displayEnv) {
        logger.warn('HEADLESS=false requested but DISPLAY is not set. Browser UI cannot be shown in this environment. Running headless instead.');
      }

      this.browser = await puppeteer.launch({
        // In Puppeteer v20+, headless can be a string 'new'.
        headless: effectiveHeadless,
        slowMo: config.puppeteer.slowMo,
        defaultViewport: null,
        args: launchArgs,
      });

      this.page = await this.browser.newPage();
      
      // Set viewport
      await this.page.setViewport({
        width: config.puppeteer.viewport.width,
        height: config.puppeteer.viewport.height,
        deviceScaleFactor: 1,
        isMobile: false
      });

      // Set user agent
      await this.page.setUserAgent(RandomHelpers.getRandomUserAgent());
      
      // Set default timeout
      this.page.setDefaultTimeout(config.timeouts.default);
      
      logger.info('Puppeteer browser initialized successfully');
      return this.page;
    } catch (error) {
      logger.error('Failed to initialize Puppeteer:', error);
      throw error;
    }
  }

  async goto(url, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      logger.debug(`Navigating to: ${url}`);
      const response = await this.page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.timeouts.navigation,
        ...options
      });
      
      // Add random delay to mimic human behavior
      await RandomHelpers.randomDelay(1000, 3000);
      
      return response;
    } catch (error) {
      logger.error(`Failed to navigate to ${url}:`, error);
      throw error;
    }
  }

  async waitForSelector(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      return await this.page.waitForSelector(selector, {
        timeout: 5000,
        ...options
      });
    } catch (error) {
      logger.warn(`Selector not found: ${selector}`);
      return null;
    }
  }

  async safeClick(selector, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const element = await this.waitForSelector(selector);
      if (element) {
        await element.click(options);
        await RandomHelpers.randomDelay(500, 1500);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`Failed to click selector: ${selector}`, error);
      return false;
    }
  }

  async safeType(selector, text, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const element = await this.waitForSelector(selector);
      if (element) {
        await element.type(text, {
          delay: RandomHelpers.randomInRange(50, 150),
          ...options
        });
        return true;
      }
      return false;
    } catch (error) {
      logger.warn(`Failed to type in selector: ${selector}`, error);
      return false;
    }
  }

  async screenshot(path, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      await this.page.screenshot({
        path,
        fullPage: true,
        ...options
      });
      logger.debug(`Screenshot saved: ${path}`);
    } catch (error) {
      logger.error(`Failed to take screenshot: ${path}`, error);
      throw error;
    }
  }

  async scrollPage(direction = 'down', distance = null) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const scrollDistance = distance || (direction === 'down' ? 
        'window.innerHeight' : '-window.innerHeight');
      
      await this.page.evaluate((dist) => {
        window.scrollBy(0, typeof dist === 'string' ? eval(dist) : dist);
      }, scrollDistance);
      
      await RandomHelpers.randomDelay(1000, 2000);
    } catch (error) {
      logger.error('Failed to scroll page:', error);
      throw error;
    }
  }

  async extractLinks(selector = 'ul li a') {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const links = await this.page.$$eval(selector, (anchors) => {
        return anchors.map(anchor => {
          const href = anchor.href;
          const match = href.match(/\/in\/(.*?)\?mini/);
          return match ? match[1] : null;
        }).filter(Boolean);
      });
      
      return [...new Set(links)]; // Remove duplicates
    } catch (error) {
      logger.error('Failed to extract links:', error);
      return [];
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        logger.info('Puppeteer browser closed');
      }
    } catch (error) {
      logger.error('Error closing browser:', error);
    }
  }

  getPage() {
    return this.page;
  }

  getBrowser() {
    return this.browser;
  }
}

export default PuppeteerService;