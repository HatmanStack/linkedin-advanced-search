import { describe, it, expect, vi } from 'vitest';
import {
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
} from '../../../src/shared/utils/textFormatter.js';

vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('TextFormatter', () => {
  describe('cleanWhitespace', () => {
    it('should collapse multiple spaces to single space', () => {
      expect(cleanWhitespace('hello    world')).toBe('hello world');
    });

    it('should trim leading and trailing whitespace', () => {
      expect(cleanWhitespace('  hello world  ')).toBe('hello world');
    });

    it('should handle tabs and newlines', () => {
      expect(cleanWhitespace('hello\t\nworld')).toBe('hello world');
    });

    it('should return empty string for null', () => {
      expect(cleanWhitespace(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(cleanWhitespace(undefined)).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(cleanWhitespace(123)).toBe('');
    });

    it('should handle empty string', () => {
      expect(cleanWhitespace('')).toBe('');
    });
  });

  describe('sanitizeForJson', () => {
    it('should remove control characters', () => {
      const input = 'hello\x00\x08world';
      expect(sanitizeForJson(input)).toBe('helloworld');
    });

    it('should preserve normal text', () => {
      expect(sanitizeForJson('hello world')).toBe('hello world');
    });

    it('should preserve newlines and tabs (0x09, 0x0A, 0x0D)', () => {
      expect(sanitizeForJson('hello\nworld')).toBe('hello\nworld');
      expect(sanitizeForJson('hello\tworld')).toBe('hello\tworld');
    });

    it('should return empty string for null', () => {
      expect(sanitizeForJson(null)).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(sanitizeForJson({})).toBe('');
    });
  });

  describe('normalizeLineEndings', () => {
    it('should convert Windows line endings to Unix', () => {
      expect(normalizeLineEndings('hello\r\nworld')).toBe('hello\nworld');
    });

    it('should convert old Mac line endings to Unix', () => {
      expect(normalizeLineEndings('hello\rworld')).toBe('hello\nworld');
    });

    it('should preserve Unix line endings', () => {
      expect(normalizeLineEndings('hello\nworld')).toBe('hello\nworld');
    });

    it('should handle mixed line endings', () => {
      expect(normalizeLineEndings('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    });

    it('should return empty string for null', () => {
      expect(normalizeLineEndings(null)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should parse year only', () => {
      const result = formatDate('2023');
      expect(result).toEqual({ start: '2023', end: null });
    });

    it('should parse month and year', () => {
      const result = formatDate('Jan 2023');
      expect(result).toEqual({ start: '2023-01', end: null });
    });

    it('should parse full month name', () => {
      const result = formatDate('January 2023');
      expect(result).toEqual({ start: '2023-01', end: null });
    });

    it('should parse date range', () => {
      const result = formatDate('Jan 2020 - Dec 2023');
      expect(result).toEqual({ start: '2020-01', end: '2023-12' });
    });

    it('should handle Present as end date', () => {
      const result = formatDate('Jan 2020 - Present');
      expect(result).toEqual({ start: '2020-01', end: 'Present' });
    });

    it('should handle present (lowercase)', () => {
      const result = formatDate('Jan 2020 - present');
      expect(result).toEqual({ start: '2020-01', end: 'Present' });
    });

    it('should return null for invalid input', () => {
      expect(formatDate(null)).toBe(null);
      expect(formatDate('')).toBe(null);
      expect(formatDate(123)).toBe(null);
    });

    it('should handle all months', () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const expectedNums = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

      months.forEach((month, i) => {
        const result = formatDate(`${month} 2023`);
        expect(result.start).toBe(`2023-${expectedNums[i]}`);
      });
    });
  });

  describe('sanitizeName', () => {
    it('should remove common titles', () => {
      expect(sanitizeName('Dr. John Doe')).toBe('John Doe');
      expect(sanitizeName('Mr. John Doe')).toBe('John Doe');
      expect(sanitizeName('Mrs. Jane Doe')).toBe('Jane Doe');
    });

    it('should remove emojis', () => {
      expect(sanitizeName('John 😀 Doe')).toBe('John Doe');
      expect(sanitizeName('Jane 🚀 Smith')).toBe('Jane Smith');
    });

    it('should clean whitespace after sanitization', () => {
      expect(sanitizeName('  John   Doe  ')).toBe('John Doe');
    });

    it('should return empty string for null', () => {
      expect(sanitizeName(null)).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(sanitizeName(123)).toBe('');
    });

    it('should handle names with no modifications needed', () => {
      expect(sanitizeName('John Doe')).toBe('John Doe');
    });
  });

  describe('generateFulltext', () => {
    it('should combine profile fields', () => {
      const profile = {
        name: 'John Doe',
        headline: 'Software Engineer',
        location: 'New York',
      };
      const result = generateFulltext(profile);
      expect(result).toContain('John Doe');
      expect(result).toContain('Software Engineer');
      expect(result).toContain('New York');
    });

    it('should include about section', () => {
      const profile = {
        name: 'John Doe',
        about: 'Experienced developer',
      };
      const result = generateFulltext(profile);
      expect(result).toContain('Experienced developer');
    });

    it('should include current position', () => {
      const profile = {
        name: 'John Doe',
        current_position: {
          company: 'Tech Corp',
          title: 'Engineer',
          description: 'Building things',
        },
      };
      const result = generateFulltext(profile);
      expect(result).toContain('Tech Corp');
      expect(result).toContain('Engineer');
      expect(result).toContain('Building things');
    });

    it('should include experience', () => {
      const profile = {
        name: 'John Doe',
        experience: [
          { company: 'Company A', title: 'Role A' },
          { company: 'Company B', title: 'Role B' },
        ],
      };
      const result = generateFulltext(profile);
      expect(result).toContain('Company A');
      expect(result).toContain('Company B');
    });

    it('should include education', () => {
      const profile = {
        name: 'John Doe',
        education: [
          { school: 'University X', degree: 'BS', field_of_study: 'CS' },
        ],
      };
      const result = generateFulltext(profile);
      expect(result).toContain('University X');
      expect(result).toContain('BS');
      expect(result).toContain('CS');
    });

    it('should include skills', () => {
      const profile = {
        name: 'John Doe',
        skills: ['JavaScript', 'Python', 'React'],
      };
      const result = generateFulltext(profile);
      expect(result).toContain('Skills:');
      expect(result).toContain('JavaScript');
    });

    it('should return empty string for null', () => {
      expect(generateFulltext(null)).toBe('');
    });

    it('should return empty string for non-object', () => {
      expect(generateFulltext('string')).toBe('');
    });
  });

  describe('safeStringify', () => {
    it('should stringify objects', () => {
      const result = safeStringify({ a: 1 });
      expect(result).toBe('{\n  "a": 1\n}');
    });

    it('should handle arrays', () => {
      const result = safeStringify([1, 2, 3]);
      expect(result).toContain('1');
    });

    it('should return empty object string on error', () => {
      const circular = {};
      circular.self = circular;
      const result = safeStringify(circular);
      expect(result).toBe('{}');
    });

    it('should respect space parameter', () => {
      const result = safeStringify({ a: 1 }, 4);
      expect(result).toContain('    ');
    });
  });

  describe('formatAsPlainText', () => {
    it('should format basic profile info', () => {
      const profile = {
        name: 'John Doe',
        headline: 'Software Engineer',
        location: 'NYC',
        url: 'https://linkedin.com/in/johndoe',
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('Name: John Doe');
      expect(result).toContain('Headline: Software Engineer');
      expect(result).toContain('Location: NYC');
      expect(result).toContain('Profile:');
    });

    it('should format about section', () => {
      const profile = {
        name: 'John',
        about: 'About me text',
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('About:');
      expect(result).toContain('About me text');
    });

    it('should format current position', () => {
      const profile = {
        name: 'John',
        current_position: {
          title: 'Engineer',
          company: 'TechCo',
          start_date: '2020',
        },
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('Current Position:');
      expect(result).toContain('Engineer at TechCo');
      expect(result).toContain('2020 - Present');
    });

    it('should format experience', () => {
      const profile = {
        name: 'John',
        experience: [
          { title: 'Dev', company: 'Co1', start_date: '2018', end_date: '2020' },
        ],
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('Experience:');
      expect(result).toContain('Dev at Co1');
    });

    it('should format education', () => {
      const profile = {
        name: 'John',
        education: [
          { school: 'MIT', degree: 'BS', field_of_study: 'CS' },
        ],
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('Education:');
      expect(result).toContain('MIT, BS in CS');
    });

    it('should format skills', () => {
      const profile = {
        name: 'John',
        skills: ['JS', 'Python'],
      };
      const result = formatAsPlainText(profile);
      expect(result).toContain('Skills:');
      expect(result).toContain('JS, Python');
    });

    it('should return empty string for null', () => {
      expect(formatAsPlainText(null)).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10);
      expect(result.length).toBe(10);
      expect(result).toBe('This is...');
    });

    it('should not truncate short strings', () => {
      const result = truncate('Short', 10);
      expect(result).toBe('Short');
    });

    it('should use custom suffix', () => {
      const result = truncate('This is a very long string', 12, '>>>');
      expect(result.endsWith('>>>')).toBe(true);
    });

    it('should return empty string for null', () => {
      expect(truncate(null, 10)).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(truncate(123, 10)).toBe('');
    });

    it('should handle exact length', () => {
      const result = truncate('Exactly', 7);
      expect(result).toBe('Exactly');
    });
  });

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });

    it('should handle single word', () => {
      expect(toTitleCase('hello')).toBe('Hello');
    });

    it('should handle mixed case input', () => {
      expect(toTitleCase('hELLO wORLD')).toBe('Hello World');
    });

    it('should return empty string for null', () => {
      expect(toTitleCase(null)).toBe('');
    });

    it('should return empty string for non-string', () => {
      expect(toTitleCase(123)).toBe('');
    });

    it('should handle empty string', () => {
      expect(toTitleCase('')).toBe('');
    });
  });
});
