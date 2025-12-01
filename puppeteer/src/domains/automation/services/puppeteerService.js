import puppeteer from 'puppeteer';
import config from '../../../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import RandomHelpers from '../../shared/utils/randomHelpers.js';

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

      if (!resolvedHeadless) {
        launchArgs.push('--start-maximized', '--window-size=1400,900');
        if ((process.platform === 'linux') && sessionType.toLowerCase() === 'wayland') {
          launchArgs.push('--ozone-platform=wayland', '--enable-features=UseOzonePlatform');
        }
      }

      const effectiveHeadless = !resolvedHeadless && !displayEnv ? 'new' : (resolvedHeadless ? 'new' : false);
      if (!resolvedHeadless && !displayEnv) {
        logger.warn('HEADLESS=false requested but DISPLAY is not set. Browser UI cannot be shown in this environment. Running headless instead.');
      }

      this.browser = await puppeteer.launch({
        headless: effectiveHeadless,
        slowMo: config.puppeteer.slowMo,
        defaultViewport: null,
        args: launchArgs,
      });

      this.page = await this.browser.newPage();
      
      await this.page.setViewport({
        width: config.puppeteer.viewport.width,
        height: config.puppeteer.viewport.height,
        deviceScaleFactor: 1,
        isMobile: false
      });

      await this.page.setUserAgent(RandomHelpers.getRandomUserAgent());
      
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
      if (text === null || text === undefined) {
        logger.warn(`safeType called with null/undefined text for selector: ${selector}`);
        return false;
      }

      if (typeof text !== 'string') {
        try {
          text = String(text);
        } catch (_) {
          logger.warn(`safeType could not convert non-string text for selector: ${selector}`);
          return false;
        }
      }

      const inputText = text;

      const element = await this.waitForSelector(selector);
      if (element) {
        await element.type(inputText, {
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

  async extractLinks(selector = null, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    try {
      const waitSelectors = [];
      if (typeof selector === 'string' && selector.trim().length > 0) {
        waitSelectors.push(selector.trim());
      }

      const defaultSelectors = [
        'a[href*="/in/"]',
        'a[href^="/in/"]',
        '.reusable-search__result-container a[href]'
      ];

      const timeoutMs = Math.max(3000, Number(options.timeoutMs) || 10000);
      const selectorsToTry = waitSelectors.length > 0 ? waitSelectors : defaultSelectors;

      let anyFound = false;
      for (const sel of selectorsToTry) {
        try {
          await this.page.waitForSelector(sel, { timeout: timeoutMs });
          anyFound = true;
          break;
        } catch (_) {
        }
      }

      if (!anyFound) {
        await new Promise(res => setTimeout(res, 1000));
      }

      if (options.autoScroll) {
        const maxIterations = Math.max(1, Math.min(50, Number(options.maxScrolls) || 1000));
        const stableLimit = Math.max(1, Math.min(5, Number(options.stableLimit) || 2));
        let stableCount = 0;
        let lastHeight = await this.page.evaluate(() => document.body.scrollHeight || 0);
        let lastLinkCount = await this.page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).length);

        for (let i = 0; i < maxIterations; i++) {
          try {
            const didClickShowMore = await this.page.evaluate(() => {
              function isVisible(el) {
                if (!el) return false;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return style && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
              }

              const candidates = [
                'button[aria-label*="Show more"]',
                '.scaffold-finite-scroll__load-button button',
                'button.artdeco-button',
              ];

              for (const sel of candidates) {
                const btn = document.querySelector(sel);
                if (btn && isVisible(btn)) {
                  const text = (btn.textContent || '').toLowerCase();
                  const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                  if (text.includes('show more') || aria.includes('show more')) {
                    btn.click();
                    return true;
                  }
                }
              }
              return false;
            });

            if (!didClickShowMore) {
              await this.page.evaluate(() => {
                window.scrollBy(0, Math.floor(window.innerHeight * 0.95));
              });
            }

            await RandomHelpers.randomDelay(700, 1400);

            const [newHeight, newLinkCount] = await this.page.evaluate(() => [
              document.body.scrollHeight || 0,
              Array.from(document.querySelectorAll('a[href]')).length,
            ]);

            const heightChanged = newHeight > lastHeight;
            const linksGrew = newLinkCount > lastLinkCount;
            if (!heightChanged && !linksGrew) {
              stableCount += 1;
            } else {
              stableCount = 0;
            }
            lastHeight = Math.max(lastHeight, newHeight);
            lastLinkCount = Math.max(lastLinkCount, newLinkCount);

            if (stableCount >= stableLimit) {
              break;
            }
          } catch (_) {
            break;
          }
        }
      }

      const profileIds = await this.page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const ids = new Set();

        for (const a of anchors) {
          const rawHref = a.getAttribute('href') || '';
          if (!rawHref) continue;

          let href = rawHref;
          try {
            if (href.startsWith('/')) {
              href = new URL(href, window.location.origin).toString();
            } else if (!/^https?:\/\
              continue;
            }
          } catch (_) {
            continue;
          }

          if (!/linkedin\.com/i.test(href)) continue;

          try {
            href = decodeURIComponent(href);
          } catch (_) {
          }

          const match = href.match(/\/in\/([^\/?#]+)/i);
          if (match && match[1]) {
            ids.add(match[1]);
          }
        }

        return Array.from(ids);
      });

      return profileIds;
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