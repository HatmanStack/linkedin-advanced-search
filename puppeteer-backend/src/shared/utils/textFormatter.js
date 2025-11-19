/**
 * Text Formatting and Sanitization Utilities
 *
 * Provides functions to clean, format, and sanitize extracted profile text
 */

import { logger } from './logger.js';

/**
 * Remove extra whitespace from text
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
export function cleanWhitespace(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitize text for JSON storage
 * Removes control characters that may break JSON
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeForJson(text) {
  if (!text || typeof text !== 'string') return '';

  // Remove control characters except newlines and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Normalize line endings to \n
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
export function normalizeLineEndings(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parse LinkedIn date format to consistent format
 * @param {string} linkedInDate - Date string from LinkedIn (e.g., "Jan 2020 - Present", "2020 - 2023")
 * @returns {Object|null} - { start, end } or null if unparseable
 */
export function formatDate(linkedInDate) {
  if (!linkedInDate || typeof linkedInDate !== 'string') return null;

  const dateText = linkedInDate.trim();

  // Handle date ranges
  if (dateText.includes('-')) {
    const parts = dateText.split('-').map(p => p.trim());
    const result = { start: null, end: null };

    if (parts.length >= 1) {
      result.start = parseLinkedInDate(parts[0]);
    }
    if (parts.length >= 2) {
      result.end = parts[1].toLowerCase() === 'present' ? 'Present' : parseLinkedInDate(parts[1]);
    }

    return result;
  }

  // Single date
  const parsed = parseLinkedInDate(dateText);
  return parsed ? { start: parsed, end: null } : null;
}

/**
 * Parse single LinkedIn date to YYYY-MM format
 * @private
 * @param {string} dateStr - Date string (e.g., "Jan 2020", "2020")
 * @returns {string|null} - Formatted date or null
 */
function parseLinkedInDate(dateStr) {
  if (!dateStr) return null;

  const months = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12'
  };

  // Check if it's just a year (4 digits)
  const yearMatch = dateStr.match(/^\d{4}$/);
  if (yearMatch) {
    return yearMatch[0];
  }

  // Try to match month and year (e.g., "Jan 2020")
  const monthYearMatch = dateStr.match(/([a-z]+)\s+(\d{4})/i);
  if (monthYearMatch) {
    const month = monthYearMatch[1].toLowerCase();
    const year = monthYearMatch[2];
    const monthNum = months[month];
    if (monthNum) {
      return `${year}-${monthNum}`;
    }
  }

  return null;
}

/**
 * Sanitize name by removing titles and emojis
 * @param {string} name - Name to sanitize
 * @returns {string} - Sanitized name
 */
export function sanitizeName(name) {
  if (!name || typeof name !== 'string') return '';

  let sanitized = name;

  // Remove common titles
  const titles = ['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sir', 'madam'];
  const titleRegex = new RegExp(`^(${titles.join('|')})\\s+`, 'i');
  sanitized = sanitized.replace(titleRegex, '');

  // Remove emojis (preserve standard Unicode characters)
  sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  sanitized = sanitized.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
  sanitized = sanitized.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
  sanitized = sanitized.replace(/[\u{2600}-\u{26FF}]/gu, '');  // Misc symbols
  sanitized = sanitized.replace(/[\u{2700}-\u{27BF}]/gu, '');  // Dingbats

  return cleanWhitespace(sanitized);
}

/**
 * Generate fulltext from profile data
 * @param {Object} profileData - Profile data object
 * @returns {string} - Concatenated fulltext for search
 */
export function generateFulltext(profileData) {
  if (!profileData || typeof profileData !== 'object') return '';

  const parts = [];

  // Add basic info
  if (profileData.name) parts.push(sanitizeName(profileData.name));
  if (profileData.headline) parts.push(cleanWhitespace(profileData.headline));
  if (profileData.location) parts.push(cleanWhitespace(profileData.location));

  // Add about section
  if (profileData.about) {
    parts.push(cleanWhitespace(profileData.about));
  }

  // Add current position
  if (profileData.current_position && typeof profileData.current_position === 'object') {
    const cp = profileData.current_position;
    if (cp.company) parts.push(cleanWhitespace(cp.company));
    if (cp.title) parts.push(cleanWhitespace(cp.title));
    if (cp.description) parts.push(cleanWhitespace(cp.description));
  }

  // Add experience
  if (Array.isArray(profileData.experience)) {
    profileData.experience.forEach(exp => {
      if (exp.company) parts.push(cleanWhitespace(exp.company));
      if (exp.title) parts.push(cleanWhitespace(exp.title));
      if (exp.description) parts.push(cleanWhitespace(exp.description));
    });
  }

  // Add education
  if (Array.isArray(profileData.education)) {
    profileData.education.forEach(edu => {
      if (edu.school) parts.push(cleanWhitespace(edu.school));
      if (edu.degree) parts.push(cleanWhitespace(edu.degree));
      if (edu.field_of_study) parts.push(cleanWhitespace(edu.field_of_study));
    });
  }

  // Add skills
  if (Array.isArray(profileData.skills) && profileData.skills.length > 0) {
    const skillsText = profileData.skills.join(', ');
    parts.push(`Skills: ${skillsText}`);
  }

  // Join all parts and sanitize
  const fulltext = parts.filter(Boolean).join('\n');
  return sanitizeForJson(fulltext).trim();
}

/**
 * Safe JSON stringify with error handling
 * @param {*} obj - Object to stringify
 * @param {number} space - Indentation spaces (default 2)
 * @returns {string} - JSON string or '{}' on error
 */
export function safeStringify(obj, space = 2) {
  try {
    return JSON.stringify(obj, null, space);
  } catch (error) {
    logger.error('JSON stringify failed:', error);
    return '{}';
  }
}

/**
 * Format profile data as human-readable plain text
 * @param {Object} profileData - Profile data object
 * @returns {string} - Plain text representation
 */
export function formatAsPlainText(profileData) {
  if (!profileData || typeof profileData !== 'object') return '';

  const lines = [];

  // Basic info
  if (profileData.name) {
    lines.push(`Name: ${profileData.name}`);
  }
  if (profileData.headline) {
    lines.push(`Headline: ${profileData.headline}`);
  }
  if (profileData.location) {
    lines.push(`Location: ${profileData.location}`);
  }
  if (profileData.url) {
    lines.push(`Profile: ${profileData.url}`);
  }

  lines.push(''); // Blank line

  // About section
  if (profileData.about) {
    lines.push('About:');
    lines.push(profileData.about);
    lines.push('');
  }

  // Current position
  if (profileData.current_position && typeof profileData.current_position === 'object') {
    const cp = profileData.current_position;
    lines.push('Current Position:');
    if (cp.title && cp.company) {
      lines.push(`  ${cp.title} at ${cp.company}`);
    } else if (cp.title) {
      lines.push(`  ${cp.title}`);
    } else if (cp.company) {
      lines.push(`  ${cp.company}`);
    }
    if (cp.start_date) {
      const dateStr = cp.end_date ? `${cp.start_date} - ${cp.end_date}` : `${cp.start_date} - Present`;
      lines.push(`  ${dateStr}`);
    }
    lines.push('');
  }

  // Experience
  if (Array.isArray(profileData.experience) && profileData.experience.length > 0) {
    lines.push('Experience:');
    profileData.experience.forEach(exp => {
      if (exp.title && exp.company) {
        lines.push(`  • ${exp.title} at ${exp.company}`);
      } else if (exp.title) {
        lines.push(`  • ${exp.title}`);
      } else if (exp.company) {
        lines.push(`  • ${exp.company}`);
      }
      if (exp.start_date || exp.end_date) {
        const start = exp.start_date || '';
        const end = exp.end_date || 'Present';
        lines.push(`    ${start} - ${end}`);
      }
    });
    lines.push('');
  }

  // Education
  if (Array.isArray(profileData.education) && profileData.education.length > 0) {
    lines.push('Education:');
    profileData.education.forEach(edu => {
      if (edu.school) {
        let eduLine = `  • ${edu.school}`;
        if (edu.degree) {
          eduLine += `, ${edu.degree}`;
        }
        if (edu.field_of_study) {
          eduLine += ` in ${edu.field_of_study}`;
        }
        lines.push(eduLine);
      }
      if (edu.start_date || edu.end_date) {
        const start = edu.start_date || '';
        const end = edu.end_date || '';
        lines.push(`    ${start}${start && end ? ' - ' : ''}${end}`);
      }
    });
    lines.push('');
  }

  // Skills
  if (Array.isArray(profileData.skills) && profileData.skills.length > 0) {
    lines.push('Skills:');
    lines.push(`  ${profileData.skills.join(', ')}`);
    lines.push('');
  }

  // Metadata
  if (profileData.extracted_at) {
    lines.push(`Extracted: ${profileData.extracted_at}`);
  }

  return lines.join('\n').trim();
}

/**
 * Truncate text to maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default '...')
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength, suffix = '...') {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert text to title case
 * @param {string} text - Text to convert
 * @returns {string} - Title cased text
 */
export function toTitleCase(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export default {
  cleanWhitespace,
  sanitizeForJson,
  normalizeLineEndings,
  formatDate,
  sanitizeName,
  generateFulltext,
  safeStringify,
  formatAsPlainText,
  truncate,
  toTitleCase
};
