/**
 * Navigation service types for LinkedIn page navigation.
 */

import type { Page } from 'puppeteer';

/**
 * Result of element search operations.
 */
export interface ElementSearchResult {
  /** Found element or null */
  element: unknown | null;
  /** Selector that matched, or null if not found */
  selector: string | null;
}

/**
 * Interface for navigation operations.
 */
export interface INavigationService {
  /** Navigate to a LinkedIn profile page */
  navigateToProfile(profileId: string): Promise<boolean>;
  /** Verify current page is a valid profile page */
  verifyProfilePage(page: Page): Promise<boolean>;
  /** Wait for LinkedIn SPA to finish loading */
  waitForLinkedInLoad(): Promise<void>;
  /** Wait for page DOM to stabilize */
  waitForPageStability(maxWaitMs?: number, sampleIntervalMs?: number): Promise<boolean>;
}

/**
 * Interface for element finding utilities.
 */
export interface IElementFinder {
  /** Find first matching element from selector list */
  findElementBySelectors(selectors: string[], waitTimeout?: number): Promise<ElementSearchResult>;
  /** Wait for any selector to appear */
  waitForAnySelector(selectors: string[], waitTimeout?: number): Promise<ElementSearchResult>;
  /** Perform human-like click on element */
  clickElementHumanly(page: Page, element: unknown): Promise<void>;
  /** Clear input and type text */
  clearAndTypeText(page: Page, element: unknown, text: string): Promise<void>;
}
