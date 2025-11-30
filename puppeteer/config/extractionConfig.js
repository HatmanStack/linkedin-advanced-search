/**
 * Text Extraction Configuration
 *
 * Centralized configuration for LinkedIn profile text extraction
 */

/**
 * Timeout configuration for extraction operations
 */
export const extractionTimeouts = {
  elementWait: parseInt(process.env.EXTRACTION_ELEMENT_WAIT) || 10000,        // Wait for element to appear
  sectionLoad: parseInt(process.env.EXTRACTION_SECTION_LOAD) || 5000,         // Wait for section to load
  pageNavigation: parseInt(process.env.EXTRACTION_PAGE_NAVIGATION) || 30000,  // Wait for page navigation
  scrollDelay: parseInt(process.env.EXTRACTION_SCROLL_DELAY) || 1000,         // Delay between scrolls
};

/**
 * LinkedIn profile selectors
 * Note: These selectors may break if LinkedIn updates their HTML structure
 */
export const selectors = {
  profile: {
    // Basic info selectors (with fallbacks)
    name: [
      'h1.text-heading-xlarge',
      'h1.inline',
      '.pv-top-card--list li:first-child',
      'h1'
    ],
    headline: [
      '.text-body-medium.break-words',
      '.pv-top-card--list-bullet li:first-child',
      'div.text-body-medium'
    ],
    location: [
      '.text-body-small.inline.t-black--light.break-words',
      '.pv-top-card--list-bullet li:last-child',
      'span.text-body-small'
    ],
    about: [
      '#about ~ * .inline-show-more-text',
      '#about + * .display-flex .visually-hidden + span',
      'section[data-section="summary"] .pv-about__summary-text',
      '.pv-about-section .pv-about__summary-text'
    ]
  },
  experience: {
    section: '#experience',
    items: 'ul > li.artdeco-list__item',
    title: '.t-bold span[aria-hidden="true"]',
    company: '.t-14.t-normal span[aria-hidden="true"]',
    dates: '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
    description: '.inline-show-more-text',
    // Fallback selectors
    fallbackTitle: 'div[data-field="title"]',
    fallbackCompany: 'span.t-14.t-normal',
    fallbackDates: 'span.t-black--light.t-14',
    fallbackDescription: '.pv-entity__description'
  },
  education: {
    section: '#education',
    items: 'ul > li.artdeco-list__item',
    school: '.t-bold span[aria-hidden="true"]',
    degree: '.t-14.t-normal span[aria-hidden="true"]',
    dates: '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
    // Fallback selectors
    fallbackSchool: 'div[data-field="school_name"]',
    fallbackDegree: 'div[data-field="degree_name"]'
  },
  skills: {
    section: '#skills',
    items: 'ul li div[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
    // Fallback selectors
    fallbackItems: 'li .hoverable-link-text span[aria-hidden="true"]'
  },
  contentExpansion: {
    seeMoreButtons: [
      '::-p-aria(…see more)',
      '::-p-text(…see more)',
      '::-p-text(see more)',
      'button[aria-label*="see more"]',
      'button.inline-show-more-text__button'
    ]
  }
};

/**
 * Limits for extracted data
 */
export const extractionLimits = {
  maxExperiences: parseInt(process.env.EXTRACTION_MAX_EXPERIENCES) || 20,     // Limit experience entries
  maxEducation: parseInt(process.env.EXTRACTION_MAX_EDUCATION) || 10,        // Limit education entries
  maxSkills: parseInt(process.env.EXTRACTION_MAX_SKILLS) || 50,              // Limit skills
  maxAboutLength: parseInt(process.env.EXTRACTION_MAX_ABOUT_LENGTH) || 5000, // Max length of about section
  maxFulltextLength: parseInt(process.env.EXTRACTION_MAX_FULLTEXT_LENGTH) || 50000, // Max fulltext length
};

/**
 * Output format options
 */
export const outputFormat = {
  includeFulltext: process.env.EXTRACTION_INCLUDE_FULLTEXT !== 'false',      // Default true
  fulltextSeparator: process.env.EXTRACTION_FULLTEXT_SEPARATOR || '\n',      // Separator for fulltext
  dateFormat: process.env.EXTRACTION_DATE_FORMAT || 'YYYY-MM',               // Date format
  includeMetadata: process.env.EXTRACTION_INCLUDE_METADATA !== 'false',      // Include extracted_at timestamp
  prettifyJson: process.env.EXTRACTION_PRETTIFY_JSON !== 'false',            // Pretty print JSON
  jsonIndent: parseInt(process.env.EXTRACTION_JSON_INDENT) || 2,             // JSON indentation
};

/**
 * Feature flags for extraction sections
 */
export const extractionFeatures = {
  extractBasicInfo: process.env.EXTRACTION_EXTRACT_BASIC_INFO !== 'false',   // Default true
  extractExperience: process.env.EXTRACTION_EXTRACT_EXPERIENCE !== 'false',  // Default true
  extractEducation: process.env.EXTRACTION_EXTRACT_EDUCATION !== 'false',    // Default true
  extractSkills: process.env.EXTRACTION_EXTRACT_SKILLS !== 'false',          // Default true
  extractAbout: process.env.EXTRACTION_EXTRACT_ABOUT !== 'false',            // Default true
  extractActivity: process.env.EXTRACTION_EXTRACT_ACTIVITY === 'true',       // Future feature, default false
};

/**
 * Behavior settings
 */
export const extractionBehavior = {
  expandContent: process.env.EXTRACTION_EXPAND_CONTENT !== 'false',          // Expand "see more" buttons
  scrollBeforeExtract: process.env.EXTRACTION_SCROLL_BEFORE_EXTRACT !== 'false', // Scroll page before extraction
  maxContentExpansionAttempts: parseInt(process.env.EXTRACTION_MAX_EXPANSION_ATTEMPTS) || 5, // Max attempts to expand content
  retryOnFailure: process.env.EXTRACTION_RETRY_ON_FAILURE !== 'false',       // Retry extraction on failure
  maxRetryAttempts: parseInt(process.env.EXTRACTION_MAX_RETRY_ATTEMPTS) || 2, // Max retry attempts
  continueOnPartialFailure: process.env.EXTRACTION_CONTINUE_ON_PARTIAL_FAILURE !== 'false', // Continue if some fields fail
  logDetailedErrors: process.env.EXTRACTION_LOG_DETAILED_ERRORS === 'true',  // Log detailed errors
};

/**
 * Complete extraction configuration object
 */
export default {
  timeouts: extractionTimeouts,
  selectors,
  limits: extractionLimits,
  format: outputFormat,
  features: extractionFeatures,
  behavior: extractionBehavior
};
