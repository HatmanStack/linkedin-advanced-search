/**
 * S3 Text Upload Service
 *
 * Handles uploading extracted LinkedIn profile text to S3 with error handling and retry logic
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export class S3TextUploadService {
  constructor() {
    this.s3Client = new S3Client({
      region: config.s3.profileText.region
    });
    this.bucket = config.s3.profileText.bucket;
    this.prefix = config.s3.profileText.prefix;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Initial delay in ms

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

    try {
      // Validate profile data
      this.validateProfileData(profileData);

      // Extract profile ID and build S3 key
      const profileId = this.extractProfileId(profileData.url || profileData.profile_id);
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
      const response = await this.uploadWithRetry(params);

      const duration = Date.now() - startTime;
      const fileSize = contentBuffer.length;

      logger.info(`Successfully uploaded profile text to S3`, {
        profileId,
        s3Key,
        fileSize,
        duration: `${duration}ms`,
        etag: response.ETag
      });

      // Return upload metadata
      return {
        success: true,
        profileId,
        s3Key,
        s3Url: this.buildS3Url(s3Key),
        fileSize,
        etag: response.ETag,
        uploadDuration: duration,
        uploadedAt: enrichedData.uploaded_at
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to upload profile text to S3:`, {
        profileId: profileData.profile_id || profileData.url,
        error: error.message,
        duration: `${duration}ms`
      });

      return {
        success: false,
        error: error.message,
        uploadDuration: duration
      };
    }
  }

  /**
   * Upload with exponential backoff retry logic
   * @private
   * @param {Object} params - S3 PutObjectCommand parameters
   * @returns {Promise<Object>} - S3 response
   */
  async uploadWithRetry(params) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const command = new PutObjectCommand(params);
        const response = await this.s3Client.send(command);
        return response;

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

    // Fallback: use timestamp-based ID
    const fallbackId = `profile-${Date.now()}`;
    logger.warn(`Could not extract profile ID from URL: ${urlOrId}, using fallback: ${fallbackId}`);
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
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} - True if file exists
   */
  async checkFileExists(s3Key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: s3Key
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
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
}

export default S3TextUploadService;
