/**
 * S3 Text Upload Service
 *
 * Handles uploading extracted LinkedIn profile text to S3 with error handling and retry logic
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { logger } from '../../shared/utils/logger.js';
import config from '../../shared/config/index.js';
import { UploadMetrics } from '../utils/uploadMetrics.js';
import { checkFileExists } from '../utils/s3Helpers.js';

export class S3TextUploadService {
  constructor() {
    this.s3Client = new S3Client({
      region: config.s3.profileText.region
    });
    this.bucket = config.s3.profileText.bucket;
    this.prefix = config.s3.profileText.prefix;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Initial delay in ms
    this.metrics = new UploadMetrics();

    logger.debug('S3TextUploadService initialized', {
      bucket: this.bucket,
      prefix: this.prefix,
      region: config.s3.profileText.region
    });
  }

  /**
   * Upload profile text to S3
   * @param {Object} profileData - Profile data object from text extraction
   * @returns {Promise<Object>} - Upload result with S3 key, URL, and metadata
   */
  async uploadProfileText(profileData) {
    const startTime = Date.now();
    let success = false;
    let bytes = 0;
    let retries = 0;
    let profileId = null;
    let errorMessage = null;

    try {
      // Validate profile data
      this.validateProfileData(profileData);

      // Extract profile ID and build S3 key
      profileId = this.extractProfileId(profileData.url || profileData.profile_id);
      const s3Key = `${this.prefix}${profileId}/${profileId}.json`;

      logger.info(`Uploading profile text to S3: ${profileId}`);

      // Add upload metadata
      const enrichedData = {
        ...profileData,
        uploaded_at: new Date().toISOString(),
        s3_key: s3Key
      };

      // Convert to JSON
      const jsonContent = JSON.stringify(enrichedData, null, 2);
      const contentBuffer = Buffer.from(jsonContent, 'utf-8');
      bytes = contentBuffer.length;

      // Prepare S3 upload parameters
      const params = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: contentBuffer,
        ContentType: 'application/json',
        Metadata: {
          'profile-id': profileId,
          'extracted-at': profileData.extracted_at || '',
          'uploaded-at': enrichedData.uploaded_at,
          'status': profileData.status || 'unknown',
          'version': '1.0.0'
        },
        ServerSideEncryption: 'AES256'
      };

      // Upload with retry logic
      const uploadResult = await this.uploadWithRetry(params);
      const response = uploadResult.response;
      retries = uploadResult.retries;

      const duration = Date.now() - startTime;
      success = true;

      logger.info(`Successfully uploaded profile text to S3`, {
        profileId,
        s3Key,
        fileSize: bytes,
        duration: `${duration}ms`,
        etag: response.ETag,
        retries
      });

      // Return upload metadata
      return {
        success: true,
        profileId,
        s3Key,
        s3Url: this.buildS3Url(s3Key),
        fileSize: bytes,
        etag: response.ETag,
        uploadDuration: duration,
        uploadedAt: enrichedData.uploaded_at,
        retries
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      errorMessage = error.message;
      logger.error(`Failed to upload profile text to S3:`, {
        profileId: profileId || profileData.profile_id || profileData.url,
        error: errorMessage,
        duration: `${duration}ms`
      });

      return {
        success: false,
        error: errorMessage,
        uploadDuration: duration
      };
    } finally {
      const duration = Date.now() - startTime;
      this.metrics.recordUpload(success, duration, bytes, retries, profileId, errorMessage);
    }
  }

  /**
   * Upload with exponential backoff retry logic
   * @private
   * @param {Object} params - S3 PutObjectCommand parameters
   * @returns {Promise<Object>} - Object with response and retries count
   */
  async uploadWithRetry(params) {
    let lastError;
    let retries = 0;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const command = new PutObjectCommand(params);
        const response = await this.s3Client.send(command);

        // Return response and retry count
        return {
          response,
          retries
        };

      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (!this.isRetriableError(error)) {
          logger.error(`Non-retriable S3 error:`, {
            error: error.message,
            code: error.name,
            statusCode: error.$metadata?.httpStatusCode
          });
          throw error;
        }

        // Last attempt - throw error
        if (attempt === this.maxRetries) {
          logger.error(`S3 upload failed after ${this.maxRetries} attempts`, {
            error: error.message
          });
          throw error;
        }

        // Increment retry counter
        retries++;

        // Calculate backoff delay
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.warn(`S3 upload attempt ${attempt}/${this.maxRetries} failed, retrying in ${delay}ms`, {
          error: error.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retriable
   * @private
   * @param {Error} error - Error object
   * @returns {boolean} - True if error should be retried
   */
  isRetriableError(error) {
    // Retry on network errors, 5xx errors, throttling
    const retriableCodes = [
      'NetworkingError',
      'TimeoutError',
      'RequestTimeout',
      'ServiceUnavailable',
      'InternalError',
      'SlowDown',
      'RequestTimeTooSkewed'
    ];

    const statusCode = error.$metadata?.httpStatusCode;

    return (
      retriableCodes.includes(error.name) ||
      (statusCode >= 500 && statusCode < 600) ||
      statusCode === 429
    );
  }

  /**
   * Validate profile data before upload
   * @private
   * @param {Object} profileData - Profile data to validate
   * @throws {Error} - If validation fails
   */
  validateProfileData(profileData) {
    if (!profileData || typeof profileData !== 'object') {
      throw new Error('Profile data must be an object');
    }

    if (!profileData.url && !profileData.profile_id) {
      throw new Error('Profile data must have url or profile_id');
    }

    if (!profileData.extracted_at) {
      logger.warn('Profile data missing extracted_at timestamp');
    }
  }

  /**
   * Extract profile ID from LinkedIn URL or use existing profile_id
   * @private
   * @param {string} urlOrId - LinkedIn URL or profile ID
   * @returns {string} - Profile ID
   */
  extractProfileId(urlOrId) {
    if (!urlOrId) {
      throw new Error('URL or profile ID is required');
    }

    // If it's already a profile ID (no URL format), return it
    if (!urlOrId.includes('/') && !urlOrId.includes('http')) {
      return urlOrId;
    }

    // Extract from LinkedIn URL
    const match = urlOrId.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // Fallback: use hash-based ID for deterministic fallback
    // This ensures same URL always generates same ID (idempotent)
    const hash = createHash('md5').update(urlOrId).digest('hex').substring(0, 8);
    const fallbackId = `profile-${hash}`;
    logger.warn(`Could not extract profile ID from URL: ${urlOrId}, using hash-based fallback: ${fallbackId}`);
    return fallbackId;
  }

  /**
   * Build full S3 URL from key
   * @private
   * @param {string} key - S3 object key
   * @returns {string} - Full S3 URL
   */
  buildS3Url(key) {
    return `s3://${this.bucket}/${key}`;
  }

  /**
   * Build HTTPS URL for S3 object
   * @private
   * @param {string} key - S3 object key
   * @returns {string} - HTTPS URL
   */
  buildHttpsUrl(key) {
    const region = config.s3.profileText.region;
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Check if file exists in S3
   * Uses the shared checkFileExists utility from s3Helpers
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} - True if file exists
   */
  async checkFileExists(s3Key) {
    return checkFileExists(this.bucket, s3Key, config.s3.profileText.region);
  }

  /**
   * Sleep for specified milliseconds
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current upload metrics
   * @returns {Object} - Current metrics snapshot
   */
  getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Reset upload metrics
   */
  resetMetrics() {
    this.metrics.resetMetrics();
  }

  /**
   * Get metrics summary
   * @returns {Object} - Summary statistics
   */
  getMetricsSummary() {
    return this.metrics.getSummary();
  }
}

export default S3TextUploadService;
