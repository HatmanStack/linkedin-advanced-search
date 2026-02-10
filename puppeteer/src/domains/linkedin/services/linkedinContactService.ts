/**
 * LinkedIn Contact Service
 *
 * Handles LinkedIn profile data collection using RAGStack web scraping.
 * Replaces the previous screenshot-based approach with direct scraping.
 */

import { logger } from '#utils/logger.js';
import { RagstackScrapeService, extractLinkedInCookies } from '../../ragstack/index.js';
import { ragstackConfig } from '#shared-config/index.js';
import type { ScrapeJob } from '../../ragstack/types/ragstack.js';
import type { PuppeteerService } from '../../automation/services/puppeteerService.js';

/**
 * Result of a profile scrape operation
 */
export interface ScrapeProfileResult {
  success: boolean;
  message: string;
  profileId: string;
  jobId?: string;
  scrapeJob?: ScrapeJob;
}

/**
 * Service for LinkedIn contact data collection via RAGStack scraping
 */
export class LinkedInContactService {
  private puppeteer: PuppeteerService;
  private ragstackService: RagstackScrapeService | null = null;

  constructor(puppeteerService: PuppeteerService) {
    this.puppeteer = puppeteerService;

    // Initialize RAGStack if configured
    if (ragstackConfig.isConfigured()) {
      this.ragstackService = new RagstackScrapeService();
    } else {
      logger.warn('RAGStack not configured. Profile scraping disabled.');
    }
  }

  /**
   * Scrape a LinkedIn profile using RAGStack.
   *
   * @param profileId - LinkedIn profile ID (e.g., "john-doe")
   * @param status - Connection status (for metadata, not used in scraping)
   * @returns Scrape result with job details
   */
  async scrapeProfile(
    profileId: string,
    status: string = 'possible'
  ): Promise<ScrapeProfileResult> {
    if (!this.ragstackService) {
      return {
        success: false,
        message: 'RAGStack not configured',
        profileId,
      };
    }

    const page = this.puppeteer.getPage();
    if (!page) {
      return {
        success: false,
        message: 'Browser not initialized',
        profileId,
      };
    }

    try {
      logger.info(`Starting RAGStack scrape for profile: ${profileId}`, { status });

      // Extract cookies from current session
      const cookies = await extractLinkedInCookies(page);

      // Start scrape job
      const job = await this.ragstackService.startScrape(profileId, cookies);
      logger.info(`Scrape job started: ${job.jobId}`, { profileId, status: job.status });

      // Wait for completion (with timeout)
      const finalJob = await this.ragstackService.waitForCompletion(job.jobId, {
        pollInterval: 3000, // 3 seconds
        timeout: 180000, // 3 minutes
      });

      const success = finalJob.status === 'COMPLETED';

      logger.info(`Scrape job ${success ? 'completed' : 'failed'}: ${job.jobId}`, {
        profileId,
        status: finalJob.status,
        processedCount: finalJob.processedCount,
        totalUrls: finalJob.totalUrls,
      });

      return {
        success,
        message: success
          ? `Profile scraped successfully (${finalJob.processedCount} pages)`
          : `Scrape failed with status: ${finalJob.status}`,
        profileId,
        jobId: job.jobId,
        scrapeJob: finalJob,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Profile scrape failed for ${profileId}:`, { error: message });

      return {
        success: false,
        message: `Scrape failed: ${message}`,
        profileId,
      };
    }
  }

  /**
   * @deprecated Use scrapeProfile() instead. This method now calls scrapeProfile.
   */
  async takeScreenShotAndUploadToS3(
    profileId: string,
    status: string = 'ally',
    _options: Record<string, unknown> = {}
  ): Promise<{ success: boolean; message: string; data?: unknown }> {
    logger.warn('takeScreenShotAndUploadToS3 is deprecated. Use scrapeProfile().');
    const result = await this.scrapeProfile(profileId, status);
    return {
      success: result.success,
      message: result.message,
      data: result.scrapeJob ? { jobId: result.jobId } : undefined,
    };
  }
}

export default LinkedInContactService;
