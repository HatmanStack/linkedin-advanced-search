import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import sharp from 'sharp';
import RandomHelpers from '../utils/randomHelpers.js';
import { DynamoDBService } from './dynamoDBService.js';
import fs from 'fs/promises';
import path from 'path';
import { DynamoDBService } from './DynamoDBService.js';

export class LinkedInService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.genAI = config.googleAI.apiKey ? 
      new GoogleGenerativeAI(config.googleAI.apiKey) : null;
    this.model = this.genAI ? 
      this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) : null;
    this.DynamoDBService = new DynamoDBService();
  }

  
  async login(username, password, recursion) {
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

      if(recursion){
        logger.info('Recursion triggered Consider disabling 2FA')
      }
      // Wait for navigation and potential 2FA or captcha
      logger.info('Waiting for potential 2FA or captcha...');
      
      //await new Promise(resolve => setTimeout(resolve, config.timeouts.navigation));
      logger.info('Continuing after waiting for 2FA or captcha...');
      
      logger.info('Login process completed');
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async navigateToIds(companyName) {
    try{
       logger.info(`Searching for company: ${companyName}`);
      
      // Use the search box
      const searchSelectors = [
        'input[placeholder="Search"]',
        'input[role="combobox"]',
        'input.search-global-typeahead__input',
        '#global-nav input'
      ];

      let searchBoxFound = false;
      for (const selector of searchSelectors) {
        try {
          await this.puppeteer.getPage().waitForSelector(selector, { timeout: 5000 });
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

      // Press Enter
      await this.puppeteer.getPage().keyboard.press('ArrowDown');
      await this.puppeteer.getPage().keyboard.press('Enter');
      await RandomHelpers.randomDelay(3000, 5000);

      // Click on company result
      const companyLinkSelector = `a[aria-label*="${companyName}"], div.search-nec__hero-kcard-v2-content a`;
      const clickSuccess = await this.puppeteer.safeClick(companyLinkSelector);
      
      if (!clickSuccess) {
        logger.warn(`Could not find company link for: ${companyName}`);
        return null;
      }

      logger.info(`Successfully navigated to company: ${companyName}`);
      
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
    }catch (error) {
      logger.error(`Failed to search company ${companyName}:`, error);
      throw error;
    } 
  }

  async searchCompany(companyName) {
    try{
      await this.navigateToIds(companyName);
      await RandomHelpers.randomDelay(2000, 4000);

      // Extract company number from URL
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
      if(!companyName){
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
        
        // Extract geo number from URL
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
      // Build URL conditionally based on available parameters
      let urlParts = ['https://www.linkedin.com/search/results/people/?'];
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
      logger.error(`Failed to get links from page ${pageNumber}:`, error);
      return [];
    }
  }

  async analyzeContactActivity(profileId, userId) {
    try {
     
      
      // Check if profile analysis is needed
      const analysisStatus = await this.DynamoDBService.checkProfileRecentlyProcessed(profileId, userId);
      
      if (!analysisStatus.shouldAnalyze) {
        logger.info(`Skipping analysis for ${profileId}: ${analysisStatus.reason}`);
        return { 
          skipped: true, 
          reason: analysisStatus.reason,
          lastAnalyzed: analysisStatus.lastAnalyzed,
          profileId 
        };
      }
      
      logger.info(`Proceeding with analysis for ${profileId}: ${analysisStatus.reason}`);
      
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
      
      if (isGoodContact) {
        // Create temp directory and take activity screenshot
        await this.puppeteer.getPage().setViewport({
          width: 1200,
          height: 1200,
          deviceScaleFactor: 1,
        });
        const screenshotsRoot = path.resolve(process.cwd(), 'screenshots');
        
        const tempDir = await fs.mkdtemp(path.join(screenshotsRoot, 'linkedin-screenshots'));
        
        const screenshotPath = path.join(tempDir, `${profileId}-Reactions-holder.png`);
        
        await this.puppeteer.getPage().screenshot({
          path: screenshotPath,
          fullPage: true
        });
        
        logger.debug(`Activity screenshot saved: ${screenshotPath}`);
        
        const croppedPath = path.join(tempDir, `${profileId}-Reactions.png`);
        const image = sharp(screenshotPath);
        const metadata = await image.metadata();
        await image
          .extract({ left: 300, top: 0, width: 575, height: metadata.height })
          .toFile(croppedPath);
        logger.info('Cropped screenshot from left 300, width 550.');

        // Delete the original screenshot after cropping
        await fs.unlink(screenshotPath);

        return { isGoodContact: true,  tempDir};
       
      }
      await this.DynamoDBService.checkProfileRecentlyProcessed(profileId, userId);
      
      return { isGoodContact: false};
    } catch (error) {
      logger.error(`Failed to analyze contact activity for ${profileId}:`, error);
      throw error;
    }
  }

  async createDynamoDBEntryForContact(profileId) {
    try {
      const activityUrl = `https://www.linkedin.com/in/${profileId}/`;
      logger.debug(`Analyzing contact activity: ${activityUrl}`);
    } catch(error){
      logger.error(`Faled to add contact to DynamoDB for ${profileID}: `, error)
    }
  }
}

export default LinkedInService;