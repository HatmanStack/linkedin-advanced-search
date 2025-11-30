import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedInInteractionService from '../../../puppeteer-backend/services/linkedinInteractionService.js';

describe('LinkedInInteractionService - CRITICAL Messaging', () => {
  let service;
  let mockPuppeteer;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn(),
      evaluate: vi.fn(),
      keyboard: { press: vi.fn() },
    };

    mockPuppeteer = {
      getPage: () => mockPage,
      goto: vi.fn(),
      safeClick: vi.fn(() => Promise.resolve(true)),
      safeType: vi.fn(() => Promise.resolve(true)),
    };

    service = new LinkedInInteractionService(mockPuppeteer);
  });

  describe('sendMessage', () => {
    it('should send message to connection', async () => {
      const result = await service.sendMessage(
        'conn-123',
        'Hello! I enjoyed your recent post.'
      );

      expect(mockPuppeteer.goto).toHaveBeenCalled();
      expect(mockPuppeteer.safeType).toHaveBeenCalledWith(
        expect.any(String),
        'Hello! I enjoyed your recent post.'
      );
      expect(mockPuppeteer.safeClick).toHaveBeenCalled();
    });

    it('should handle long messages', async () => {
      const longMessage = 'A'.repeat(500);

      await service.sendMessage('conn-123', longMessage);

      expect(mockPuppeteer.safeType).toHaveBeenCalledWith(
        expect.any(String),
        longMessage
      );
    });

    it('should throw error for empty message', async () => {
      await expect(service.sendMessage('conn-123', '')).rejects.toThrow();
    });
  });

  describe('getMessageHistory', () => {
    it('should fetch message history', async () => {
      mockPage.evaluate.mockResolvedValue([
        { sender: 'user', content: 'Hello', timestamp: '2024-01-01' },
        { sender: 'connection', content: 'Hi!', timestamp: '2024-01-01' },
      ]);

      const history = await service.getMessageHistory('conn-123');

      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Hello');
    });
  });
});
