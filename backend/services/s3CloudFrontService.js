import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { logger } from '../utils/logger.js';

export class S3CloudFrontService {
  constructor() {
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || "us-west-2" 
    });
    this.bucketName = process.env.S3_SCREENSHOT_BUCKET_NAME || "";
    this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || "";
  }

  /**
   * Check if a profile directory exists and get file dates
   * @param {string} profileId - The LinkedIn profile ID
   * @returns {Promise<{exists: boolean, files: Array, mostRecentDate: Date|null}>}
   */
  async checkProfileDirectory(profileId) {
    try {
      const prefix = `linkedin-profiles/${profileId}/`;
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: 5000
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Contents || response.Contents.length === 0) {
        logger.debug(`No directory found for profile: ${profileId}`);
        return { exists: false, files: [], mostRecentDate: null };
      }

      // Extract dates from filenames and find most recent
      const files = response.Contents.map(obj => ({
        key: obj.Key,
        lastModified: obj.LastModified,
        size: obj.Size,
        extractedDate: this._extractDateFromFilename(obj.Key)
      }));

      const mostRecentDate = this._findMostRecentDate(files);
      
      logger.debug(`Profile ${profileId} directory exists with ${files.length} files, most recent: ${mostRecentDate}`);
      
      return { 
        exists: true, 
        files, 
        mostRecentDate 
      };

    } catch (error) {
      logger.error(`Failed to check profile directory for ${profileId}:`, error);
      throw error;
    }
  }

  /**
   * Extract date from S3 object filename
   * @param {string} filename - S3 object key
   * @returns {Date|null} - Extracted date or null if not found
   */
  _extractDateFromFilename(filename) {
    try {
      // Look for ISO timestamp pattern in filename (YYYY-MM-DDTHH-MM-SS_SSS)
      const timestampMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\d{3})/);
      
      if (timestampMatch) {
        // Convert back to standard ISO format
        const isoString = timestampMatch[1].replace(/-(\d{2}-\d{2}_\d{3})$/, (match, time) => {
          return ':' + time.replace(/-/g, ':').replace('_', '.');
        });
        return new Date(isoString);
      }
      
      return null;
    } catch (error) {
      logger.debug(`Failed to extract date from filename ${filename}:`, error);
      return null;
    }
  }

  /**
   * Find the most recent date from files array
   * @param {Array} files - Array of file objects with dates
   * @returns {Date|null} - Most recent date or null
   */
  _findMostRecentDate(files) {
    const validDates = files
      .map(file => file.extractedDate || file.lastModified)
      .filter(date => date instanceof Date && !isNaN(date));
    
    if (validDates.length === 0) return null;
    
    return new Date(Math.max(...validDates.map(date => date.getTime())));
  }

  /**
   * Check if a date is older than specified months
   * @param {Date} date - Date to check
   * @param {number} months - Number of months threshold
   * @returns {boolean} - True if date is older than threshold
   */
  isDateOlderThan(date, months = 1) {
    if (!date || !(date instanceof Date) || isNaN(date)) {
      return true; // Treat invalid dates as old
    }

    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setMonth(thresholdDate.getMonth() - months);
    
    return date < thresholdDate;
  }

  /**
   * Get CloudFront URL for an S3 object
   * @param {string} s3Key - S3 object key
   * @returns {string} - CloudFront URL
   */
  getCloudFrontUrl(s3Key) {
    return `https://${this.cloudFrontDomain}/${s3Key}`;
  }

  /**
   * Determine if a profile should be analyzed based on existing data
   * @param {string} profileId - The LinkedIn profile ID
   * @param {number} monthsThreshold - Number of months to consider data fresh (default: 1)
   * @returns {Promise<{shouldAnalyze: boolean, reason: string, lastAnalyzed?: Date}>}
   */
  async shouldAnalyzeProfile(profileId, monthsThreshold = 1) {
    try {
      const { exists, mostRecentDate } = await this.checkProfileDirectory(profileId);
      
      if (!exists) {
        logger.info(`Profile ${profileId}: No existing data found - proceeding with first analysis`);
        return { shouldAnalyze: true, reason: 'first_time' };
      }
      
      if (this.isDateOlderThan(mostRecentDate, monthsThreshold)) {
        logger.info(`Profile ${profileId}: Data is older than ${monthsThreshold} month(s) - proceeding with reanalysis`);
        return { shouldAnalyze: true, reason: 'outdated', lastAnalyzed: mostRecentDate };
      }
      
      logger.info(`Profile ${profileId}: Recent data found - skipping analysis`);
      return { shouldAnalyze: false, reason: 'recent', lastAnalyzed: mostRecentDate };
      
    } catch (error) {
      logger.error(`Failed to check analysis status for profile ${profileId}:`, error);
      // On error, proceed with analysis to be safe
      return { shouldAnalyze: true, reason: 'error_checking' };
    }
  }
}

export default S3CloudFrontService;
