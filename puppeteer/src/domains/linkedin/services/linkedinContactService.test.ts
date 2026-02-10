import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';

// Use vi.hoisted to create mock functions that are available at mock initialization time
const { mockStartScrape, mockWaitForCompletion, mockExtractLinkedInCookies, mockIsConfigured } =
  vi.hoisted(() => ({
    mockStartScrape: vi.fn(),
    mockWaitForCompletion: vi.fn(),
    mockExtractLinkedInCookies: vi.fn(),
    mockIsConfigured: vi.fn(),
  }));

// Mock dependencies before importing the module
vi.mock('../../ragstack/index.js', () => ({
  RagstackScrapeService: class MockRagstackScrapeService {
    startScrape = mockStartScrape;
    waitForCompletion = mockWaitForCompletion;
  },
  extractLinkedInCookies: mockExtractLinkedInCookies,
}));

vi.mock('#shared-config/index.js', () => ({
  ragstackConfig: {
    isConfigured: mockIsConfigured,
  },
}));

vi.mock('#utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { LinkedInContactService } from './linkedinContactService.js';

describe('LinkedInContactService', () => {
  let service: LinkedInContactService;
  let mockPuppeteerService: { getPage: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPuppeteerService = {
      getPage: vi.fn().mockReturnValue({
        cookies: vi.fn().mockResolvedValue([]),
      }),
    };

    mockStartScrape.mockResolvedValue({
      jobId: 'job-123',
      status: 'PENDING',
      baseUrl: 'https://www.linkedin.com/in/john-doe/',
    });

    mockWaitForCompletion.mockResolvedValue({
      jobId: 'job-123',
      status: 'COMPLETED',
      processedCount: 2,
      totalUrls: 2,
      baseUrl: 'https://www.linkedin.com/in/john-doe/',
    });

    mockExtractLinkedInCookies.mockResolvedValue('li_at=token; JSESSIONID=ajax:123');
    mockIsConfigured.mockReturnValue(true);

    service = new LinkedInContactService(mockPuppeteerService as any);
  });

  describe('constructor', () => {
    it('should initialize RAGStack service when configured', () => {
      // Service was created in beforeEach with isConfigured returning true
      // Just verify the service exists
      expect(service).toBeDefined();
    });

    it('should not initialize RAGStack service when not configured', async () => {
      vi.clearAllMocks();
      mockIsConfigured.mockReturnValue(false);

      const unconfiguredService = new LinkedInContactService(mockPuppeteerService as any);
      const result = await unconfiguredService.scrapeProfile('test');

      // Should fail with "not configured" message
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });
  });

  describe('scrapeProfile', () => {
    it('should scrape profile successfully', async () => {
      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(result.profileId).toBe('john-doe');
      expect(result.message).toContain('successfully');
      expect(mockExtractLinkedInCookies).toHaveBeenCalled();
      expect(mockStartScrape).toHaveBeenCalledWith('john-doe', 'li_at=token; JSESSIONID=ajax:123');
      expect(mockWaitForCompletion).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({
          pollInterval: 3000,
          timeout: 180000,
        })
      );
    });

    it('should return failure when RAGStack not configured', async () => {
      vi.clearAllMocks();
      mockIsConfigured.mockReturnValue(false);
      const unconfiguredService = new LinkedInContactService(mockPuppeteerService as any);

      const result = await unconfiguredService.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
      expect(result.profileId).toBe('john-doe');
    });

    it('should return failure when browser not initialized', async () => {
      mockPuppeteerService.getPage.mockReturnValue(null);

      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Browser not initialized');
    });

    it('should handle scrape failures', async () => {
      mockWaitForCompletion.mockResolvedValue({
        jobId: 'job-123',
        status: 'FAILED',
        baseUrl: 'https://www.linkedin.com/in/john-doe/',
      });

      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('FAILED');
    });

    it('should handle errors gracefully', async () => {
      mockStartScrape.mockRejectedValue(new Error('Network error'));

      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });

    it('should pass status parameter to logging', async () => {
      await service.scrapeProfile('john-doe', 'ally');

      expect(mockStartScrape).toHaveBeenCalled();
    });
  });

  describe('takeScreenShotAndUploadToS3 (deprecated)', () => {
    it('should call scrapeProfile internally', async () => {
      const result = await service.takeScreenShotAndUploadToS3('john-doe', 'ally');

      expect(result.success).toBe(true);
      expect(mockStartScrape).toHaveBeenCalled();
    });

    it('should return compatible response format', async () => {
      const result = await service.takeScreenShotAndUploadToS3('john-doe', 'ally');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result.data).toHaveProperty('jobId');
    });

    it('should handle failures from scrapeProfile', async () => {
      mockStartScrape.mockRejectedValue(new Error('API error'));

      const result = await service.takeScreenShotAndUploadToS3('john-doe', 'ally');

      expect(result.success).toBe(false);
      expect(result.message).toContain('API error');
    });
  });
});
