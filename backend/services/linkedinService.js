import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import RandomHelpers from '../utils/randomHelpers.js';

export class LinkedInService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.genAI = config.googleAI.apiKey ? 
      new GoogleGenerativeAI(config.googleAI.apiKey) : null;
    this.model = this.genAI ? 
      this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) : null;
  }

  async login(username, password) {
    try {
      logger.info('Starting LinkedIn login process...');
      
      await this.puppeteer.goto('https://www.linkedin.com/login');
      
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

      // Wait for navigation and potential 2FA or captcha
      logger.info('Waiting for potential 2FA or captcha...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      logger.info('Continuing after waiting for 2FA or captcha...');
      
      logger.info('Login process completed');
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async searchCompany(companyName) {
    try {
      logger.info(`Searching for company: ${companyName}`);
      
      // Use the search box
      const searchSuccess = await this.puppeteer.safeType('#global-nav input', companyName);
      if (!searchSuccess) {
        throw new Error('Failed to enter search term');
      }

      // Press Enter
      await this.puppeteer.getPage().keyboard.press('Enter');
      await RandomHelpers.randomDelay(3000, 5000);

      // Click on company result
      const companyLinkSelector = `a[aria-label*="${companyName}"], div.search-nec__hero-kcard-v2-content a`;
      const clickSuccess = await this.puppeteer.safeClick(companyLinkSelector);
      
      if (!clickSuccess) {
        logger.warn(`Could not find company link for: ${companyName}`);
        return false;
      }

      logger.info(`Successfully navigated to company: ${companyName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to search company ${companyName}:`, error);
      throw error;
    }
  }

async navigateToJobs(companyLocation) {
    try {
      logger.info('Navigating to company jobs section...');
      
      // Click on Jobs tab
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
          await this.puppeteer.getPage().waitForSelector(selector, { timeout: 5000 });
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

      await RandomHelpers.randomDelay(2000, 4000);
      logger.info('Waited after clicking Jobs tab.');

      // Click "Show all jobs"
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

      // Try using XPath as fallback for text content
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
      page = this.puppeteer.getPage();
      currentUrl = page.url();
      logger.debug(`Current URL after clicking "Show all jobs": ${currentUrl}`);
      await RandomHelpers.randomDelay(2000, 4000);
      logger.info('Waited after clicking "Show all jobs".');
      // Set location filter
      if (companyLocation) {
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
              // Clear the field first
              await element.click({ clickCount: 3 }); // Select all text
              await element.press('Backspace');
              await RandomHelpers.randomDelay(500, 1000);
              
              // Now type the location
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
        } else {
          logger.info('Failed to enter location filter.');
        }
      } else {
        logger.info('No companyLocation provided, skipping location filter.');
      }

      logger.info('Successfully navigated to jobs section');
      return true;
    } catch (error) {
      logger.error('Failed to navigate to jobs section:', error);
      throw error;
    }
  }

  async extractCompanyAndGeoNumbers() {
    try {
      const page = this.puppeteer.getPage();
      const currentUrl = page.url();
      
      const geoMatch = currentUrl.match(/[?&]geoId=(\d+)/);
      
      const companyMatch = currentUrl.match(/[?&]f_C=(\d+)/);
      
      const extractedGeoNumber = geoMatch ? geoMatch[1] : null;
      const extractedCompanyNumber = companyMatch ? companyMatch[1] : null;
      logger.debug(`Current URL: ${currentUrl}`);
      logger.debug(`Extracted company number: ${extractedCompanyNumber}`);
      logger.debug(`Extracted geo number: ${extractedGeoNumber}`);
      
      return { extractedCompanyNumber, extractedGeoNumber };
    } catch (error) {
      logger.error('Failed to extract company/geo numbers:', error);
      return { extractedCompanyNumber: null, extractedGeoNumber: null };
    }
  }

  async getLinksFromPeoplePage(pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber) {
    try {
      const url = `https://www.linkedin.com/search/results/people/?currentCompany=%5B"${extractedCompanyNumber}"%5D&geoUrn=%5B"${extractedGeoNumber}"%5D&keywords=${encodedRole}&origin=FACETED_SEARCH&page=${pageNumber}`;
      
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
      logger.error(`Failed to get links from page ${pageNumber}:`, error);
      return [];
    }
  }

  async analyzeContactActivity(profileId) {
    try {
      const activityUrl = `https://www.linkedin.com/in/${profileId}/recent-activity/reactions/`;
      logger.debug(`Analyzing contact activity: ${activityUrl}`);
      
      await this.puppeteer.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const currentUrl = this.puppeteer.getPage().url();
      
      const pageContent = await this.puppeteer.getPage().content();
      if (currentUrl.includes('checkpoint') || /captcha|verify/i.test(pageContent)) {
        logger.warn('Landed on a checkpoint or captcha page!');
        // Handle accordingly
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
      
      return isGoodContact;
    } catch (error) {
      logger.error(`Failed to analyze contact activity for ${profileId}:`, error);
      return false;
    }
  }

}

export default LinkedInService;