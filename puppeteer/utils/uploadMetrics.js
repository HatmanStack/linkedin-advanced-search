/**
 * Upload Metrics
 *
 * Tracks and reports metrics for S3 profile text uploads
 */

import { logger } from './logger.js';

/**
 * UploadMetrics class for tracking upload statistics
 */
export class UploadMetrics {
  constructor() {
    this.metrics = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      retriedUploads: 0,
      totalBytesUploaded: 0,
      avgUploadDuration: 0,
      uploadDurations: [],
      lastResetTime: new Date().toISOString(),
      errors: []
    };
    this.maxErrorHistory = 50; // Keep last 50 errors
    this.maxDurationHistory = 100; // Keep last 100 durations for average calculation
  }

  /**
   * Record an upload attempt
   * @param {boolean} success - Whether the upload succeeded
   * @param {number} duration - Duration in milliseconds
   * @param {number} bytes - Number of bytes uploaded
   * @param {number} retries - Number of retry attempts
   * @param {string} profileId - Profile ID for this upload
   * @param {string} error - Error message if failed
   */
  recordUpload(success, duration, bytes, retries = 0, profileId = null, error = null) {
    this.metrics.totalUploads++;

    if (success) {
      this.metrics.successfulUploads++;
      this.metrics.totalBytesUploaded += bytes;
    } else {
      this.metrics.failedUploads++;

      // Track error details
      if (error) {
        this.metrics.errors.push({
          timestamp: new Date().toISOString(),
          profileId,
          error,
          duration
        });

        // Keep only last N errors
        if (this.metrics.errors.length > this.maxErrorHistory) {
          this.metrics.errors.shift();
        }
      }
    }

    if (retries > 0) {
      this.metrics.retriedUploads++;
    }

    // Track upload duration
    this.metrics.uploadDurations.push(duration);

    // Keep only last N durations to avoid memory growth
    if (this.metrics.uploadDurations.length > this.maxDurationHistory) {
      this.metrics.uploadDurations.shift();
    }

    // Recalculate average duration
    this.metrics.avgUploadDuration = this.calculateAverage();

    // Log metrics summary periodically (every 10 uploads)
    if (this.metrics.totalUploads % 10 === 0) {
      this.logMetricsSummary();
    }
  }

  /**
   * Calculate average upload duration
   * @private
   * @returns {number} - Average duration in milliseconds
   */
  calculateAverage() {
    if (this.metrics.uploadDurations.length === 0) {
      return 0;
    }
    const sum = this.metrics.uploadDurations.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / this.metrics.uploadDurations.length);
  }

  /**
   * Get current metrics
   * @returns {Object} - Current metrics snapshot
   */
  getMetrics() {
    const successRate = this.metrics.totalUploads > 0
      ? (this.metrics.successfulUploads / this.metrics.totalUploads * 100).toFixed(2)
      : 0;

    const retryRate = this.metrics.totalUploads > 0
      ? (this.metrics.retriedUploads / this.metrics.totalUploads * 100).toFixed(2)
      : 0;

    return {
      ...this.metrics,
      successRate: `${successRate}%`,
      retryRate: `${retryRate}%`,
      avgBytesPerUpload: this.metrics.successfulUploads > 0
        ? Math.round(this.metrics.totalBytesUploaded / this.metrics.successfulUploads)
        : 0,
      totalBytesUploadedMB: (this.metrics.totalBytesUploaded / 1024 / 1024).toFixed(2),
      // Don't include full duration array in response, just stats
      uploadDurations: undefined,
      minUploadDuration: this.metrics.uploadDurations.length > 0
        ? Math.min(...this.metrics.uploadDurations)
        : 0,
      maxUploadDuration: this.metrics.uploadDurations.length > 0
        ? Math.max(...this.metrics.uploadDurations)
        : 0,
      // Only return recent errors
      recentErrors: this.metrics.errors.slice(-10)
    };
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    logger.info('Resetting upload metrics', this.getMetrics());
    this.metrics = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      retriedUploads: 0,
      totalBytesUploaded: 0,
      avgUploadDuration: 0,
      uploadDurations: [],
      lastResetTime: new Date().toISOString(),
      errors: []
    };
  }

  /**
   * Log metrics summary
   * @private
   */
  logMetricsSummary() {
    const metrics = this.getMetrics();
    logger.info('S3 Upload Metrics Summary', {
      totalUploads: metrics.totalUploads,
      successfulUploads: metrics.successfulUploads,
      failedUploads: metrics.failedUploads,
      successRate: metrics.successRate,
      retriedUploads: metrics.retriedUploads,
      retryRate: metrics.retryRate,
      avgUploadDuration: `${metrics.avgUploadDuration}ms`,
      minUploadDuration: `${metrics.minUploadDuration}ms`,
      maxUploadDuration: `${metrics.maxUploadDuration}ms`,
      totalBytesUploadedMB: `${metrics.totalBytesUploadedMB} MB`,
      avgBytesPerUpload: metrics.avgBytesPerUpload
    });
  }

  /**
   * Get summary statistics
   * @returns {Object} - Summary statistics
   */
  getSummary() {
    const metrics = this.getMetrics();
    return {
      totalUploads: metrics.totalUploads,
      successRate: metrics.successRate,
      avgUploadDuration: `${metrics.avgUploadDuration}ms`,
      totalDataUploaded: `${metrics.totalBytesUploadedMB} MB`,
      lastResetTime: metrics.lastResetTime
    };
  }
}

export default UploadMetrics;
