/**
 * Text Extraction Service
 *
 * Extracts structured text from LinkedIn profile pages using Puppeteer
 */

import { logger } from '#utils/logger.js';
import { createEmptyProfile, validateProfileData } from '#schemas/profileTextSchema.js';
import RandomHelpers from '#utils/randomHelpers.js';

export class TextExtractionService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.config = {
      // Timeouts
      elementWait: 10000,
      sectionLoad: 5000,
      scrollDelay: 1000,

      // Limits
      maxExperiences: 20,
      maxEducation: 10,
      maxSkills: 50,
      maxAboutLength: 5000,

      // Behavior
      expandContent: true,
      scrollBeforeExtract: true
    };

    logger.debug('TextExtractionService initialized');
  }

  /**
   * Extract complete profile text from a LinkedIn profile URL
   * @param {string} profileUrl - LinkedIn profile URL
   * @returns {Promise<Object>} - Extracted profile data matching schema
   */
  async extractProfileText(profileUrl) {
    const startTime = Date.now();
    logger.info(`Starting text extraction for: ${profileUrl}`);

    try {
      // Extract profile ID from URL
      const profileId = this._extractProfileIdFromUrl(profileUrl);

      // Create empty profile structure
      const profileData = createEmptyProfile(profileId, profileUrl);

      // Navigate to profile if not already there
      const currentUrl = await this.puppeteer.getPage().url();
      if (!currentUrl.includes(profileId)) {
        await this.puppeteer.goto(profileUrl);
        await RandomHelpers.randomDelay(1500, 2500);
      }

      // Wait for profile page to load
      await this._waitForProfileLoad();

      // Expand "see more" content if enabled
      if (this.config.expandContent) {
        await this._expandAllContent();
      }

      // Scroll to ensure all content is loaded
      if (this.config.scrollBeforeExtract) {
        await this._scrollPage();
      }

      // Extract all sections in parallel for better performance
      const [basicInfoResult, aboutResult, experienceResult, educationResult, skillsResult] = await Promise.allSettled([
        this._extractBasicInfo(),
        this._extractAbout(),
        this._extractExperience(),
        this._extractEducation(),
        this._extractSkills()
      ]);

      // Process basic info
      if (basicInfoResult.status === 'fulfilled') {
        const basicInfo = basicInfoResult.value;
        profileData.name = basicInfo.name || '';
        profileData.headline = basicInfo.headline;
        profileData.location = basicInfo.location;
      } else {
        logger.warn(`Failed to extract basic info: ${basicInfoResult.reason?.message}`);
      }

      // Process about
      if (aboutResult.status === 'fulfilled') {
        profileData.about = aboutResult.value;
      } else {
        logger.warn(`Failed to extract about section: ${aboutResult.reason?.message}`);
      }

      // Process experience
      if (experienceResult.status === 'fulfilled') {
        const experiences = experienceResult.value;
        profileData.experience = experiences.slice(0, this.config.maxExperiences);
        profileData.current_position = experiences.length > 0 ? experiences[0] : null;
      } else {
        logger.warn(`Failed to extract experience: ${experienceResult.reason?.message}`);
      }

      // Process education
      if (educationResult.status === 'fulfilled') {
        profileData.education = educationResult.value;
      } else {
        logger.warn(`Failed to extract education: ${educationResult.reason?.message}`);
      }

      // Process skills
      if (skillsResult.status === 'fulfilled') {
        profileData.skills = skillsResult.value;
      } else {
        logger.warn(`Failed to extract skills: ${skillsResult.reason?.message}`);
      }

      // Generate fulltext
      profileData.fulltext = this._generateFulltext(profileData);

      // Set extraction timestamp
      profileData.extracted_at = new Date().toISOString();

      // Validate extracted data
      const validation = validateProfileData(profileData);
      if (!validation.isValid) {
        logger.warn(`Validation errors: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        logger.debug(`Validation warnings: ${validation.warnings.join(', ')}`);
      }

      const duration = Date.now() - startTime;
      logger.info(`Text extraction completed in ${duration}ms for ${profileId}`);
      logger.debug(`Extracted: ${profileData.experience.length} experiences, ${profileData.education.length} education entries, ${profileData.skills.length} skills`);

      return profileData;

    } catch (error) {
      logger.error(`Text extraction failed for ${profileUrl}:`, error);
      throw error;
    }
  }

  /**
   * Wait for profile page to load key elements
   * @private
   */
  async _waitForProfileLoad() {
    const page = this.puppeteer.getPage();
    try {
      await page.waitForSelector('main', { timeout: this.config.elementWait });
      await RandomHelpers.randomDelay(500, 1000);
    } catch (error) {
      logger.debug(`Profile load wait timed out: ${error.message}`);
    }
  }

  /**
   * Expand "see more" buttons to reveal full content
   * @private
   */
  async _expandAllContent() {
    const page = this.puppeteer.getPage();
    logger.debug('Expanding "see more" content...');

    const seeMoreSelectors = [
      '::-p-aria(…see more)',
      '::-p-text(…see more)',
      '::-p-text(see more)',
      'button[aria-label*="see more"]',
      'button.inline-show-more-text__button'
    ];

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      let foundButtons = false;
      attempts++;

      for (const selector of seeMoreSelectors) {
        try {
          const buttons = await page.$$(selector);
          for (const button of buttons) {
            try {
              await button.click({ delay: 300 });
              foundButtons = true;
              await RandomHelpers.randomDelay(500, 1000);
            } catch {
              // Button may not be clickable, skip
            }
          }
        } catch {
          // Selector didn't match, continue
        }
      }

      if (!foundButtons) break;
    }

    logger.debug(`Content expansion completed after ${attempts} attempts`);
  }

  /**
   * Scroll page to load all content
   * @private
   */
  async _scrollPage() {
    const page = this.puppeteer.getPage();
    try {
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await RandomHelpers.randomDelay(500, 1000);
    } catch (error) {
      logger.debug(`Scroll failed: ${error.message}`);
    }
  }

  /**
   * Extract basic profile information (name, headline, location)
   * @private
   * @returns {Promise<Object>} - { name, headline, location }
   */
  async _extractBasicInfo() {
    const page = this.puppeteer.getPage();

    return await page.evaluate(() => {
      const result = { name: null, headline: null, location: null };

      // Extract name
      const nameSelectors = [
        'h1.text-heading-xlarge',
        'h1.inline',
        '.pv-top-card--list li:first-child',
        'h1'
      ];

      for (const selector of nameSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          result.name = element.textContent.trim();
          break;
        }
      }

      // Extract headline
      const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-top-card--list-bullet li:first-child',
        'div.text-body-medium',
        '.ph5 .mt2 .mt1'
      ];

      for (const selector of headlineSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim() && !element.textContent.includes('·')) {
          result.headline = element.textContent.trim();
          break;
        }
      }

      // Extract location
      const locationSelectors = [
        '.text-body-small.inline.t-black--light.break-words',
        '.pv-top-card--list-bullet li:last-child',
        'span.text-body-small'
      ];

      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim() && !element.textContent.includes('connections')) {
          result.location = element.textContent.trim();
          break;
        }
      }

      return result;
    });
  }

  /**
   * Extract about/summary section
   * @private
   * @returns {Promise<string|null>} - About text or null
   */
  async _extractAbout() {
    const page = this.puppeteer.getPage();

    const about = await page.evaluate((maxLength) => {
      const aboutSelectors = [
        '#about ~ * .inline-show-more-text',
        '#about + * .display-flex .visually-hidden + span',
        'section[data-section="summary"] .pv-about__summary-text',
        '.pv-about-section .pv-about__summary-text'
      ];

      for (const selector of aboutSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text) {
            return text.length > maxLength ? text.substring(0, maxLength) : text;
          }
        }
      }

      return null;
    }, this.config.maxAboutLength);

    return about;
  }

  /**
   * Extract experience history
   * @private
   * @returns {Promise<Array>} - Array of experience objects
   */
  async _extractExperience() {
    const page = this.puppeteer.getPage();

    const experiences = await page.evaluate((maxExperiences) => {
      const result = [];

      // Find experience section
      const experienceSection = document.querySelector('#experience');
      if (!experienceSection) return result;

      // Find all experience items
      const experienceItems = experienceSection.parentElement.querySelectorAll('ul > li.artdeco-list__item');

      for (let i = 0; i < Math.min(experienceItems.length, maxExperiences); i++) {
        const item = experienceItems[i];
        const exp = {
          company: null,
          title: null,
          employment_type: null,
          start_date: null,
          end_date: null,
          description: null
        };

        // Extract title
        const titleElement = item.querySelector('.t-bold span[aria-hidden="true"]') ||
                            item.querySelector('div[data-field="title"]');
        if (titleElement) {
          exp.title = titleElement.textContent.trim();
        }

        // Extract company
        const companyElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"]') ||
                              item.querySelector('span.t-14.t-normal') ||
                              item.querySelector('div[data-field="subtitle"]');
        if (companyElement) {
          exp.company = companyElement.textContent.trim().replace(/·.*/, '').trim();
        }

        // Extract dates
        const dateElement = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]') ||
                           item.querySelector('span.t-black--light.t-14');
        if (dateElement) {
          const dateText = dateElement.textContent.trim();
          const parts = dateText.split('-').map(p => p.trim());
          if (parts.length >= 1) {
            exp.start_date = parts[0];
          }
          if (parts.length >= 2) {
            exp.end_date = parts[1];
          }
        }

        // Extract description
        const descElement = item.querySelector('.inline-show-more-text') ||
                           item.querySelector('.pv-entity__description');
        if (descElement) {
          exp.description = descElement.textContent.trim();
        }

        // Only add if we have at least company or title
        if (exp.company || exp.title) {
          result.push(exp);
        }
      }

      return result;
    }, this.config.maxExperiences);

    return experiences;
  }

  /**
   * Extract education history
   * @private
   * @returns {Promise<Array>} - Array of education objects
   */
  async _extractEducation() {
    const page = this.puppeteer.getPage();

    const education = await page.evaluate((maxEducation) => {
      const result = [];

      // Find education section
      const educationSection = document.querySelector('#education');
      if (!educationSection) return result;

      // Find all education items
      const educationItems = educationSection.parentElement.querySelectorAll('ul > li.artdeco-list__item');

      for (let i = 0; i < Math.min(educationItems.length, maxEducation); i++) {
        const item = educationItems[i];
        const edu = {
          school: null,
          degree: null,
          field_of_study: null,
          start_date: null,
          end_date: null,
          description: null
        };

        // Extract school name
        const schoolElement = item.querySelector('.t-bold span[aria-hidden="true"]') ||
                             item.querySelector('div[data-field="school_name"]');
        if (schoolElement) {
          edu.school = schoolElement.textContent.trim();
        }

        // Extract degree and field
        const degreeElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"]') ||
                             item.querySelector('div[data-field="degree_name"]');
        if (degreeElement) {
          const degreeText = degreeElement.textContent.trim();
          const parts = degreeText.split(',').map(p => p.trim());
          if (parts.length >= 1) {
            edu.degree = parts[0];
          }
          if (parts.length >= 2) {
            edu.field_of_study = parts[1];
          }
        }

        // Extract dates
        const dateElement = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
        if (dateElement) {
          const dateText = dateElement.textContent.trim();
          const parts = dateText.split('-').map(p => p.trim());
          if (parts.length >= 1) {
            edu.start_date = parts[0];
          }
          if (parts.length >= 2) {
            edu.end_date = parts[1];
          }
        }

        // Only add if we have at least school
        if (edu.school) {
          result.push(edu);
        }
      }

      return result;
    }, this.config.maxEducation);

    return education;
  }

  /**
   * Extract skills
   * @private
   * @returns {Promise<Array>} - Array of skill strings
   */
  async _extractSkills() {
    const page = this.puppeteer.getPage();

    const skills = await page.evaluate((maxSkills) => {
      const result = [];

      // Find skills section
      const skillsSection = document.querySelector('#skills');
      if (!skillsSection) return result;

      // Find all skill items
      const skillElements = skillsSection.parentElement.querySelectorAll('ul li div[data-field="skill_card_skill_topic"] span[aria-hidden="true"]');

      for (let i = 0; i < Math.min(skillElements.length, maxSkills); i++) {
        const skill = skillElements[i].textContent.trim();
        if (skill && !result.includes(skill)) {
          result.push(skill);
        }
      }

      // Fallback: try alternate selector
      if (result.length === 0) {
        const altSkillElements = skillsSection.parentElement.querySelectorAll('li .hoverable-link-text span[aria-hidden="true"]');
        for (let i = 0; i < Math.min(altSkillElements.length, maxSkills); i++) {
          const skill = altSkillElements[i].textContent.trim();
          if (skill && !result.includes(skill)) {
            result.push(skill);
          }
        }
      }

      return result;
    }, this.config.maxSkills);

    return skills;
  }

  /**
   * Generate fulltext from all profile fields
   * @private
   * @param {Object} profileData - Profile data object
   * @returns {string} - Concatenated fulltext
   */
  _generateFulltext(profileData) {
    const parts = [];

    // Add basic info
    if (profileData.name) parts.push(profileData.name);
    if (profileData.headline) parts.push(profileData.headline);
    if (profileData.location) parts.push(profileData.location);

    // Add about
    if (profileData.about) parts.push(profileData.about);

    // Add current position
    if (profileData.current_position) {
      const cp = profileData.current_position;
      if (cp.company) parts.push(cp.company);
      if (cp.title) parts.push(cp.title);
      if (cp.description) parts.push(cp.description);
    }

    // Add experience
    if (profileData.experience && profileData.experience.length > 0) {
      profileData.experience.forEach(exp => {
        if (exp.company) parts.push(exp.company);
        if (exp.title) parts.push(exp.title);
        if (exp.description) parts.push(exp.description);
      });
    }

    // Add education
    if (profileData.education && profileData.education.length > 0) {
      profileData.education.forEach(edu => {
        if (edu.school) parts.push(edu.school);
        if (edu.degree) parts.push(edu.degree);
        if (edu.field_of_study) parts.push(edu.field_of_study);
      });
    }

    // Add skills
    if (profileData.skills && profileData.skills.length > 0) {
      parts.push(`Skills: ${profileData.skills.join(', ')}`);
    }

    return parts.filter(Boolean).join(' ').trim();
  }

  /**
   * Extract profile ID from LinkedIn URL
   * @private
   * @param {string} url - LinkedIn profile URL
   * @returns {string} - Profile ID
   */
  _extractProfileIdFromUrl(url) {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error(`Invalid LinkedIn profile URL: ${url}`);
  }
}

export default TextExtractionService;
