import { logger } from './logger.js';

/**
 * Simple in-memory FIFO queue with configurable concurrency.
 * Used to serialize LinkedIn interaction jobs so concurrent requests
 * do not step on the same long-lived Puppeteer page/session.
 */
class InteractionQueue {
  constructor(options = {}) {
    // Force serialization for current single-Page architecture
    const defaultConcurrency = 1;
    this.concurrency = Math.max(1, Number(options.concurrency) || defaultConcurrency);
    this.queue = [];
    this.activeCount = 0;
    this.jobs = new Map();
  }

  /**
   * Enqueue a unit of work.
   * @param {Function} taskFn - async function performing the job, returns a result
   * @param {Object} meta - metadata for logging/inspection (e.g., { type, requestId, userId })
   * @returns {Promise<any>} resolves/rejects with task result
   */
  enqueue(taskFn, meta = {}) {
    if (typeof taskFn !== 'function') {
      throw new Error('enqueue requires a function');
    }

    const jobId = this._generateJobId(meta);
    const jobRecord = {
      id: jobId,
      status: 'queued',
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      meta,
      result: undefined,
      error: null,
    };

    this.jobs.set(jobId, jobRecord);

    return new Promise((resolve, reject) => {
      const run = async () => {
        jobRecord.status = 'running';
        jobRecord.startedAt = Date.now();
        logger.info('InteractionQueue: job started', { jobId, meta, activeCount: this.activeCount });
        try {
          const result = await taskFn();
          jobRecord.status = 'succeeded';
          jobRecord.finishedAt = Date.now();
          jobRecord.result = result;
          logger.info('InteractionQueue: job completed', { jobId, durationMs: jobRecord.finishedAt - jobRecord.startedAt });
          resolve(result);
        } catch (err) {
          jobRecord.status = 'failed';
          jobRecord.finishedAt = Date.now();
          jobRecord.error = { message: err?.message || String(err) };
          logger.error('InteractionQueue: job failed', { jobId, error: err?.message, stack: err?.stack });
          reject(err);
        } finally {
          this.activeCount = Math.max(0, this.activeCount - 1);
          this._dequeueNext();
        }
      };

      this.queue.push({ jobId, run });
      logger.debug('InteractionQueue: job enqueued', { jobId, queueLength: this.queue.length });
      this._dequeueNext();
    });
  }

  getStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const { status, createdAt, startedAt, finishedAt, meta } = job;
    return { jobId, status, createdAt, startedAt, finishedAt, meta };
    }

  getResult(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return { status: job.status, result: job.result, error: job.error };
  }

  _dequeueNext() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      this.activeCount += 1;
      try {
        next.run();
      } catch (err) {
        logger.error('InteractionQueue: unexpected error starting job', { jobId: next?.jobId, error: err?.message });
        this.activeCount = Math.max(0, this.activeCount - 1);
      }
    }
  }

  _generateJobId(meta) {
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const type = meta?.type || 'job';
    return `${type}-${now}-${rand}`;
  }
}

// Export a singleton queue instance for linkedin interactions
export const linkedInInteractionQueue = new InteractionQueue();

export default InteractionQueue;


