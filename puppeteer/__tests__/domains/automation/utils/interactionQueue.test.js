import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../config/index.js', () => ({
  default: {
    linkedinInteractions: {},
  },
}));

import InteractionQueue from '../../../../src/domains/automation/utils/interactionQueue.js';

describe('InteractionQueue', () => {
  let queue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new InteractionQueue();
  });

  describe('constructor', () => {
    it('should initialize with default concurrency of 1', () => {
      expect(queue.concurrency).toBe(1);
    });

    it('should accept custom concurrency', () => {
      const customQueue = new InteractionQueue({ concurrency: 3 });
      expect(customQueue.concurrency).toBe(3);
    });

    it('should ensure minimum concurrency of 1', () => {
      const customQueue = new InteractionQueue({ concurrency: 0 });
      expect(customQueue.concurrency).toBe(1);
    });

    it('should initialize with empty queue', () => {
      expect(queue.queue).toEqual([]);
    });

    it('should initialize with zero active count', () => {
      expect(queue.activeCount).toBe(0);
    });

    it('should initialize with empty jobs map', () => {
      expect(queue.jobs.size).toBe(0);
    });
  });

  describe('enqueue', () => {
    it('should throw error if taskFn is not a function', () => {
      expect(() => queue.enqueue('not a function')).toThrow('enqueue requires a function');
    });

    it('should return a promise', () => {
      const result = queue.enqueue(() => Promise.resolve('done'));
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve with task result', async () => {
      const result = await queue.enqueue(() => Promise.resolve('test result'));
      expect(result).toBe('test result');
    });

    it('should reject with task error', async () => {
      const error = new Error('Task failed');
      await expect(queue.enqueue(() => Promise.reject(error))).rejects.toThrow('Task failed');
    });

    it('should track job in jobs map', () => {
      queue.enqueue(() => Promise.resolve());
      expect(queue.jobs.size).toBe(1);
    });

    it('should generate unique job IDs', () => {
      queue.enqueue(() => Promise.resolve());
      queue.enqueue(() => Promise.resolve());

      const jobIds = Array.from(queue.jobs.keys());
      expect(jobIds[0]).not.toBe(jobIds[1]);
    });

    it('should include meta type in job ID', () => {
      queue.enqueue(() => Promise.resolve(), { type: 'search' });

      const jobId = Array.from(queue.jobs.keys())[0];
      expect(jobId).toContain('search');
    });
  });

  describe('getStatus', () => {
    it('should return null for unknown job', () => {
      const status = queue.getStatus('unknown-id');
      expect(status).toBeNull();
    });

    it('should return status for queued job', async () => {
      const concurrentQueue = new InteractionQueue({ concurrency: 0 });
      concurrentQueue.concurrency = 0; // Block execution

      // Create a blocking job
      const blockingQueue = new InteractionQueue({ concurrency: 1 });
      let resolveFirst;
      const firstPromise = new Promise(r => resolveFirst = r);
      blockingQueue.enqueue(() => firstPromise);

      // Second job should be queued
      blockingQueue.enqueue(() => Promise.resolve(), { type: 'test' });

      const jobId = Array.from(blockingQueue.jobs.keys())[1];
      const status = blockingQueue.getStatus(jobId);

      expect(status).toBeDefined();
      expect(status.status).toBe('queued');

      resolveFirst();
    });

    it('should return job metadata', async () => {
      const promise = queue.enqueue(() => Promise.resolve(), { type: 'message', target: 'user123' });
      await promise;

      const jobId = Array.from(queue.jobs.keys())[0];
      const status = queue.getStatus(jobId);

      expect(status.meta).toEqual({ type: 'message', target: 'user123' });
    });
  });

  describe('getResult', () => {
    it('should return null for unknown job', () => {
      const result = queue.getResult('unknown-id');
      expect(result).toBeNull();
    });

    it('should return result for completed job', async () => {
      await queue.enqueue(() => Promise.resolve('success'));

      const jobId = Array.from(queue.jobs.keys())[0];
      const result = queue.getResult(jobId);

      expect(result.status).toBe('succeeded');
      expect(result.result).toBe('success');
      expect(result.error).toBeNull();
    });

    it('should return error for failed job', async () => {
      try {
        await queue.enqueue(() => Promise.reject(new Error('failed')));
      } catch (e) {}

      const jobId = Array.from(queue.jobs.keys())[0];
      const result = queue.getResult(jobId);

      expect(result.status).toBe('failed');
      expect(result.error.message).toBe('failed');
    });
  });

  describe('concurrency control', () => {
    it('should execute one job at a time with concurrency 1', async () => {
      const order = [];

      const job1 = queue.enqueue(async () => {
        order.push('start1');
        await new Promise(r => setTimeout(r, 10));
        order.push('end1');
      });

      const job2 = queue.enqueue(async () => {
        order.push('start2');
        await new Promise(r => setTimeout(r, 10));
        order.push('end2');
      });

      await Promise.all([job1, job2]);

      expect(order).toEqual(['start1', 'end1', 'start2', 'end2']);
    });

    it('should execute multiple jobs concurrently with higher concurrency', async () => {
      const concurrentQueue = new InteractionQueue({ concurrency: 2 });
      const order = [];

      const job1 = concurrentQueue.enqueue(async () => {
        order.push('start1');
        await new Promise(r => setTimeout(r, 20));
        order.push('end1');
      });

      const job2 = concurrentQueue.enqueue(async () => {
        order.push('start2');
        await new Promise(r => setTimeout(r, 10));
        order.push('end2');
      });

      await Promise.all([job1, job2]);

      // Both should start before either ends
      expect(order.indexOf('start1')).toBeLessThan(order.indexOf('end1'));
      expect(order.indexOf('start2')).toBeLessThan(order.indexOf('end2'));
      // With concurrency 2, start2 should happen before end1
      expect(order.indexOf('start2')).toBeLessThan(order.indexOf('end1'));
    });
  });

  describe('_generateJobId', () => {
    it('should generate job ID with default type', () => {
      const jobId = queue._generateJobId({});
      expect(jobId).toMatch(/^job-\d+-[a-z0-9]+$/);
    });

    it('should use custom type in job ID', () => {
      const jobId = queue._generateJobId({ type: 'custom' });
      expect(jobId).toMatch(/^custom-\d+-[a-z0-9]+$/);
    });

    it('should include timestamp in job ID', () => {
      const before = Date.now();
      const jobId = queue._generateJobId({});
      const after = Date.now();

      const timestamp = parseInt(jobId.split('-')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('job lifecycle', () => {
    it('should track job timestamps', async () => {
      const before = Date.now();
      await queue.enqueue(() => Promise.resolve());
      const after = Date.now();

      const jobId = Array.from(queue.jobs.keys())[0];
      const job = queue.jobs.get(jobId);

      expect(job.createdAt).toBeGreaterThanOrEqual(before);
      expect(job.createdAt).toBeLessThanOrEqual(after);
      expect(job.startedAt).toBeGreaterThanOrEqual(before);
      expect(job.finishedAt).toBeGreaterThanOrEqual(job.startedAt);
    });

    it('should update status through lifecycle', async () => {
      let capturedStatus;

      await queue.enqueue(async () => {
        const jobId = Array.from(queue.jobs.keys())[0];
        capturedStatus = queue.jobs.get(jobId).status;
        return 'done';
      });

      expect(capturedStatus).toBe('running');

      const jobId = Array.from(queue.jobs.keys())[0];
      expect(queue.jobs.get(jobId).status).toBe('succeeded');
    });
  });
});
