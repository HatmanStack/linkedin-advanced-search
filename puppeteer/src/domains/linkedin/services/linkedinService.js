import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../shared/config/index.js';
import { logger } from '../../shared/utils/logger.js';
import RandomHelpers from '../../shared/utils/randomHelpers.js';
import DynamoDBService from '../../storage/services/dynamoDBService.js';
import LinkedInContactService from './linkedinContactService.js';
import { decryptSealboxB64Tag } from '../utils/crypto.js';


export class LinkedInService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.sessionTag = 'default';
    this.genAI = config.googleAI.apiKey ?
      new GoogleGenerativeAI(config.googleAI.apiKey) : null;
    this.model = this.genAI ?
      this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) : null;
    this.dynamoDBService = new DynamoDBService();
    this.linkedInContactService = new LinkedInContactService(puppeteerService);
  }


  async login(username, password, recursion, credentialsCiphertext = null, sessionTag = 'default') {
    try {
      logger.info('Starting LinkedIn login process...');
      this.sessionTag = sessionTag || 'default';

      if ((!username || !password) && typeof credentialsCiphertext === 'string' && credentialsCiphertext.startsWith('sealbox_x25519:b64:')) {
        try {
          const decrypted = await decryptSealboxB64Tag(credentialsCiphertext);
          if (decrypted) {
            const obj = JSON.parse(decrypted);
            username = obj?.email || username;
            password = obj?.password || password;
          }
        } catch (e) {
          logger.error('Failed to decrypt LinkedIn credentials for login');
          throw new Error('Credential decryption failed');
        }
      }

      if (typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('LinkedIn username is missing or invalid');
      }
      if (typeof password !== 'string' || password.trim().length === 0) {
        throw new Error('LinkedIn password is missing or invalid');
      }

      await this.puppeteer.goto('https://www.linkedin.com/login');

      const usernameSuccess = await this.puppeteer.safeType('#username', username);
      if (!usernameSuccess) {
        throw new Error('Failed to enter username');
      }

      const passwordSuccess = await this.puppeteer.safeType('#password', password);
      if (!passwordSuccess) {
        throw new Error('Failed to enter password');
      }

      const loginSuccess = await this.puppeteer.safeClick('form button[type="submit"]');
      if (!loginSuccess) {
        throw new Error('Failed to click login button');
      }

      if (recursion) {
        logger.info('Recursion triggered Consider disabling 2FA')
      }
      const page = this.puppeteer.getPage();
      const shortCapMs = Math.min(8000, (config.timeouts?.navigation || 15000));
      const start = Date.now();
      try {
        await Promise.race([
          page.waitForFunction(() => document.readyState === 'complete', { timeout: shortCapMs }),
          page.waitForSelector('#global-nav', { timeout: shortCapMs / 2 })
        ]);
      } catch (_) {
      }
      const spent = Date.now() - start;
      logger.debug(`Post-login readiness probe took ${spent}ms`);

      const homepageSelector = [
        '#global-nav',
        'aside.scaffold-layout__sidebar .profile-card',
        '.feed-identity-module',
        'div.scaffold-layout__sidebar .profile-card'
      ].join(', ');
      const loginWaitMs = (config.timeouts?.login ?? 0);
      try {
        await page.waitForSelector(homepageSelector, { visible: true, timeout: loginWaitMs });
        logger.info('Homepage element detected after login; security challenge (if any) likely resolved.');
      } catch (e) {
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

  async navigateToIds(companyName) {
    try {
      logger.info(`Searching for company: ${companyName}`);

      const searchSelectors = [
        'input[placeholder="Search"]',
        'input[role="combobox"]',
        'input.search-global-typeahead__input',
        '#global-nav input'
      ];

      let searchBoxFound = false;
      for (const selector of searchSelectors) {
        try {
          await this.puppeteer.getPage().waitForSelector(selector, { timeout: 10000 });
          const searchSuccess = await this.puppeteer.safeType(selector, companyName);
          if (searchSuccess) {
            searchBoxFound = true;
            break;
          }
        } catch (e) {
          logger.debug(`Search box not found with selector: ${selector}`);
        }
      }
      if (!searchBoxFound) {
        throw new Error('Failed to find or enter search term in the search box');
      }

      await this.puppeteer.getPage().keyboard.press('ArrowDown');
      await this.puppeteer.getPage().keyboard.press('Enter');


      const companyLinkSelector = `a[aria-label*="${companyName}"], div.search-nec__hero-kcard-v2-content a`;
      const clickSuccess = await this.puppeteer.safeClick(companyLinkSelector);

      if (!clickSuccess) {
        logger.warn(`Could not find company link for: ${companyName}`);
        return null;
      }

      logger.info(`Successfully navigated to company: ${companyName}`);

      logger.info('Attempting to click Jobs tab...');
      const jobsTabSelectors = [
        '::-p-aria(Organization’s page navigation) >>>> ::-p-aria(Jobs)',
        '::-p-xpath(//*[@id=\\"ember5530\\"])',
        ':scope >>> #ember5530',
        '#ember5530'
      ];

      let jobsTabClicked = false;
      for (const selector of jobsTabSelectors) {
        logger.info(`Trying selector for Jobs tab: ${selector}`);
        try {
          await this.puppeteer.getPage().waitForSelector(selector, { timeout: 10000 });
          const success = await this.puppeteer.safeClick(selector);
          if (success) {
            logger.info(`Clicked Jobs tab with selector: ${selector}`);
            jobsTabClicked = true;
            break;
          }
        } catch (e) {
          logger.info(`Selector failed: ${selector}`);
        }
      }
      if (!jobsTabClicked) {
        throw new Error('Failed to click Jobs tab');
      }
      logger.info('Clicked Jobs tab successfully.');


      logger.info('Waited after clicking Jobs tab.');

      logger.info('Attempting to click "Show all jobs"...');
      const showAllSelectors = [
        'div.org-jobs-recently-posted-jobs-module > div span:nth-of-type(1)',
        '::-p-xpath(//*[@id=\\"ember5849\\"]/span[1])',
        ':scope >>> div.org-jobs-recently-posted-jobs-module > div span:nth-of-type(1)',
        '::-p-text(Show all jobs)'
      ];

      let showAllClicked = false;
      let page = this.puppeteer.getPage();
      let currentUrl = page.url();
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      logger.debug(`Current URL before clicking "Show all jobs": ${currentUrl}`);
      for (const selector of showAllSelectors) {
        logger.info(`Trying selector for "Show all jobs": ${selector}`);
        try {
          await this.puppeteer.getPage().waitForSelector(selector, { timeout: 5000 });
          const success = await this.puppeteer.safeClick(selector);
          if (success) {
            logger.info(`Clicked "Show all jobs" with selector: ${selector}`);
            showAllClicked = true;
            break;
          }
        } catch (e) {
          logger.info(`Selector failed: ${selector}`);
        }
      }

      if (!showAllClicked) {
        try {
          const page = this.puppeteer.getPage();
          const elements = await page.$x("//a[contains(text(), 'Show all') or contains(text(), 'View all')]");
          if (elements.length > 0) {
            await elements[0].click();
            showAllClicked = true;
            logger.info('Clicked "Show all jobs" using XPath');
          }
        } catch (e) {
          logger.info('XPath fallback failed');
        }
      }
      if (!showAllClicked) {
        logger.info('"Show all jobs" button not found or could not be clicked.');
      } else {
        logger.info('"Show all jobs" clicked (if present).');
      }
    } catch (error) {
      logger.error(`Failed to search company ${companyName}:`, error);
      throw error;
    }
  }

  async searchCompany(companyName) {
    try {
      await this.navigateToIds(companyName);
      await RandomHelpers.randomDelay(2000, 4000);

      const page = this.puppeteer.getPage();
      const currentUrl = page.url();
      const companyMatch = currentUrl.match(/[?&]f_C=(\d+)/);
      const extractedCompanyNumber = companyMatch ? companyMatch[1] : null;

      logger.debug(`Extracted company number: ${extractedCompanyNumber}`);
      return extractedCompanyNumber;

    } catch (error) {
      logger.error(`Failed to extract Company ID ${companyName}:`, error);
      throw error;
    }
  }

  async applyLocationFilter(companyLocation, companyName) {
    try {
      if (!companyName) {
        await this.navigateToIds("Google");
      }
      logger.info(`Attempting to set location filter: ${companyLocation}`);
      const locationSelectors = [
        'input[aria-label*="location"]',
        'input[placeholder*="location"]',
        'input[id*="location"]',
        '#jobs-search-box-location-id'
      ];

      let locationSuccess = false;
      for (const selector of locationSelectors) {
        try {
          const page = this.puppeteer.getPage();
          const element = await page.$(selector);
          if (element) {
            await element.click({ clickCount: 3 });
            await element.press('Backspace');
            await RandomHelpers.randomDelay(500, 1000);

            locationSuccess = await this.puppeteer.safeType(selector, companyLocation);
            if (locationSuccess) {
              logger.info(`Location entered with selector: ${selector}`);
              break;
            }
          }
        } catch (e) {
          logger.debug(`Failed to clear/type location with selector ${selector}: ${e.message}`);
        }
      }

      if (locationSuccess) {
        logger.info('Location entered successfully, pressing Enter...');
        await this.puppeteer.getPage().keyboard.press('Enter');
        await RandomHelpers.randomDelay(3000, 5000);
        logger.info('Waited after setting location filter.');

        const page = this.puppeteer.getPage();
        const currentUrl = page.url();
        const geoMatch = currentUrl.match(/[?&]geoId=(\d+)/);
        const extractedGeoNumber = geoMatch ? geoMatch[1] : null;

        logger.debug(`Extracted geo number: ${extractedGeoNumber}`);

        return extractedGeoNumber;
      } else {
        logger.info('Failed to enter location filter.');
        return null;
      }
    } catch (error) {
      logger.error('Failed to apply location filter:', error);
      throw error;
    }
  }


  async getLinksFromPeoplePage(pageNumber, extractedCompanyNumber = null, encodedRole = null, extractedGeoNumber = null) {
    try {
      let urlParts = ['https://www.linkedin.com/search/results/people/?'];
      let queryParams = [];
      queryParams.push(`currentCompany=%5B162479%5D`);

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

      const hasContent = await this.puppeteer.waitForSelector('ul li', { timeout: 5000 });
      if (!hasContent) {
        logger.warn(`No content found on page ${pageNumber}`);
        return [];
      }

      const links = await this.puppeteer.extractLinks();
      logger.debug(`Found ${links.length} links on page ${pageNumber}`);

      return links;
    } catch (error) {
      logger.error(`Failed to get links from page ${pageNumber}:`, error);
      return [];
    }
  }

  async analyzeContactActivity(profileId, jwtToken) {
    try {
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

      const activityUrl = `https://www.linkedin.com/in/${profileId}/recent-activity/reactions/`;
      logger.debug(`Analyzing contact activity: ${activityUrl}`);

      await this.puppeteer.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = this.puppeteer.getPage().url();

      const pageContent = await this.puppeteer.getPage().content();
      if (currentUrl.includes('checkpoint') || /captcha|verify/i.test(pageContent)) {

        logger.warn('Landed on a checkpoint or captcha page!');
      }

      let score = 0;
      const totalCounts = { hour: 0, day: 0, week: 0 };
      const { recencyHours, recencyDays, recencyWeeks, historyToCheck } = config.linkedin;
      logger.debug(`Recency settings - Hours: ${recencyHours}, Days: ${recencyDays}, Weeks: ${recencyWeeks}`);
      let countedSet = new Set();

      for (let i = 0; i < historyToCheck; i++) {
        await this.puppeteer.waitForSelector('span[aria-hidden="true"]', { timeout: 5000 });

        const result = await this.puppeteer.getPage().evaluate(
          (existingCounts, countedArr) => {
            const timeframes = {
              hour: /([1-23]h)\b/i,
              day: /\b([1-6]d)\b/i,
              week: /\b([1-4]w)\b/i
            };
            const elements = Array.from(document.querySelectorAll('span[aria-hidden="true"]'));
            const updatedCounts = { ...existingCounts };
            const newCounted = [];

            elements.forEach((el, idx) => {
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

  
  async scrollToLoadConnections(connectionType, maxScrolls = 5) {
    const page = this.puppeteer.getPage();
    let previousConnectionCount = 0;
    let stableCount = 0;
    const stableLimit = 5;

    logger.info(`Starting intelligent scroll for ${connectionType} connections (max ${maxScrolls} scrolls)`);

    for (let i = 0; i < maxScrolls; i++) {
      try {
        const currentConnectionCount = await page.evaluate(() => {
          const selectors = [
            'a[href*="/in/"]',
            '.mn-connection-card',
            '.invitation-card',
            '.artdeco-entity-lockup',
            '[data-test-id="connection-card"]'
          ];

          let totalCount = 0;
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            totalCount = Math.max(totalCount, elements.length);
          });

          return totalCount;
        });

        if (currentConnectionCount > previousConnectionCount) {
          logger.debug(`Scroll ${i + 1}: Found ${currentConnectionCount} connections (+${currentConnectionCount - previousConnectionCount})`);
          previousConnectionCount = currentConnectionCount;
          stableCount = 0;
        } else {
          stableCount++;
          logger.debug(`Scroll ${i + 1}: No new connections found (${currentConnectionCount} total, stable count: ${stableCount})`);
        }

        if (stableCount >= stableLimit) {
          logger.info(`Stopping scroll - no new connections found for ${stableLimit} attempts`);
          break;
        }

        await page.mouse.wheel({ deltaY: 1000 });
        await RandomHelpers.randomDelay(800, 1500);

      } catch (error) {
        logger.warn(`Error during scroll ${i + 1}:`, error.message);
        break;
      }
    }

    logger.info(`Scroll completed. Final connection count: ${previousConnectionCount}`);
    return previousConnectionCount;
  }

  
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

      let targetUrl;
      switch (connectionType) {
        case 'ally':
          targetUrl = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';
          break;
        case 'incoming':
          targetUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/';
          break;
        case 'outgoing':
          targetUrl = 'https://www.linkedin.com/mynetwork/invitation-manager/sent/';
          break;
        default:
          throw new Error(`Unknown connection type: ${connectionType}`);
      }

      await this.puppeteer.goto(targetUrl);
      await this.puppeteer.waitForSelector('body', { timeout: 10000 });

      await this.scrollToLoadConnections(connectionType, maxScrolls);

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