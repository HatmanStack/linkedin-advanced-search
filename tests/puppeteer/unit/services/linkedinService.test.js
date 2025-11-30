import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInService } from '../../../puppeteer-backend/services/linkedinService.js';

// Mock dependencies
vi.mock('../../../puppeteer-backend/utils/crypto.js', () => ({
  decryptSealboxB64Tag: vi.fn(async (ciphertext) => {
    if (ciphertext.includes('valid')) {
      return JSON.stringify({ email: 'test@example.com', password: 'TestPass123!' });
    }
    throw new Error('Decryption failed');
  }),
}));

vi.mock('../../../puppeteer-backend/config/index.js', () => ({
  default: {
    googleAI: { apiKey: 'test-key' },
    timeouts: { navigation: 15000, login: 30000 },
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: () => ({ generateContent: vi.fn() }),
  })),
}));

describe('LinkedInService - CRITICAL LinkedIn Automation', () => {
  let service;
  let mockPuppeteer;
  let mockPage;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      waitForFunction: vi.fn(),
      keyboard: { press: vi.fn() },
      evaluate: vi.fn(),
      $: vi.fn(),
      $$: vi.fn(),
    };

    mockPuppeteer = {
      goto: vi.fn(),
      safeType: vi.fn(() => Promise.resolve(true)),
      safeClick: vi.fn(() => Promise.resolve(true)),
      getPage: () => mockPage,
    };

    service = new LinkedInService(mockPuppeteer);
  });

  describe('login - CRITICAL authentication', () => {
    it('should login successfully with username and password', async () => {
      mockPage.waitForSelector.mockResolvedValue(true);
      mockPage.waitForFunction.mockResolvedValue(true);

      const result = await service.login('test@example.com', 'TestPass123!', false);

      expect(result).toBe(true);
      expect(mockPuppeteer.goto).toHaveBeenCalledWith('https://www.linkedin.com/login');
      expect(mockPuppeteer.safeType).toHaveBeenCalledWith('#username', 'test@example.com');
      expect(mockPuppeteer.safeType).toHaveBeenCalledWith('#password', 'TestPass123!');
      expect(mockPuppeteer.safeClick).toHaveBeenCalledWith('form button[type="submit"]');
    });

    it('should decrypt credentials when ciphertext provided', async () => {
      mockPage.waitForSelector.mockResolvedValue(true);
      mockPage.waitForFunction.mockResolvedValue(true);

      const result = await service.login(
        null,
        null,
        false,
        'sealbox_x25519:b64:valid_encrypted_data'
      );

      expect(result).toBe(true);
      expect(mockPuppeteer.safeType).toHaveBeenCalledWith('#username', 'test@example.com');
    });

    it('should throw error when username is missing', async () => {
      await expect(service.login('', 'password', false)).rejects.toThrow(
        'LinkedIn username is missing or invalid'
      );
    });

    it('should throw error when password is missing', async () => {
      await expect(service.login('user@test.com', '', false)).rejects.toThrow(
        'LinkedIn password is missing or invalid'
      );
    });

    it('should throw error when decryption fails', async () => {
      await expect(
        service.login(null, null, false, 'sealbox_x25519:b64:invalid')
      ).rejects.toThrow('Credential decryption failed');
    });

    it('should handle username entry failure', async () => {
      mockPuppeteer.safeType.mockResolvedValueOnce(false);

      await expect(
        service.login('test@example.com', 'Pass123!', false)
      ).rejects.toThrow('Failed to enter username');
    });

    it('should handle password entry failure', async () => {
      mockPuppeteer.safeType
        .mockResolvedValueOnce(true) // username succeeds
        .mockResolvedValueOnce(false); // password fails

      await expect(
        service.login('test@example.com', 'Pass123!', false)
      ).rejects.toThrow('Failed to enter password');
    });

    it('should handle login button click failure', async () => {
      mockPuppeteer.safeClick.mockResolvedValueOnce(false);

      await expect(
        service.login('test@example.com', 'Pass123!', false)
      ).rejects.toThrow('Failed to click login button');
    });

    it('should handle 2FA/security challenges with long timeout', async () => {
      mockPage.waitForSelector.mockImplementation((selector, options) => {
        // Simulate delay for security challenge
        return new Promise((resolve) => setTimeout(resolve, 100));
      });

      const result = await service.login('test@example.com', 'Pass123!', false);

      expect(result).toBe(true);
      expect(mockPage.waitForSelector).toHaveBeenCalled();
    });

    it('should throw error when homepage not detected after login', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      await expect(
        service.login('test@example.com', 'Pass123!', false)
      ).rejects.toThrow();
    });
  });

  describe('navigateToIds - Company search automation', () => {
    it('should search for company successfully', async () => {
      mockPage.waitForSelector.mockResolvedValue(true);
      mockPage.keyboard.press.mockResolvedValue(true);

      await service.navigateToIds('Tech Corp');

      expect(mockPuppeteer.safeType).toHaveBeenCalledWith(
        expect.any(String),
        'Tech Corp'
      );
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('ArrowDown');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    it('should try multiple search box selectors', async () => {
      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(true);

      await service.navigateToIds('Company Name');

      expect(mockPage.waitForSelector).toHaveBeenCalled();
    });

    it('should throw error when search box not found', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));
      mockPuppeteer.safeType.mockResolvedValue(false);

      await expect(service.navigateToIds('Company')).rejects.toThrow(
        'Failed to find or enter search term in the search box'
      );
    });
  });

  describe('Service initialization', () => {
    it('should initialize with puppeteer service', () => {
      expect(service.puppeteer).toBe(mockPuppeteer);
      expect(service.sessionTag).toBe('default');
    });

    it('should initialize Google AI when API key present', () => {
      expect(service.genAI).toBeDefined();
      expect(service.model).toBeDefined();
    });

    it('should initialize LinkedIn contact service', () => {
      expect(service.linkedInContactService).toBeDefined();
    });
  });
});
