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
      const jobsTabSelector = 'nav[aria-label*="Organization"] a[href*="jobs"], #ember563';
      const jobsSuccess = await this.puppeteer.safeClick(jobsTabSelector);
      
      if (!jobsSuccess) {
        throw new Error('Failed to click Jobs tab');
      }
      logger.info('Clicked Jobs tab successfully.');

      await RandomHelpers.randomDelay(2000, 4000);
      logger.info('Waited after clicking Jobs tab.');

      // Click "Show all jobs"
      logger.info('Attempting to click "Show all jobs"...');
      const showAllSelector = 'span:contains("Show all jobs"), div.org-jobs-recently-posted-jobs-module span';
      await this.puppeteer.safeClick(showAllSelector);
      logger.info('"Show all jobs" clicked (if present).');
      
      await RandomHelpers.randomDelay(2000, 4000);
      logger.info('Waited after clicking "Show all jobs".');

      // Set location filter
      if (companyLocation) {
        logger.info(`Attempting to set location filter: ${companyLocation}`);
        const locationSuccess = await this.puppeteer.safeType(
          '#jobs-search-box-location-id-ember1277, input[placeholder*="location"]', 
          companyLocation
        );
        
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
      
      const geoMatch = currentUrl.match(/&geoId=(\d+)&/);
      const companyMatch = currentUrl.match(/&f_C=(\d+)/);
      
      const extractedGeoNumber = geoMatch ? geoMatch[1] : null;
      const extractedCompanyNumber = companyMatch ? companyMatch[1] : null;
      
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
      
      await this.puppeteer.goto(activityUrl);
      
      let score = 0;
      const totalCounts = { hour: 0, day: 0, week: 0 };
      const { recencyHours, recencyDays, recencyWeeks, historyToCheck } = config.linkedin;
      
      for (let i = 0; i < historyToCheck; i++) {
        await this.puppeteer.waitForSelector('ul li a', { timeout: 5000 });

        const newCounts = await this.puppeteer.getPage().evaluate((existingCounts) => {
          const timeframes = {
            hour: /([1-23]h)\b/i,
            day: /\b([1-6]d)\b/i,
            week: /\b([1-4]w)\b/i
          };
          const elements = document.querySelectorAll('span[aria-hidden="true"]');

          const updatedCounts = { ...existingCounts };
          Object.entries(timeframes).forEach(([key, regex]) => {
            const newCount = [...elements].filter(el => 
              regex.test(el.textContent?.toLowerCase() ?? '')
            ).length;
            updatedCounts[key] += newCount;
          });
          
          return updatedCounts;
        }, totalCounts);

        Object.assign(totalCounts, newCounts);

        score = (totalCounts.day * recencyDays) +
                (totalCounts.hour * recencyHours) +
                (totalCounts.week * recencyWeeks);
        
        logger.debug(`Contact ${profileId} - Iteration ${i + 1}, Score: ${score}`);
        
        if (score >= config.linkedin.threshold) {
          break;
        }
         
        await this.puppeteer.scrollPage();
      }

      const isGoodContact = score >= config.linkedin.threshold;
      logger.debug(`Contact ${profileId} final score: ${score}, Good contact: ${isGoodContact}`);
      
      return isGoodContact;
    } catch (error) {
      logger.error(`Failed to analyze contact activity for ${profileId}:`, error);
      return false;
    }
  }

  async generateInitialMessage(profileId) {
    if (!this.model) {
      logger.warn('Google AI not configured, skipping message generation');
      return null;
    }

    try {
      const profileUrl = `https://www.linkedin.com/in/${profileId}`;
      await this.puppeteer.goto(profileUrl);
      
      const screenshotPath = `${config.paths.screenshots}/${profileId}.png`;
      await FileHelpers.ensureDirectoryExists(config.paths.screenshots);
      await this.puppeteer.screenshot(screenshotPath);

      const prompt = `Create an introduction message for a newly connected LinkedIn connection, with a personalized message to the user. Here are some examples but feel free to deviate from them:
      
      Hey {{to.first_name}}, happy to connect. I have a lot of respect for the work being done at __company__ and look forward to seeing updates from you in my feed.
      
      Hey {{to.first_name}}, glad we're connected now. I've been impressed by the innovation happening at __company__- excited to stay updated.
      
      Hey {{to.first_name}}, good to connect. Excited to follow along with what you're up to. All the best.`;

      const imageParts = [FileHelpers.fileToGenerativePart(screenshotPath, "image/png")];
      const result = await this.model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      
      logger.debug(`Generated message for ${profileId}`);
      return {
        profileId,
        message: response.text(),
      };
    } catch (error) {
      logger.error(`Failed to generate message for ${profileId}:`, error);
      return null;
    }
  }

  async getRecentMessages() {
    try {
      logger.info('Getting recent messages...');
      
      await this.puppeteer.goto('https://www.linkedin.com/feed/');
      
      // Navigate to messaging
      const messagingSuccess = await this.puppeteer.safeClick('#global-nav li:nth-of-type(4) svg');
      if (!messagingSuccess) {
        throw new Error('Failed to access messaging');
      }

      let messageLinks = [];
      
      // Extract links from recent conversations
      const conversationSelectors = [
        '#ember1738 p', '#ember1745 p', '#ember1752 p', 
        '#ember1759 p', '#ember1766 p', '#ember1773 p', '#ember1780 p'
      ];

      for (const selector of conversationSelectors) {
        const clickSuccess = await this.puppeteer.safeClick(selector);
        if (clickSuccess) {
          const links = await this.puppeteer.extractLinks();
          messageLinks.push(...links);
          await RandomHelpers.randomDelay(1000, 2000);
        }
      }

      logger.info(`Found ${messageLinks.length} links from recent messages`);
      return [...new Set(messageLinks)]; // Remove duplicates
    } catch (error) {
      logger.error('Failed to get recent messages:', error);
      return [];
    }
  }
}

export default LinkedInService;