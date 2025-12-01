import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../src/shared/config/index.js', () => ({
  default: {
    nodeEnv: 'test',
  },
}));

describe('Logger', () => {
  let logger;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../../src/shared/utils/logger.js');
    logger = module.logger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger Instance', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
    });

    it('should have standard log level methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have file transports configured', () => {
      const fileTransports = logger.transports.filter(
        t => t.constructor.name === 'File'
      );
      expect(fileTransports.length).toBeGreaterThanOrEqual(2);
    });

    it('should log info messages without throwing', () => {
      expect(() => logger.info('test info message')).not.toThrow();
    });

    it('should log warn messages without throwing', () => {
      expect(() => logger.warn('test warning message')).not.toThrow();
    });

    it('should log error messages without throwing', () => {
      expect(() => logger.error('test error message')).not.toThrow();
    });

    it('should log debug messages without throwing', () => {
      expect(() => logger.debug('test debug message')).not.toThrow();
    });

    it('should log objects without throwing', () => {
      expect(() => logger.info('test message', { data: 'test' })).not.toThrow();
    });

    it('should log errors with stack traces', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred', error)).not.toThrow();
    });
  });

  describe('Logger Configuration', () => {
    it('should have default meta with service name', () => {
      expect(logger.defaultMeta).toBeDefined();
      expect(logger.defaultMeta.service).toBe('linkedin-search-backend');
    });
  });
});
