/**
 * Cookie Extraction Utility
 *
 * Extracts and serializes cookies from Puppeteer browser sessions
 * for use with RAGStack authenticated scraping.
 */

import type { Page, Cookie } from 'puppeteer';
import { logger } from '#utils/logger.js';

/**
 * LinkedIn cookie names that are essential for authentication
 */
const ESSENTIAL_LINKEDIN_COOKIES = [
  'li_at', // Main auth token
  'JSESSIONID', // Session ID
  'liap', // Auth preference
  'li_rm', // Remember me
];

/**
 * Extract LinkedIn cookies from a Puppeteer page and serialize them.
 *
 * @param page - Puppeteer Page instance with active LinkedIn session
 * @returns Serialized cookie string (e.g., "li_at=xxx; JSESSIONID=yyy")
 * @throws Error if no LinkedIn cookies found
 */
export async function extractLinkedInCookies(page: Page): Promise<string> {
  const cookies = await page.cookies();

  // Filter to LinkedIn domain cookies
  // Match: .linkedin.com, linkedin.com, www.linkedin.com
  // Don't match: notlinkedin.com, fakelinkedin.com
  const linkedInCookies = cookies.filter((cookie) => {
    const domain = cookie.domain.toLowerCase();
    return (
      domain === 'linkedin.com' ||
      domain === '.linkedin.com' ||
      domain.endsWith('.linkedin.com')
    );
  });

  if (linkedInCookies.length === 0) {
    throw new Error('No LinkedIn cookies found. User may not be logged in.');
  }

  // Check for essential auth cookies
  const cookieNames = new Set(linkedInCookies.map((c) => c.name));
  const hasAuthCookie = ESSENTIAL_LINKEDIN_COOKIES.some((name) =>
    cookieNames.has(name)
  );

  if (!hasAuthCookie) {
    logger.warn(
      'LinkedIn cookies found but no essential auth cookies (li_at, JSESSIONID). ' +
        'Scraping may fail due to missing authentication.'
    );
  }

  // Serialize cookies
  const serialized = serializeCookies(linkedInCookies);

  logger.debug(`Extracted ${linkedInCookies.length} LinkedIn cookies`, {
    cookieNames: Array.from(cookieNames),
    serializedLength: serialized.length,
  });

  return serialized;
}

/**
 * Serialize cookies to standard HTTP cookie format.
 *
 * @param cookies - Array of Puppeteer Cookie objects
 * @returns Serialized string (e.g., "name1=value1; name2=value2")
 */
export function serializeCookies(cookies: Cookie[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Check if LinkedIn session appears valid based on cookies.
 *
 * @param page - Puppeteer Page instance
 * @returns True if essential auth cookies are present
 */
export async function hasValidLinkedInSession(page: Page): Promise<boolean> {
  try {
    const cookies = await page.cookies();
    const linkedInCookies = cookies.filter((c) => {
      const domain = c.domain.toLowerCase();
      return (
        domain === 'linkedin.com' ||
        domain === '.linkedin.com' ||
        domain.endsWith('.linkedin.com')
      );
    });
    const cookieNames = new Set(linkedInCookies.map((c) => c.name));

    return ESSENTIAL_LINKEDIN_COOKIES.some((name) => cookieNames.has(name));
  } catch {
    return false;
  }
}
