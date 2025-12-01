

import { logger } from './logger.js';


export function cleanWhitespace(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}


export function sanitizeForJson(text) {
  if (!text || typeof text !== 'string') return '';

  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}


export function normalizeLineEndings(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}


export function formatDate(linkedInDate) {
  if (!linkedInDate || typeof linkedInDate !== 'string') return null;

  const dateText = linkedInDate.trim();

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

  const parsed = parseLinkedInDate(dateText);
  return parsed ? { start: parsed, end: null } : null;
}


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

  const yearMatch = dateStr.match(/^\d{4}$/);
  if (yearMatch) {
    return yearMatch[0];
  }

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


export function sanitizeName(name) {
  if (!name || typeof name !== 'string') return '';

  let sanitized = name;

  const titles = ['mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sir', 'madam'];
  const titleRegex = new RegExp(`^(${titles.join('|')})\\s+`, 'i');
  sanitized = sanitized.replace(titleRegex, '');

  sanitized = sanitized.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
  sanitized = sanitized.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
  sanitized = sanitized.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
  sanitized = sanitized.replace(/[\u{2600}-\u{26FF}]/gu, '');
  sanitized = sanitized.replace(/[\u{2700}-\u{27BF}]/gu, '');

  return cleanWhitespace(sanitized);
}


export function generateFulltext(profileData) {
  if (!profileData || typeof profileData !== 'object') return '';

  const parts = [];

  if (profileData.name) parts.push(sanitizeName(profileData.name));
  if (profileData.headline) parts.push(cleanWhitespace(profileData.headline));
  if (profileData.location) parts.push(cleanWhitespace(profileData.location));

  if (profileData.about) {
    parts.push(cleanWhitespace(profileData.about));
  }

  if (profileData.current_position && typeof profileData.current_position === 'object') {
    const cp = profileData.current_position;
    if (cp.company) parts.push(cleanWhitespace(cp.company));
    if (cp.title) parts.push(cleanWhitespace(cp.title));
    if (cp.description) parts.push(cleanWhitespace(cp.description));
  }

  if (Array.isArray(profileData.experience)) {
    profileData.experience.forEach(exp => {
      if (exp.company) parts.push(cleanWhitespace(exp.company));
      if (exp.title) parts.push(cleanWhitespace(exp.title));
      if (exp.description) parts.push(cleanWhitespace(exp.description));
    });
  }

  if (Array.isArray(profileData.education)) {
    profileData.education.forEach(edu => {
      if (edu.school) parts.push(cleanWhitespace(edu.school));
      if (edu.degree) parts.push(cleanWhitespace(edu.degree));
      if (edu.field_of_study) parts.push(cleanWhitespace(edu.field_of_study));
    });
  }

  if (Array.isArray(profileData.skills) && profileData.skills.length > 0) {
    const skillsText = profileData.skills.join(', ');
    parts.push(`Skills: ${skillsText}`);
  }

  const fulltext = parts.filter(Boolean).join('\n');
  return sanitizeForJson(fulltext).trim();
}


export function safeStringify(obj, space = 2) {
  try {
    return JSON.stringify(obj, null, space);
  } catch (error) {
    logger.error('JSON stringify failed:', error);
    return '{}';
  }
}


export function formatAsPlainText(profileData) {
  if (!profileData || typeof profileData !== 'object') return '';

  const lines = [];

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

  lines.push('');

  if (profileData.about) {
    lines.push('About:');
    lines.push(profileData.about);
    lines.push('');
  }

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

  if (Array.isArray(profileData.skills) && profileData.skills.length > 0) {
    lines.push('Skills:');
    lines.push(`  ${profileData.skills.join(', ')}`);
    lines.push('');
  }

  if (profileData.extracted_at) {
    lines.push(`Extracted: ${profileData.extracted_at}`);
  }

  return lines.join('\n').trim();
}


export function truncate(text, maxLength, suffix = '...') {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}


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
