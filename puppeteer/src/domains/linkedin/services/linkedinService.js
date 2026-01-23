import config from '#shared-config/index.js';
import { logger } from '#utils/logger.js';
import RandomHelpers from '#utils/randomHelpers.js';
import DynamoDBService from '../../storage/services/dynamoDBService.js';
import LinkedInContactService from './linkedinContactService.js';
import { decryptSealboxB64Tag } from '#utils/crypto.js';


export class LinkedInService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.sessionTag = 'default';
    this.dynamoDBService = new DynamoDBService();
    this.linkedInContactService = new LinkedInContactService(puppeteerService);
  }


  async login(username, password, recursion, credentialsCiphertext = null, sessionTag = 'default') {
    try {
      logger.info('Starting LinkedIn login process...');
      this.sessionTag = sessionTag || 'default';

      // Just-in-time decryption if plaintext not provided
      if ((!username || !password) && typeof credentialsCiphertext === 'string' && credentialsCiphertext.startsWith('sealbox_x25519:b64:')) {
        try {
          const decrypted = await decryptSealboxB64Tag(credentialsCiphertext);
          if (decrypted) {
            const obj = JSON.parse(decrypted);
            username = obj?.email || username;
            password = obj?.password || password;
          }
        } catch (err) {
          logger.error('Failed to decrypt LinkedIn credentials for login', { error: err.message, stack: err.stack });
          throw new Error(`Credential decryption failed: ${err.message}`);
        }
      }

      // Validate credentials before interacting with the page
      if (typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('LinkedIn username is missing or invalid');
      }
      if (typeof password !== 'string' || password.trim().length === 0) {
        throw new Error('LinkedIn password is missing or invalid');
      }

      await this.puppeteer.goto(`${config.linkedin.baseUrl}/login`);

      // Fill username
      const usernameSuccess = await this.puppeteer.safeType('#username', username);
      if (!usernameSuccess) {
        throw new Error('Failed to enter username');
      }

      // Fill password
      const passwordSuccess = await this.puppeteer.safeType('#password', password);
      if (!passwordSuccess) {
        throw new Error('Failed to enter password');
      }

      // Click login button
      const loginSuccess = await this.puppeteer.safeClick('form button[type="submit"]');
      if (!loginSuccess) {
        throw new Error('Failed to click login button');
      }

      if (recursion) {
        logger.info('Recursion triggered Consider disabling 2FA')
      }
      // Post-login: do a short readiness probe instead of long navigation waits
      const page = this.puppeteer.getPage();
      const shortCapMs = Math.min(8000, (config.timeouts?.navigation || 15000));
      const start = Date.now();
      try {
        await Promise.race([
          page.waitForFunction(() => document.readyState === 'complete', { timeout: shortCapMs }),
          page.waitForSelector('header, [data-view-name="navigation-homepage"]', { timeout: shortCapMs / 2 })
        ]);
      } catch {
        // Intentionally swallowed: LinkedIn is an SPA that may not trigger traditional
        // navigation events. The subsequent waitForSelector() with configurable timeout
        // handles the actual login verification. This race is just an optimization.
      }
      const spent = Date.now() - start;
      logger.debug(`Post-login readiness probe took ${spent}ms`);

      // After login, wait for a common homepage selector to allow time for security challenges (2FA, checkpoint, captcha)
      // We intentionally use a long/infinite timeout controlled by config.timeouts.login (0 means no timeout)
      // Prioritize data-view-name (stable) over class names (obfuscated)
      const homepageSelector = [
        '[data-view-name="navigation-homepage"]',
        '[data-view-name="identity-module"]',
        '[data-view-name="identity-self-profile"]',
        'header'
      ].join(', ');
      // Timeout of 0 means "wait indefinitely" - this is intentional to allow users
      // to manually complete 2FA/CAPTCHA challenges. The operator monitors the browser
      // window and completes security challenges before the automation continues.
      const loginWaitMs = (config.timeouts?.login ?? 0);
      try {
        await page.waitForSelector(homepageSelector, { visible: true, timeout: loginWaitMs });
        logger.info('Homepage element detected after login; security challenge (if any) likely resolved.');
      } catch (e) {
        // If a finite timeout was configured and elapsed, surface the error
        logger.error('Homepage selector did not appear within the configured login timeout.', e);
        throw e;
      }

      logger.info('Login process completed');
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async searchCompany(companyName) {
    try {
      logger.info(`Extracting company ID via people search filter: ${companyName}`);

      // Navigate to people search page
      const page = this.puppeteer.getPage();
      await this.puppeteer.goto(`${config.linkedin.baseUrl}/search/results/people/`);
      await RandomHelpers.randomDelay(1500, 2500);

      // Click "Current companies" filter label
      const companyFilterClicked = await this._clickFilterButton('Current companies');
      if (!companyFilterClicked) {
        throw new Error('Failed to open "Current companies" filter');
      }
      await RandomHelpers.randomDelay(500, 1000);

      // Type company name in the filter search input
      const filterInputTyped = await this._typeInFilterInput(companyName);
      if (!filterInputTyped) {
        throw new Error('Failed to type company name in filter input');
      }
      await RandomHelpers.randomDelay(1500, 2500);

      // Select the first matching suggestion
      const suggestionClicked = await this._selectFilterSuggestion(companyName);
      if (!suggestionClicked) {
        logger.warn(`No matching company suggestion found for: ${companyName}`);
        return null;
      }
      await RandomHelpers.randomDelay(500, 1000);

      // Click "Show results" to apply the filter
      await this._clickShowResults();
      await RandomHelpers.randomDelay(2000, 3000);

      // Extract company number from updated URL (quotes may be literal or encoded as %22)
      const currentUrl = decodeURIComponent(page.url());
      const companyMatch = currentUrl.match(/currentCompany=\["?(\d+)"?\]/);
      const extractedCompanyNumber = companyMatch ? companyMatch[1] : null;

      if (extractedCompanyNumber) {
        logger.info(`Extracted company number: ${extractedCompanyNumber}`);
      } else {
        logger.warn(`Could not extract company ID from URL: ${currentUrl}`);
      }

      return extractedCompanyNumber;

    } catch (error) {
      logger.error(`Failed to extract Company ID for ${companyName}:`, error);
      throw error;
    }
  }

  async applyLocationFilter(companyLocation) {
    try {
      logger.info(`Applying location filter via people search: ${companyLocation}`);

      const page = this.puppeteer.getPage();

      // Ensure we're on the people search page (may not be if searchCompany was skipped during healing)
      if (!page.url().includes('/search/results/people')) {
        await this.puppeteer.goto(`${config.linkedin.baseUrl}/search/results/people/`);
        await RandomHelpers.randomDelay(1500, 2500);
      }

      // Click "Locations" filter button
      const locationFilterClicked = await this._clickFilterButton('Locations');
      if (!locationFilterClicked) {
        throw new Error('Failed to open "Locations" filter');
      }
      await RandomHelpers.randomDelay(500, 1000);

      // Type location in the filter search input
      const filterInputTyped = await this._typeInFilterInput(companyLocation);
      if (!filterInputTyped) {
        throw new Error('Failed to type location in filter input');
      }
      await RandomHelpers.randomDelay(1500, 2500);

      // Select the first matching suggestion
      const suggestionClicked = await this._selectFilterSuggestion(companyLocation);
      if (!suggestionClicked) {
        logger.warn(`No matching location suggestion found for: ${companyLocation}`);
        return null;
      }
      await RandomHelpers.randomDelay(500, 1000);

      // Click "Show results" to apply the filter
      await this._clickShowResults();
      await RandomHelpers.randomDelay(2000, 3000);

      // Extract geo number from updated URL (quotes may be literal or encoded as %22)
      const currentUrl = decodeURIComponent(page.url());
      const geoMatch = currentUrl.match(/geoUrn=\["?(\d+)"?\]/);
      const extractedGeoNumber = geoMatch ? geoMatch[1] : null;

      if (extractedGeoNumber) {
        logger.info(`Extracted geo number: ${extractedGeoNumber}`);
      } else {
        logger.warn(`Could not extract geo ID from URL: ${currentUrl}`);
      }

      return extractedGeoNumber;

    } catch (error) {
      logger.error('Failed to apply location filter:', error);
      throw error;
    }
  }

  async _clickFilterButton(filterName) {
    const page = this.puppeteer.getPage();

    // LinkedIn renders filters as <label> elements tied to checkboxes.
    // Try aria selectors first, then fall back to text content matching.
    const selectors = [
      `::-p-aria(${filterName})`,
      `button[aria-label="${filterName} filter"]`,
      `button[aria-label*="${filterName}"]`,
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const success = await this.puppeteer.safeClick(selector);
        if (success) {
          logger.debug(`Clicked filter "${filterName}" with: ${selector}`);
          return true;
        }
      } catch {
        logger.debug(`Filter selector failed: ${selector}`);
      }
    }

    // Fallback: find by text content in both buttons and labels
    try {
      const clicked = await page.evaluate((name) => {
        const elements = Array.from(document.querySelectorAll('button, label'));
        const match = elements.find(el => {
          const text = el.textContent.trim().toLowerCase();
          return text.includes(name.toLowerCase());
        });
        if (match) { match.click(); return true; }
        return false;
      }, filterName);
      if (clicked) {
        logger.debug(`Clicked filter "${filterName}" via text content fallback`);
        return true;
      }
    } catch {
      // ignore
    }

    logger.warn(`Could not find filter: ${filterName}`);
    return false;
  }

  async _typeInFilterInput(text) {
    const page = this.puppeteer.getPage();
    const inputSelectors = [
      'input[aria-label*="Add a company"]',
      'input[aria-label*="Add a location"]',
      'input[placeholder*="Add a"]',
      'input[role="combobox"]',
      '[role="listbox"] input',
      'fieldset input[type="text"]',
    ];

    for (const selector of inputSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await element.type(text, { delay: 50 });
          logger.debug(`Typed "${text}" in filter input: ${selector}`);
          return true;
        }
      } catch {
        logger.debug(`Filter input selector failed: ${selector}`);
      }
    }

    logger.warn('Could not find filter input field');
    return false;
  }

  async _selectFilterSuggestion(searchText) {
    const page = this.puppeteer.getPage();

    // Wait for suggestions to appear
    const suggestionSelectors = [
      '[role="listbox"] [role="option"]',
      '[role="listbox"] li',
      '.basic-typeahead__triggered-content li',
      'div[data-basic-filter-parameter-values] label',
      'fieldset label',
    ];

    for (const selector of suggestionSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const clicked = await page.evaluate((sel, text) => {
          const items = Array.from(document.querySelectorAll(sel));
          // Prefer exact match, then partial match
          const exactMatch = items.find(item =>
            item.textContent.trim().toLowerCase() === text.toLowerCase()
          );
          const partialMatch = items.find(item =>
            item.textContent.trim().toLowerCase().includes(text.toLowerCase())
          );
          const target = exactMatch || partialMatch || items[0];
          if (target) {
            // Click the input/checkbox if it's a label, otherwise click the element
            const input = target.querySelector('input');
            if (input) { input.click(); }
            else { target.click(); }
            return true;
          }
          return false;
        }, selector, searchText);

        if (clicked) {
          logger.debug(`Selected suggestion for "${searchText}" with: ${selector}`);
          return true;
        }
      } catch {
        logger.debug(`Suggestion selector failed: ${selector}`);
      }
    }

    logger.warn(`No suggestions found for: ${searchText}`);
    return false;
  }

  async _clickShowResults() {
    const page = this.puppeteer.getPage();
    const selectors = [
      '::-p-aria(Show results)',
      '::-p-aria(Apply current filter)',
      'button[aria-label*="Apply"]',
      'button[aria-label*="Show results"]',
      'button[data-control-name="filter_show_results"]',
    ];

    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        const success = await this.puppeteer.safeClick(selector);
        if (success) {
          logger.debug(`Clicked "Show results" with: ${selector}`);
          return true;
        }
      } catch {
        // try next
      }
    }

    // Fallback: find by button text
    try {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => {
          const text = b.textContent.trim().toLowerCase();
          return text.includes('show results') || text.includes('apply');
        });
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) {
        logger.debug('Clicked "Show results" via text content fallback');
        return true;
      }
    } catch {
      // ignore
    }

    // If no explicit apply button, the filter may auto-apply on selection
    logger.debug('No "Show results" button found - filter may have auto-applied');
    return false;
  }


  async getLinksFromPeoplePage(pageNumber, extractedCompanyNumber = null, encodedRole = null, extractedGeoNumber = null) {
    try {
      // Build URL conditionally based on available parameters
      let urlParts = [`${config.linkedin.baseUrl}/search/results/people/?`];
      let queryParams = [];

      if (extractedCompanyNumber) {
        queryParams.push(`currentCompany=%5B"${extractedCompanyNumber}"%5D`);
      }

      if (extractedGeoNumber) {
        queryParams.push(`geoUrn=%5B"${extractedGeoNumber}"%5D`);
      }

      if (encodedRole) {
        queryParams.push(`keywords=${encodedRole}`);
      }

      queryParams.push('origin=FACETED_SEARCH');
      queryParams.push(`page=${pageNumber}`);

      const url = urlParts[0] + queryParams.join('&');

      logger.debug(`Fetching links from page ${pageNumber}: ${url}`);

      await this.puppeteer.goto(url);

      // Wait for content to load
      const hasContent = await this.puppeteer.waitForSelector('ul li', { timeout: 5000 });
      if (!hasContent) {
        logger.warn(`No content found on page ${pageNumber}`);
        return [];
      }

      const links = await this.puppeteer.extractLinks();
      logger.debug(`Found ${links.length} links on page ${pageNumber}`);

      return links;
    } catch (error) {
      // Return empty array instead of throwing to allow pagination to continue.
      // A single failed page shouldn't abort the entire search - we log the error
      // and continue to the next page. The caller handles empty pages appropriately.
      logger.error(`Failed to get links from page ${pageNumber}:`, error);
      return [];
    }
  }

  async analyzeContactActivity(profileId, jwtToken) {
    try {
      // Check if profile analysis is needed
      logger.info('Start Analysis')
      this.dynamoDBService.setAuthToken(jwtToken);
      const shouldProcess = await this.dynamoDBService.getProfileDetails(profileId);
      logger.info(`${shouldProcess}`);
      if (!shouldProcess) {
        logger.info(`Skipping analysis for ${profileId}: Profile was updated recently`);
        return {
          skipped: true,
          reason: 'Profile was updated recently',
          profileId
        };
      }

      logger.info(`Proceeding with analysis for ${profileId}`);

      const activityUrl = `${config.linkedin.baseUrl}/in/${profileId}/recent-activity/reactions/`;
      logger.debug(`Analyzing contact activity: ${activityUrl}`);

      await this.puppeteer.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = this.puppeteer.getPage().url();

      // Detection of security challenges - logged as warning for operator awareness.
      // The automation pauses here; human intervention may be required.
      // This is expected behavior when LinkedIn detects automation patterns.
      const pageContent = await this.puppeteer.getPage().content();
      if (currentUrl.includes('checkpoint') || /captcha|verify/i.test(pageContent)) {
        logger.warn('Landed on a checkpoint or captcha page - may require manual intervention');
      }

      let score = 0;
      const totalCounts = { hour: 0, day: 0, week: 0 };
      const { recencyHours, recencyDays, recencyWeeks, historyToCheck } = config.linkedin;
      logger.debug(`Recency settings - Hours: ${recencyHours}, Days: ${recencyDays}, Weeks: ${recencyWeeks}`);
      let countedSet = new Set();

      for (let i = 0; i < historyToCheck; i++) {
        // LinkedIn renders timestamps in both <span aria-hidden> and <p> elements
        const timeSelector = 'span[aria-hidden="true"], p[componentkey]';
        await this.puppeteer.waitForSelector(timeSelector, { timeout: 5000 });

        const result = await this.puppeteer.getPage().evaluate(
          (existingCounts, countedArr) => {
            const timeframes = {
              hour: /\b([1-9]|1[0-9]|2[0-3])h\b/i,
              day: /\b([1-6])d\b/i,
              week: /\b([1-4])w\b/i
            };
            const elements = Array.from(document.querySelectorAll('span[aria-hidden="true"], p[componentkey]'));
            const updatedCounts = { ...existingCounts };
            const newCounted = [];

            elements.forEach((el, idx) => {
              // Use a unique key: text + index + outerHTML
              const key = `${el.textContent?.toLowerCase() ?? ''}|${idx}|${el.outerHTML}`;
              if (!countedArr.includes(key)) {
                Object.entries(timeframes).forEach(([k, regex]) => {
                  if (regex.test(el.textContent?.toLowerCase() ?? '')) {
                    updatedCounts[k]++;
                  }
                });
                newCounted.push(key);
              }
            });

            return { updatedCounts, newCounted };
          },
          totalCounts,
          Array.from(countedSet)
        );

        Object.assign(totalCounts, result.updatedCounts);
        result.newCounted.forEach(key => countedSet.add(key));

        score = (totalCounts.day * recencyDays) +
          (totalCounts.hour * recencyHours) +
          (totalCounts.week * recencyWeeks);

        logger.debug(`Contact ${profileId} - Iteration ${i + 1}, Score: ${score}`);

        if (score >= config.linkedin.threshold) {
          break;
        }

        await this.puppeteer.getPage().evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
      }

      const isGoodContact = score >= config.linkedin.threshold;
      logger.debug(`Contact ${profileId} final score: ${score}, Good contact: ${isGoodContact}`);

      if (isGoodContact) {
        await this.dynamoDBService.upsertEdgeStatus(profileId, 'possible');
        return { isGoodContact: true };

      }
      await this.dynamoDBService.upsertEdgeStatus(profileId, 'processed');
      await this.dynamoDBService.markBadContact(profileId);

      return { isGoodContact: false };
    } catch (error) {
      logger.error(`Failed to analyze contact activity for ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Scroll to load connections with intelligent detection of when to stop
   * @param {string} connectionType - Type of connections being loaded
   * @param {number} maxScrolls - Maximum number of scroll attempts
   * @returns {Promise<number>} Number of connections found after scrolling
   */
  async scrollToLoadConnections(connectionType, maxScrolls = 5) {
    const page = this.puppeteer.getPage();
    let previousConnectionCount = 0;
    let stableCount = 0;
    const stableLimit = 5; // Stop after 5 consecutive stable iterations

    logger.info(`Starting intelligent scroll for ${connectionType} connections (max ${maxScrolls} scrolls)`);

    for (let i = 0; i < maxScrolls; i++) {
      try {
        // Check current connection count
        const currentConnectionCount = await page.evaluate(() => {
          // Different selectors for different connection types
          // Prioritize data-view-name and href patterns over class names
          const selectors = [
            'a[href*="/in/"]', // General LinkedIn profile links
            '[data-view-name="connections-profile"]', // Connection cards (new)
            '[data-view-name="people-search-result"]', // Search result cards (new)
            '[data-test-id="connection-card"]' // Test ID based cards (legacy)
          ];

          let totalCount = 0;
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            totalCount = Math.max(totalCount, elements.length);
          });

          return totalCount;
        });

        // Check if we found new connections
        if (currentConnectionCount > previousConnectionCount) {
          logger.debug(`Scroll ${i + 1}: Found ${currentConnectionCount} connections (+${currentConnectionCount - previousConnectionCount})`);
          previousConnectionCount = currentConnectionCount;
          stableCount = 0;
        } else {
          stableCount++;
          logger.debug(`Scroll ${i + 1}: No new connections found (${currentConnectionCount} total, stable count: ${stableCount})`);
        }

        // Stop if we've been stable for too long
        if (stableCount >= stableLimit) {
          logger.info(`Stopping scroll - no new connections found for ${stableLimit} attempts`);
          break;
        }

        // Skip "Show more" button clicking since it doesn't work - use mouse wheel scroll
        // Use mouse wheel scroll which actually works to load more connections
        await page.mouse.wheel({ deltaY: 1000 });
        await RandomHelpers.randomDelay(800, 1500); // Wait for content to load

      } catch (error) {
        logger.warn(`Error during scroll ${i + 1}:`, error.message);
        break;
      }
    }

    logger.info(`Scroll completed. Final connection count: ${previousConnectionCount}`);
    return previousConnectionCount;
  }

  /**
   * Generic method to get connections from LinkedIn
   * @param {Object} options - Configuration options
   * @param {string} options.connectionType - 'ally', 'incoming', 'outgoing' (optional, default: 'ally')
   * @param {number} options.maxScrolls - Maximum number of scrolls (optional, default: 50)
   * @returns {Promise<Array>} Array of connection profile IDs
   */
  async getConnections(options = {}) {
    const {
      connectionType = 'ally',
      maxScrolls = 5
    } = options;

    try {
      logger.info(`Getting ${connectionType} connections`, {
        connectionType,
        maxScrolls
      });

      // Navigate to connections page based on type
      let targetUrl;
      switch (connectionType) {
        case 'ally':
          targetUrl = `${config.linkedin.baseUrl}/mynetwork/invite-connect/connections/`;
          break;
        case 'incoming':
          targetUrl = `${config.linkedin.baseUrl}/mynetwork/invitation-manager/received/`;
          break;
        case 'outgoing':
          targetUrl = `${config.linkedin.baseUrl}/mynetwork/invitation-manager/sent/`;
          break;
        default:
          throw new Error(`Unknown connection type: ${connectionType}`);
      }

      await this.puppeteer.goto(targetUrl);
      await this.puppeteer.waitForSelector('body', { timeout: 10000 });

      // Scroll to load all connections dynamically
      await this.scrollToLoadConnections(connectionType, maxScrolls);

      // Extract profile links after scrolling is complete
      const profileIds = await this.puppeteer.extractLinks();

      logger.info(`Extracted ${profileIds.length} ${connectionType} connections`);

      if (profileIds.length > 0) {
        const sampleIds = profileIds.slice(0, 3).map(id => id.substring(0, 5) + '...');
        logger.debug(`Sample profile IDs: ${sampleIds.join(', ')}`);
      }

      return profileIds;

    } catch (error) {
      logger.error(`Failed to get ${connectionType} connections:`, error);
      throw error;
    }
  }

}

export default LinkedInService;