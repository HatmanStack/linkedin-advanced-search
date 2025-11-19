import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedInContactService from '../../../puppeteer-backend/services/linkedinContactService.js';

describe('LinkedInContactService - CRITICAL Contact Management', () => {
  let service;
  let mockPuppeteer;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn(),
      $$: vi.fn(),
      evaluate: vi.fn(),
    };

    mockPuppeteer = {
      getPage: () => mockPage,
      goto: vi.fn(),
      safeClick: vi.fn(() => Promise.resolve(true)),
      safeType: vi.fn(() => Promise.resolve(true)),
    };

    service = new LinkedInContactService(mockPuppeteer);
  });

  describe('getConnections', () => {
    it('should fetch connections list', async () => {
      mockPage.evaluate.mockResolvedValue([
        { name: 'John Doe', profileUrl: 'https://linkedin.com/in/john' },
        { name: 'Jane Smith', profileUrl: 'https://linkedin.com/in/jane' },
      ]);

      const connections = await service.getConnections();

      expect(connections).toHaveLength(2);
      expect(connections[0].name).toBe('John Doe');
    });

    it('should handle empty connections', async () => {
      mockPage.evaluate.mockResolvedValue([]);

      const connections = await service.getConnections();

      expect(connections).toEqual([]);
    });
  });

  describe('sendConnectionRequest', () => {
    it('should send connection request with note', async () => {
      const result = await service.sendConnectionRequest(
        'https://linkedin.com/in/john',
        'Great profile!'
      );

      expect(mockPuppeteer.goto).toHaveBeenCalled();
      expect(mockPuppeteer.safeClick).toHaveBeenCalled();
    });
  });

  describe('removeConnection', () => {
    it('should remove connection successfully', async () => {
      const result = await service.removeConnection('https://linkedin.com/in/user');

      expect(mockPuppeteer.goto).toHaveBeenCalled();
    });
  });
});
